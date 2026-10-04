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
    private string $tz;
    /** @var string[] */
    private array $folders;

    public function __construct(array $cfg) {
        $this->home = dirname(studio_private_dir());
        $this->rclone = $cfg['rclone'] ?? $this->home . '/bin/rclone';
        $this->remote = $cfg['drive_remote'] ?? 'gdrive';
        $this->tz = $cfg['timezone'] ?? 'America/Los_Angeles';
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

    // What's on the server now, one item per note-to-be: each subfolder of a watched folder, and loose
    // files at its top level grouped by the day they were taken. Each item says what's in it and when its
    // newest file arrived, and which note it became (if any) and how many files came after that.
    private function inbox(): array {
        $out = []; $done = $this->processed();
        foreach ($this->folders as $f) {
            $root = $this->dest($f);
            if (!is_dir($root)) continue;
            $loose = [];
            foreach (scandir($root) ?: [] as $name) {
                if ($name[0] === '.') continue;
                $path = "$root/$name";
                if (is_dir($path)) $out[] = $this->item("$f/$name", $name, $this->listFiles($path), $done, true);
                elseif (is_file($path)) $loose[$this->day($path)][] = ['path' => $path, 'rel' => $name];
            }
            foreach ($loose as $day => $files) {
                $out[] = $this->item("$f/#$day", $day, array_map(fn($x) => $this->fileInfo($x['path'], $x['rel']), $files), $done, false) + ['date' => $day];
            }
        }
        usort($out, fn($a, $b) => $b['arrived'] <=> $a['arrived']);
        return $out;
    }

    private function item(string $source, string $name, array $files, array $done, bool $dir): array {
        $count = ['photo' => 0, 'video' => 0, 'track' => 0, 'text' => 0, 'audio' => 0, 'other' => 0];
        $bytes = 0; $arrived = 0;
        foreach ($files as $x) { $count[$x['kind']]++; $bytes += $x['bytes']; $arrived = max($arrived, $x['arrived']); }
        $note = $done[$source] ?? null;
        $since = $note ? count(array_filter($files, fn($x) => $x['arrived'] > (int) ($note['at'] ?? 0))) : 0;
        return ['source' => $source, 'name' => $name, 'dir' => $dir, 'files' => count($files), 'bytes' => $bytes, 'count' => $count,
            'arrived' => $arrived, 'note' => $note, 'since' => $since];
    }

    // when a file landed on the server (rclone keeps Drive's modified time, so the inode change time is
    // the arrival), and what kind it is
    private function fileInfo(string $path, string $rel): array {
        $st = stat($path);
        return ['name' => $rel, 'kind' => self::kindOf($path, $rel), 'bytes' => (int) $st['size'], 'changed' => (int) $st['mtime'], 'arrived' => (int) $st['ctime']];
    }
    // A text file can be a track in disguise (a GPX export saved as File_000.txt, say): the first few KB
    // tell. GPX, or a CSV with latitude and longitude columns, is a track; anything else stays a note.
    public static function kindOf(string $path, string $rel): string {
        $kind = self::kind($rel);
        if ($kind !== 'text') return $kind;
        $head = (string) @file_get_contents($path, false, null, 0, 4096);
        if (preg_match('/<gpx[\s>]/i', $head)) return 'track';
        $first = strtolower(strtok($head, "\n") ?: '');
        if (str_contains($first, 'latitude') && str_contains($first, 'longitude') && substr_count($first, ',') >= 2) return 'track';
        return $kind;
    }
    private function listFiles(string $dir): array {
        $out = [];
        $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS));
        foreach ($it as $file) {
            if (!$file->isFile() || $file->getFilename()[0] === '.') continue;
            $out[] = $this->fileInfo($file->getPathname(), substr($file->getPathname(), strlen($dir) + 1));
        }
        usort($out, fn($a, $b) => strnatcasecmp($a['name'], $b['name']));
        return $out;
    }
    // the day a loose file belongs to: when the photo was taken (from its camera data), else its date in Drive
    private function day(string $path): string {
        $tz = new DateTimeZone($this->tz);
        if (preg_match('/\.jpe?g$/i', $path) && function_exists('exif_read_data')) {
            $x = @exif_read_data($path, 'EXIF');
            $t = $x['DateTimeOriginal'] ?? null;
            if (is_string($t) && preg_match('/^(\d{4}):(\d{2}):(\d{2})/', $t, $m)) return "$m[1]-$m[2]-$m[3]";
        }
        return (new DateTime('@' . filemtime($path)))->setTimezone($tz)->format('Y-m-d');
    }

    // ---------- Process Content: a folder that came in from Drive becomes a draft note ----------

    // Which inbox folder became which note: "Rides/<folder>" => entry id, kept with the private config.
    private function mapFile(): string { return studio_private_dir() . '/processed.json'; }
    public function processed(): array {
        $f = $this->mapFile();
        $m = is_file($f) ? (json_decode((string) file_get_contents($f), true) ?: []) : [];
        return array_map(fn($v) => is_array($v) ? $v : ['id' => (string) $v, 'at' => 0], $m);
    }
    public function remember(string $source, string $id): void {
        if ($this->resolve($source) === null) return;
        $m = $this->processed(); $m[$source] = ['id' => $id, 'at' => time()];
        file_put_contents($this->mapFile(), json_encode($m, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), LOCK_EX);
    }

    // "Rides/<folder>" -> that folder; "Rides/#2026-10-03" -> the loose files of that day. Null unless it's
    // really in the inbox (no climbing out).
    private function resolve(string $source): ?array {
        $parts = explode('/', $source, 2);
        if (count($parts) !== 2 || !in_array($parts[0], $this->folders, true)) return null;
        $root = realpath($this->dest($parts[0]));
        if (!$root) return null;
        if (preg_match('/^#(\d{4}-\d{2}-\d{2})$/', $parts[1], $m)) return ['root' => $root, 'day' => $m[1]];
        $path = realpath($this->dest($parts[0]) . '/' . $parts[1]);
        if (!$path || !is_dir($path) || dirname($path) !== $root) return null;
        return ['root' => $path, 'day' => null];
    }
    private function filesOf(array $r): array {
        if ($r['day'] === null) return $this->listFiles($r['root']);
        $out = [];
        foreach (scandir($r['root']) ?: [] as $name) {
            $p = $r['root'] . '/' . $name;
            if ($name[0] !== '.' && is_file($p) && $this->day($p) === $r['day']) $out[] = $this->fileInfo($p, $name);
        }
        return $out;
    }

    public static function kind(string $name): string {
        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        if (in_array($ext, ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp'], true)) return 'photo';
        if (in_array($ext, ['mov', 'mp4', 'm4v'], true)) return 'video';
        if (in_array($ext, ['gpx', 'csv'], true)) return 'track';
        if (in_array($ext, ['txt', 'md'], true)) return 'text';
        if (in_array($ext, ['wav', 'mp3', 'm4a'], true)) return 'audio';
        return 'other';
    }

    // Everything in one inbox item, with any text notes read in.
    public function files(string $source): array {
        $r = $this->resolve($source);
        if ($r === null) throw new RuntimeException('That folder isn\'t in the inbox.');
        $files = $this->filesOf($r); $notes = [];
        foreach ($files as $x) {
            if ($x['kind'] === 'text' && $x['bytes'] < 65536) $notes[] = trim((string) file_get_contents($r['root'] . '/' . $x['name']));
        }
        return ['source' => $source, 'files' => $files, 'notes' => implode("\n\n", array_filter($notes)),
            'note' => $this->processed()[$source] ?? null, 'day' => $r['day']];
    }

    // One photo, track or audio file from an inbox folder, sent to the logged-in Studio page (which resizes
    // photos, trims tracks and masters audio in the browser, as it does for dropped files).
    public function send(string $source, string $name): never {
        $r = $this->resolve($source);
        $root = $r['root'] ?? '';
        $path = $r === null ? false : realpath("$root/$name");
        if (!$path || !is_file($path) || !str_starts_with($path, $root . '/')) json_fail('No such file.', 404);
        if ($r['day'] !== null && (dirname($path) !== $root || $this->day($path) !== $r['day'])) json_fail('No such file.', 404);
        $kind = self::kindOf($path, $path);
        if (!in_array($kind, ['photo', 'track', 'text', 'audio'], true)) json_fail('Only photos, tracks, notes and audio come through here.', 400);
        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        $type = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp', 'heic' => 'image/heic', 'heif' => 'image/heif',
            'wav' => 'audio/wav', 'mp3' => 'audio/mpeg', 'm4a' => 'audio/mp4'][$ext] ?? 'text/plain; charset=utf-8';
        header('Content-Type: ' . $type);
        header('Cache-Control: private, max-age=600');
        header('Accept-Ranges: bytes');
        $total = filesize($path);
        // a part of the file when asked (Safari plays audio only from a server that answers ranges)
        if (preg_match('/^bytes=(\d*)-(\d*)$/', $_SERVER['HTTP_RANGE'] ?? '', $m) && ($m[1] !== '' || $m[2] !== '')) {
            $from = $m[1] === '' ? max(0, $total - (int) $m[2]) : (int) $m[1];
            $to = $m[1] === '' || $m[2] === '' ? $total - 1 : min((int) $m[2], $total - 1);
            if ($from > $to || $from >= $total) { http_response_code(416); header("Content-Range: bytes */$total"); exit; }
            http_response_code(206);
            header("Content-Range: bytes $from-$to/$total");
            header('Content-Length: ' . ($to - $from + 1));
            $fh = fopen($path, 'rb'); fseek($fh, $from); $left = $to - $from + 1;
            while ($left > 0 && !feof($fh)) { $chunk = fread($fh, min(65536, $left)); echo $chunk; $left -= strlen($chunk); }
            fclose($fh);
            exit;
        }
        header('Content-Length: ' . $total);
        readfile($path);
        exit;
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
