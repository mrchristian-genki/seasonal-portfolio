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
            $long = $this->longNames();
            foreach ($this->folders as $f) {
                if (!is_dir($this->dest($f))) mkdir($this->dest($f), 0700, true);
                $flags = ['--drive-skip-gdocs', '--exclude', '.DS_Store', '--log-file', $this->log(), '--log-level', 'INFO'];
                // names too long for the server's disk are left out of the folder copy and fetched one by one below
                $skip = [];
                foreach ($this->longIn($f) as $rel) $skip[] = '/' . preg_replace('/[\\\\*?\[\]{}]/', '\\\\$0', $rel);
                $ex = studio_private_dir() . '/drive-long-' . md5($f) . '.txt';
                file_put_contents($ex, implode("\n", $skip) . "\n", LOCK_EX);
                $steps[] = implode(' ', array_map('escapeshellarg', array_merge([
                    $this->rclone, 'copy', $this->remote . ':' . $f, $this->dest($f), '--exclude-from', $ex,
                    '--transfers', '2', '--checkers', '4', '--stats', '5s', '--stats-one-line'], $flags)));
                foreach ($this->longIn($f) as $rel) {
                    $short = $this->shorten($rel);
                    $long["$f/$short"] = $rel;
                    // one named file takes no filters: rclone refuses "--exclude" with it ("can't limit to single files
                    // when using filters", Oct 18), and a long name is never .DS_Store anyway
                    $steps[] = implode(' ', array_map('escapeshellarg', array_merge([
                        $this->rclone, 'copyto', $this->remote . ':' . $f . '/' . $rel, $this->dest($f) . '/' . $short], array_slice($flags, 3))));
                }
            }
            file_put_contents($this->longFile(), json_encode($long, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), LOCK_EX);
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

    // ---------- names too long for the server ----------
    // A phone's dictation can name a file after everything said ("Right, we went to Marley Lake, ... .txt"), and a
    // name past 255 bytes can't be written here. Those files come in under a shortened name instead: the first
    // words, a short tag that keeps it the same name on every run (so it's skipped once it's here), and the
    // extension. The full name is remembered (drive-longnames.json); a note whose words were only in its name
    // still gets them.
    private const MAX_NAME = 180;   // bytes; leaves room for rclone's ".<hash>.partial" while it copies
    private function longFile(): string { return studio_private_dir() . '/drive-longnames.json'; }
    private function longNames(): array {
        $f = $this->longFile();
        return is_file($f) ? (json_decode((string) file_get_contents($f), true) ?: []) : [];
    }
    /** Paths in a watched Drive folder with a part too long for this server, from a quick listing (empty if it fails). */
    private function longIn(string $folder): array {
        static $seen = [];
        if (isset($seen[$folder])) return $seen[$folder];
        $out = []; $rc = 0;
        exec('timeout 90 ' . implode(' ', array_map('escapeshellarg', [$this->rclone, 'lsf', '-R', '--files-only', '--drive-skip-gdocs',
            $this->remote . ':' . $folder])) . ' 2>/dev/null', $out, $rc);
        $long = [];
        if ($rc === 0) foreach ($out as $rel) {
            foreach (explode('/', $rel) as $part) if (strlen($part) > self::MAX_NAME) { $long[] = $rel; break; }
        }
        return $seen[$folder] = $long;
    }
    // each part of the path that's too long becomes its first words (whole UTF-8 characters, ending at a
    // space where one is near), "~" and a tag from the full name, then its extension
    private function shorten(string $rel): string {
        return implode('/', array_map(function (string $part): string {
            if (strlen($part) <= self::MAX_NAME) return $part;
            $ext = pathinfo($part, PATHINFO_EXTENSION);
            $ext = $ext !== '' && strlen($ext) <= 5 ? '.' . $ext : '';
            $head = mb_strcut(substr($part, 0, strlen($part) - strlen($ext)), 0, 120, 'UTF-8');
            $sp = strrpos($head, ' ');
            if ($sp !== false && $sp > 60) $head = substr($head, 0, $sp);
            return rtrim($head, ' .,;:') . ' ~' . substr(sha1($part), 0, 6) . $ext;
        }, explode('/', $rel)));
    }
    /** The full Drive name of a file that came in shortened ("Rides/<rel>"), or null. */
    private function fullName(string $source): ?string {
        return $this->longNames()[$source] ?? null;
    }

    public function status(): array {
        $s = $this->state();
        $lines = is_file($this->log()) ? $this->tail($this->log(), 400) : [];
        $done = null; $progress = ''; $copied = []; $last = [];
        foreach ($lines as $l) {
            if (preg_match('/^STUDIO-DONE (\d+)/', $l, $m)) { $done = (int) $m[1]; continue; }
            if (preg_match('/INFO\s*:\s*(.+?): Copied \((new|replaced existing)\)/', $l, $m)) $copied[] = $m[1];
            elseif (preg_match('/NOTICE:\s*(.*\bETA\b.*)$/', $l, $m) || preg_match('/INFO\s*:\s*(.*\d+%.*ETA.*)$/', $l, $m)) $progress = trim($m[1]);
            elseif (trim($l) !== '' && !preg_match('/\bETA\b|: Copied \(|There was nothing to transfer/', $l)) $last[] = preg_replace('/^\d{4}\/\d\d\/\d\d \d\d:\d\d:\d\d\s+/', '', $l);
        }
        // its errors from the whole log, not just the end: a long copy logs a progress line every few seconds, which
        // pushes them out of the tail. ERROR lines, and the fatal ones rclone words otherwise (an expired Drive login,
        // a missing remote: CRITICAL, "Failed to ...", "Fatal error: ...")
        $errors = is_file($this->log()) ? $this->errorsIn($this->log()) : [];
        $running = $this->running($s);
        if (!$running && $done !== null && empty($s['finished']) && $s) {
            $s['finished'] = (int) filemtime($this->log()); $s['ok'] = $done === 0; $s['rc'] = $done;
            file_put_contents($this->stateFile(), json_encode($s), LOCK_EX);
        }
        $rc = isset($s['rc']) ? (int) $s['rc'] : $done;   // (a try saved before the code was kept: read back from the log)
        $failed = !$running && isset($s['ok']) && $s['ok'] === false;
        $clean = fn(string $t) => str_replace($this->home, '~', $t);
        return [
            'ready' => $this->problem() === null, 'problem' => $this->problem(),
            'folders' => $this->folders, 'running' => $running,
            'started' => $s['started'] ?? null, 'finished' => $s['finished'] ?? null, 'ok' => $s['ok'] ?? null,
            'progress' => $clean($progress),
            'copied' => array_map($clean, array_slice($copied, -40)), 'copiedCount' => count($copied),
            'errors' => $this->tidy(array_map($clean, $errors)),
            // when the last try failed: what rclone's exit code means, the fix for an expired Drive login, and, if no
            // error line explains it, rclone's last few lines
            'why' => $failed ? self::exitMeaning($rc) : null,
            'reconnect' => $failed && (bool) preg_grep('/token|oauth|invalid_grant|reconnect|unauthori[sz]ed|401/i', $errors),
            'remote' => $this->remote,
            'lastLines' => $failed && !$errors ? array_map($clean, array_slice($last, -4)) : [],
            'inbox' => $this->inbox(),
            'ignored' => array_map(fn($k, $v) => ['source' => $k] + $v, array_keys($this->ignored()), array_values($this->ignored())),
        ];
    }

    // What's on the server now, one item per note-to-be: each subfolder of a watched folder, and loose
    // files at its top level grouped by the day they were taken. Each item says what's in it and when its
    // newest file arrived, and which note it became (if any) and how many files came after that.
    private function inbox(): array {
        $out = []; $done = $this->processed(); $skip = $this->ignored();
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
        $out = array_values(array_filter($out, fn($x) => !isset($skip[$x['source']])));
        usort($out, fn($a, $b) => $b['arrived'] <=> $a['arrived']);
        return $out;
    }

    // ---------- folders set aside: hidden from the inbox for good, even if Drive copies them again ----------
    private function ignoreFile(): string { return studio_private_dir() . '/ignored.json'; }
    public function ignored(): array {
        $f = $this->ignoreFile();
        return is_file($f) ? (json_decode((string) file_get_contents($f), true) ?: []) : [];
    }
    /** Set an inbox item aside; with $drop, also delete the server's copy of a folder (Drive is untouched). */
    public function ignore(string $source, bool $drop): array {
        $r = $this->resolve($source);
        if ($r === null) throw new RuntimeException('That folder isn\'t in the inbox.');
        $all = $this->ignored();
        $all[$source] = ['at' => time(), 'dropped' => $drop && $r['day'] === null];
        file_put_contents($this->ignoreFile(), json_encode($all, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), LOCK_EX);
        if ($drop && $r['day'] === null) $this->removeTree($r['root']);
        return $this->status();
    }
    public function unignore(string $source): array {
        $all = $this->ignored(); unset($all[$source]);
        file_put_contents($this->ignoreFile(), json_encode($all, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), LOCK_EX);
        return $this->status();
    }
    // only ever a folder inside a watched folder's copy on this server (resolve() has checked that)
    private function removeTree(string $dir): void {
        $real = realpath($dir); $home = realpath($this->home . '/incoming');
        if (!$real || !$home || !str_starts_with($real, $home . '/') || substr_count(substr($real, strlen($home)), '/') < 2) return;
        $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($real, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($it as $f) $f->isDir() && !$f->isLink() ? @rmdir($f->getPathname()) : @unlink($f->getPathname());
        @rmdir($real);
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
        // when each photo was taken (to the second), so a drone's exposure bracket stays together
        foreach ($files as &$x) {
            if ($x['kind'] !== 'photo' || !preg_match('/\.jpe?g$/i', $x['name']) || !function_exists('exif_read_data')) continue;
            $e = @exif_read_data($r['root'] . '/' . $x['name']);
            $t = is_array($e) ? ($e['DateTimeOriginal'] ?? $e['DateTime'] ?? null) : null;
            if (is_string($t)) $x['taken'] = $t;
        }
        unset($x);
        foreach ($files as $x) {
            if ($x['kind'] !== 'text' || $x['bytes'] >= 65536) continue;
            $t = trim((string) file_get_contents($r['root'] . '/' . $x['name']));
            // a dictated note shortened on the way in: its words may only have been in its name
            $full = $r['day'] === null ? $this->fullName($source . '/' . $x['name']) : $this->fullName(explode('/', $source)[0] . '/' . $x['name']);
            if ($full !== null) {
                $said = trim(preg_replace('/\.(txt|md)$/i', '', basename($full)));
                if (!str_contains($t, mb_substr($said, 0, 60, 'UTF-8'))) $t = trim($said . "\n\n" . $t);
            }
            $notes[] = $t;
        }
        return ['source' => $source, 'files' => $files, 'notes' => implode("\n\n", array_filter($notes)),
            'note' => $this->processed()[$source] ?? null, 'day' => $r['day']];
    }

    // The real path of one file in an inbox item, or null (no climbing out of it).
    public function path(string $source, string $name): ?string {
        $r = $this->resolve($source);
        $root = $r['root'] ?? '';
        $path = $r === null ? false : realpath("$root/$name");
        if (!$path || !is_file($path) || !str_starts_with($path, $root . '/')) return null;
        if ($r['day'] !== null && (dirname($path) !== $root || $this->day($path) !== $r['day'])) return null;
        return $path;
    }

    // One photo, track or audio file from an inbox folder, sent to the logged-in Studio page (which resizes
    // photos, trims tracks and masters audio in the browser, as it does for dropped files). Videos stay
    // here: the page gets a small preview of them instead (lib/video.php).
    public function send(string $source, string $name): never {
        $path = $this->path($source, $name);
        if ($path === null) json_fail('No such file.', 404);
        $kind = self::kindOf($path, $path);
        if (!in_array($kind, ['photo', 'track', 'text', 'audio'], true)) json_fail('Only photos, tracks, notes and audio come through here.', 400);
        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        $type = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp', 'heic' => 'image/heic', 'heif' => 'image/heif',
            'wav' => 'audio/wav', 'mp3' => 'audio/mpeg', 'm4a' => 'audio/mp4'][$ext] ?? 'text/plain; charset=utf-8';
        studio_send_file($path, $type);
    }

    // the error lines in a whole log (read a line at a time, so a long one costs no memory), newest last
    private function errorsIn(string $file): array {
        $h = @fopen($file, 'r');
        if (!$h) return [];
        $out = [];
        while (($l = fgets($h)) !== false) {
            if (preg_match('/\b(?:ERROR|CRITICAL)\s*:\s*(.+)$/', $l, $m) || preg_match('/(?:^|\s)((?:Failed to |Fatal error: ).+)$/', $l, $m)) {
                $out[] = trim($m[1]);
                if (count($out) > 500) $out = array_slice($out, -200);
            }
        }
        fclose($h);
        return $out;
    }

    /** rclone's exit codes (its docs, "Exit Code"), in words. The script keeps the last step's failing code. */
    public static function exitMeaning(?int $rc): ?string {
        if ($rc === null || $rc === 0) return null;
        return [
            1 => 'rclone was started the wrong way (a usage error)',
            2 => 'an error rclone doesn\'t name more closely',
            3 => 'a folder wasn\'t found (is the Drive folder still there, under the same name?)',
            4 => 'a file wasn\'t found',
            5 => 'a passing error (the network, or Google limiting requests); trying again later usually works',
            6 => 'a less serious error, such as a file Google won\'t let be downloaded',
            7 => 'a fatal error, such as an expired Drive login or a remote that isn\'t set up',
            8 => 'the transfer limit was reached',
            9 => 'there was nothing to copy',
        ][$rc] ?? 'rclone stopped with code ' . $rc;
    }

    // rclone's errors, readable: each said once (its retries say it again), a long path cut short, newest last
    private function tidy(array $errors): array {
        $out = [];
        foreach ($errors as $e) {
            $e = preg_replace('/^Attempt \d+\/\d+ failed with \d+ errors? and: /', '', $e);
            $e = preg_replace_callback('/[^\/:]{100,}/u', fn($m) => mb_substr($m[0], 0, 50, 'UTF-8') . '…' . mb_substr($m[0], -20, null, 'UTF-8'), $e);
            $out[$e] = true;
        }
        return array_slice(array_keys($out), -6);
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
