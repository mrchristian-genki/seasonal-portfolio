<?php
/* STUDIO DRIVE: brings new files in from Google Drive to the server with rclone, so large videos never
   pass through a phone, a laptop or the browser. It only ever copies one way (Drive to server) and
   never deletes on either side; files already here with the same size and date are skipped.

   rclone lives at ~/bin/rclone with a remote named "gdrive" (see studio/README.md). Each watched Drive
   folder lands in ~/incoming/<folder>, outside the web folder, so nothing copied is public. The copy
   runs in the background; its log and state sit in ~/studio-private. */
declare(strict_types=1);

final class Drive {
    private string $home;
    private string $rclone;
    private string $remote;
    /** @var string[] */
    private array $folders;

    public function __construct(array $cfg) {
        $this->home = dirname(studio_private_dir());
        $this->rclone = $cfg['rclone'] ?? $this->home . '/bin/rclone';
        $this->remote = $cfg['drive_remote'] ?? 'gdrive';
        $this->folders = array_values(array_filter($cfg['drive_folders'] ?? ['Rides'],
            fn($f) => is_string($f) && preg_match('/^[\w .-]{1,80}$/u', $f) && !str_contains($f, '..')));
    }

    private function log(): string { return studio_private_dir() . '/drive-sync.log'; }
    private function stateFile(): string { return studio_private_dir() . '/drive-sync.json'; }
    private function dest(string $folder): string { return $this->home . '/incoming/' . $folder; }

    private function state(): array {
        $f = $this->stateFile();
        return is_file($f) ? (json_decode((string) file_get_contents($f), true) ?: []) : [];
    }

    // Running while the background shell is alive (and for at most 12 hours, in case a pid is reused).
    private function running(array $s): bool {
        $pid = (int) ($s['pid'] ?? 0);
        return $pid > 0 && empty($s['finished']) && time() - (int) ($s['started'] ?? 0) < 43200 && file_exists("/proc/$pid");
    }

    private function problem(): ?string {
        $off = array_map('trim', explode(',', (string) ini_get('disable_functions')));
        if (!function_exists('exec') || in_array('exec', $off, true)) return "This server doesn't let the Studio start programs (PHP exec is off).";
        if (!is_file($this->rclone) || !is_executable($this->rclone)) return 'rclone isn\'t installed at ~/bin/rclone yet (see the Studio README).';
        if (!$this->folders) return 'No Drive folders are set to watch.';
        return null;
    }

    public function start(): array {
        if ($p = $this->problem()) throw new RuntimeException($p);
        $lock = fopen(studio_private_dir() . '/drive-sync.lock', 'c');
        if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) throw new RuntimeException('A copy is already starting.');
        try {
            if ($this->running($this->state())) return $this->status();
            if (is_file($this->log())) rename($this->log(), $this->log() . '.prev');
            $steps = [];
            foreach ($this->folders as $f) {
                if (!is_dir($this->dest($f))) mkdir($this->dest($f), 0700, true);
                $steps[] = implode(' ', array_map('escapeshellarg', [
                    $this->rclone, 'copy', $this->remote . ':' . $f, $this->dest($f),
                    '--drive-skip-gdocs', '--exclude', '.DS_Store', '--transfers', '2', '--checkers', '4',
                    '--log-file', $this->log(), '--log-level', 'INFO', '--stats', '5s', '--stats-one-line',
                ]));
            }
            // Each folder in turn; the last line records how it went, which status() reads back.
            $script = 'rc=0; ' . implode(' || rc=$?; ', $steps) . ' || rc=$?; echo "STUDIO-DONE $rc" >> ' . escapeshellarg($this->log());
            $out = [];
            exec('nohup sh -c ' . escapeshellarg($script) . ' > /dev/null 2>&1 & echo $!', $out);
            $pid = (int) ($out[0] ?? 0);
            if ($pid <= 0) throw new RuntimeException('The copy didn\'t start.');
            file_put_contents($this->stateFile(), json_encode(['pid' => $pid, 'started' => time()]), LOCK_EX);
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
        return $this->status();
    }

    public function status(): array {
        $s = $this->state();
        $lines = is_file($this->log()) ? $this->tail($this->log(), 400) : [];
        $done = null; $progress = ''; $copied = []; $errors = [];
        foreach ($lines as $l) {
            if (preg_match('/^STUDIO-DONE (\d+)/', $l, $m)) { $done = (int) $m[1]; continue; }
            if (preg_match('/INFO\s*:\s*(.+?): Copied \((new|replaced existing)\)/', $l, $m)) $copied[] = $m[1];
            elseif (preg_match('/ERROR\s*:\s*(.+)$/', $l, $m)) $errors[] = $m[1];
            elseif (preg_match('/NOTICE:\s*(.*\bETA\b.*)$/', $l, $m) || preg_match('/INFO\s*:\s*(.*\d+%.*ETA.*)$/', $l, $m)) $progress = trim($m[1]);
        }
        $running = $this->running($s);
        if (!$running && $done !== null && empty($s['finished']) && $s) {
            $s['finished'] = (int) filemtime($this->log()); $s['ok'] = $done === 0;
            file_put_contents($this->stateFile(), json_encode($s), LOCK_EX);
        }
        $clean = fn(string $t) => str_replace($this->home, '~', $t);
        return [
            'ready' => $this->problem() === null, 'problem' => $this->problem(),
            'folders' => $this->folders, 'running' => $running,
            'started' => $s['started'] ?? null, 'finished' => $s['finished'] ?? null, 'ok' => $s['ok'] ?? null,
            'progress' => $clean($progress),
            'copied' => array_map($clean, array_slice($copied, -40)), 'copiedCount' => count($copied),
            'errors' => array_map($clean, array_slice($errors, -10)),
            'inbox' => $this->inbox(),
        ];
    }

    // What's on the server now: each subfolder of each watched folder, with its file count and size.
    private function inbox(): array {
        $out = [];
        foreach ($this->folders as $f) {
            $root = $this->dest($f);
            if (!is_dir($root)) continue;
            foreach (scandir($root) ?: [] as $name) {
                if ($name[0] === '.') continue;
                $path = "$root/$name"; $n = 0; $bytes = 0;
                if (is_dir($path)) {
                    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS));
                    foreach ($it as $file) { if ($file->isFile()) { $n++; $bytes += $file->getSize(); } }
                } else { $n = 1; $bytes = (int) filesize($path); }
                $out[] = ['folder' => $f, 'name' => $name, 'files' => $n, 'bytes' => $bytes, 'changed' => (int) filemtime($path)];
            }
        }
        usort($out, fn($a, $b) => $b['changed'] <=> $a['changed']);
        return $out;
    }

    private function tail(string $file, int $n): array {
        $size = filesize($file);
        $h = fopen($file, 'r');
        if (!$h) return [];
        fseek($h, max(0, $size - 65536));
        $text = (string) stream_get_contents($h);
        fclose($h);
        return array_slice(preg_split('/\r?\n/', trim($text)) ?: [], -$n);
    }
}
