<?php
/* STUDIO VIDEO: short silent loops trimmed from the videos that came in from Drive. The videos stay on
   this server: ffmpeg makes a small preview to scrub through in the browser, then cuts the chosen part
   into the loop Play shows (960 px on the long edge, H.264, no sound, starts fast) with a poster frame.
   iPhone HDR video is toned down to ordinary colour so it doesn't come out grey and washed out.

   ffmpeg lives at ~/bin/ffmpeg (see studio/README.md). Its work sits in ~/studio-private/video and is
   cleared after two weeks; a loop goes to the repo only with the note's next Save. */
declare(strict_types=1);

final class Video {
    public const MAX_SEC = 30;          // a loop is short; a longer edit belongs on YouTube with its sound
    private string $ffmpeg;
    private string $tz;

    public function __construct(array $cfg) {
        $this->ffmpeg = $cfg['ffmpeg'] ?? dirname(studio_private_dir()) . '/bin/ffmpeg';
        $this->tz = $cfg['timezone'] ?? 'America/Los_Angeles';
    }

    private function dir(): string {
        $d = studio_private_dir() . '/video';
        if (!is_dir($d)) mkdir($d, 0700, true);
        return $d;
    }

    public function problem(): ?string {
        $off = array_map('trim', explode(',', (string) ini_get('disable_functions')));
        if (!function_exists('exec') || in_array('exec', $off, true)) return "This server doesn't let the Studio start programs (PHP exec is off).";
        if (!is_file($this->ffmpeg) || !is_executable($this->ffmpeg)) return 'ffmpeg isn\'t installed at ~/bin/ffmpeg yet (see the Studio README).';
        return null;
    }

    // one key per video file (its path, size and date), so a replaced file gets a new preview
    public static function key(string $path): string {
        $st = stat($path);
        return substr(sha1($path . "\0" . $st['size'] . "\0" . $st['mtime']), 0, 16);
    }

    // What ffmpeg says about a video: length, size as shown (after rotation), HDR or not, when it was taken.
    public function probe(string $path): array {
        $cache = $this->dir() . '/' . self::key($path) . '.json';
        if (is_file($cache)) return json_decode((string) file_get_contents($cache), true);
        $out = [];
        exec(escapeshellarg($this->ffmpeg) . ' -hide_banner -i ' . escapeshellarg($path) . ' 2>&1', $out);
        $txt = implode("\n", $out);
        $sec = preg_match('/Duration: (\d+):(\d+):([\d.]+)/', $txt, $m) ? $m[1] * 3600 + $m[2] * 60 + (float) $m[3] : 0.0;
        $w = $h = 0; $hdr = false;
        if (preg_match('/Stream #[^\n]*Video:([^\n]*)/', $txt, $v)) {
            if (preg_match('/, (\d{2,5})x(\d{2,5})/', $v[1], $s)) { $w = (int) $s[1]; $h = (int) $s[2]; }
            $hdr = (bool) preg_match('/arib-std-b67|smpte2084/', $v[1]);
        }
        $rot = preg_match('/rotation of (-?[\d.]+) degrees/', $txt, $r) ? (float) $r[1] : (preg_match('/rotate\s*:\s*(-?\d+)/', $txt, $r) ? (float) $r[1] : 0.0);
        if (((int) round(abs($rot))) % 180 === 90) [$w, $h] = [$h, $w];
        $taken = null;
        if (preg_match('/creation_time\s*:\s*(\d{4}-\d{2}-\d{2}T[\d:.]+Z)/', $txt, $c)) {
            $taken = (new DateTime($c[1]))->setTimezone(new DateTimeZone($this->tz))->format('Y:m:d H:i:s');
        }
        $info = ['sec' => round($sec, 2), 'w' => $w, 'h' => $h, 'hdr' => $hdr, 'taken' => $taken];
        if ($sec > 0) file_put_contents($cache, json_encode($info));
        return $info;
    }

    // HDR (HLG or PQ) to ordinary colour, then the size; the same chain for the preview and the loop
    private function filters(array $info, int $long): string {
        $f = [];
        if ($info['hdr']) $f[] = 'zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv';
        $f[] = "scale='if(gte(iw,ih),min($long,iw),-2)':'if(gte(iw,ih),-2,min($long,ih))'";
        $f[] = 'format=yuv420p';
        return implode(',', $f);
    }

    // Starts a job in the background unless it's running or done. Its log ends with "STUDIO-DONE <code>".
    private function run(string $name, array $cmds): void {
        $d = $this->dir(); $log = "$d/$name.log";
        $this->sweep();
        // one thread each for decoding, filtering and encoding: shared hosting caps how many threads an
        // account may start (ffmpeg and x264 would otherwise start one per core of a big server, and x264 fails
        // to open when it can't). The account's limits head the log, in case a job still fails.
        $sh = 'echo "limits: $(grep -E \'Max (processes|address space)\' /proc/self/limits | tr -s \' \' | tr \'\\n\' \';\'), running $(ps -u $(id -u) -L 2>/dev/null | wc -l) threads"; rc=0; ' . implode(' && ', array_map(fn($c) => implode(' ', array_map('escapeshellarg', $c)), $cmds)) .
            ' || rc=$?; echo "STUDIO-DONE $rc" >> ' . escapeshellarg($log);
        file_put_contents($log, '');
        exec('nohup nice -n 10 sh -c ' . escapeshellarg($sh) . ' >> ' . escapeshellarg($log) . ' 2>&1 &');
    }

    private function tail(string $log): string {
        $n = filesize($log); $h = fopen($log, 'r'); fseek($h, max(0, $n - 4096)); $t = (string) stream_get_contents($h); fclose($h);
        return $t;
    }

    // how a job is doing: running (with how far along), done, or failed (with ffmpeg's last words)
    private function state(string $name, float $sec, string $out): array {
        $log = $this->dir() . "/$name.log";
        if (is_file($out) && (!is_file($log) || str_contains($this->tail($log), 'STUDIO-DONE 0'))) return ['state' => 'ready'];
        if (!is_file($log)) return ['state' => 'none'];
        $t = $this->tail($log);
        if (preg_match('/STUDIO-DONE (\d+)/', $t, $m) && $m[1] !== '0') {
            $lines = array_values(array_filter(array_map('trim', preg_split('/[\r\n]+/', $t)), fn($l) => $l !== '' && !str_starts_with($l, 'STUDIO-DONE')));
            // ffmpeg's last words are only "Conversion failed!": the first error line says why
            $why = '';
            foreach ($lines as $l) if ($why === '' && preg_match('/error|invalid|unable|cannot|could not|not supported|resource|killed|no such|denied|failed/i', $l) && !preg_match('/^Conversion failed/i', $l)) $why = $l;
            return ['state' => 'failed', 'error' => substr($why !== '' ? $why : (string) end($lines), 0, 240),
                'log' => array_map(fn($l) => substr(str_replace(dirname(studio_private_dir()), '~', $l), 0, 240),
                    array_merge(array_slice(file($log, FILE_IGNORE_NEW_LINES) ?: [], 0, 1), array_slice($lines, -24)))];
        }
        $pct = 0;
        if ($sec > 0 && preg_match_all('/time=(\d+):(\d+):([\d.]+)/', $t, $mm)) {
            $k = count($mm[0]) - 1;
            $pct = min(99, (int) round(($mm[1][$k] * 3600 + $mm[2][$k] * 60 + (float) $mm[3][$k]) / $sec * 100));
        }
        return ['state' => 'working', 'pct' => $pct];
    }

    // The preview: small and with a keyframe every half second, so scrubbing is quick on a phone.
    public function preview(string $path, bool $retry = false): array {
        if ($p = $this->problem()) throw new RuntimeException($p);
        $info = $this->probe($path);
        if (!$info['sec']) throw new RuntimeException('ffmpeg couldn\'t read that video.');
        $k = self::key($path); $out = $this->dir() . "/$k.preview.mp4";
        $s = $this->state("$k.preview", $info['sec'], $out);
        if ($s['state'] === 'failed' && $retry) { @unlink($this->dir() . "/$k.preview.log"); $s = ['state' => 'none']; }
        if ($s['state'] === 'none') {
            $this->run("$k.preview", [[$this->ffmpeg, '-hide_banner', '-nostdin', '-y', '-threads', '1', '-i', $path, '-an', '-filter_threads', '1', '-vf', $this->filters($info, 640),
                '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-g', '15', '-x264-params', 'threads=1:lookahead-threads=1:sliced-threads=0', '-threads', '1', '-movflags', '+faststart', "$out.part.mp4"],
                ['mv', "$out.part.mp4", $out]]);
            $s = ['state' => 'working', 'pct' => 0];
        }
        return ['key' => $k, 'info' => $info] + $s;
    }

    // The loop itself, from..to seconds: cut, toned, sized, silent, and its first frame as the poster.
    public function loop(string $path, float $from, float $to, bool $retry = false): array {
        if ($p = $this->problem()) throw new RuntimeException($p);
        $info = $this->probe($path);
        $from = max(0.0, $from); $to = min($info['sec'], $to);
        if ($to - $from < 0.5) throw new RuntimeException('The loop needs to be at least half a second long.');
        if ($to - $from > self::MAX_SEC + 0.05) throw new RuntimeException('A loop can be ' . self::MAX_SEC . ' seconds at most.');
        $tok = self::key($path) . '-' . (int) round($from * 1000) . '-' . (int) round($to * 1000);
        $d = $this->dir(); $out = "$d/$tok.mp4";
        $s = $this->state($tok, $to - $from, $out);
        if ($s['state'] === 'failed' && $retry) { @unlink("$d/$tok.log"); $s = ['state' => 'none']; }
        if ($s['state'] === 'none') {
            $this->run($tok, [
                [$this->ffmpeg, '-hide_banner', '-nostdin', '-y', '-ss', sprintf('%.3f', $from), '-threads', '1', '-i', $path, '-t', sprintf('%.3f', $to - $from),
                    '-filter_threads', '1', '-an', '-sn', '-dn', '-map_metadata', '-1', '-vf', $this->filters($info, 960), '-c:v', 'libx264', '-preset', 'slow', '-crf', '23',
                    '-profile:v', 'high', '-x264-params', 'threads=1:lookahead-threads=1:sliced-threads=0', '-threads', '1', '-movflags', '+faststart', "$out.part.mp4"],
                // the poster: the most representative frame of the loop (ffmpeg's thumbnail pick), not just the first
                [$this->ffmpeg, '-hide_banner', '-nostdin', '-y', '-threads', '1', '-i', "$out.part.mp4", '-vf', 'thumbnail=' . max(2, min(300, (int) round(($to - $from) * 30))), '-frames:v', '1', '-q:v', '3', "$d/$tok.jpg"],
                ['mv', "$out.part.mp4", $out]]);
            $s = ['state' => 'working', 'pct' => 0];
        }
        $r = ['token' => $tok] + $s;
        if ($s['state'] === 'ready') {
            $x = $this->dims($out);
            $r += ['w' => $x[0], 'h' => $x[1], 'bytes' => filesize($out), 'sec' => round($to - $from, 2),
                'taken' => $this->later($info['taken'], $from)];
        }
        return $r;
    }

    private function dims(string $mp4): array {
        $out = [];
        exec(escapeshellarg($this->ffmpeg) . ' -hide_banner -i ' . escapeshellarg($mp4) . ' 2>&1', $out);
        return preg_match('/Video:[^\n]*?, (\d{2,5})x(\d{2,5})/', implode("\n", $out), $m) ? [(int) $m[1], (int) $m[2]] : [0, 0];
    }

    private function later(?string $taken, float $sec): ?string {
        if (!$taken) return null;
        $t = DateTime::createFromFormat('Y:m:d H:i:s', $taken, new DateTimeZone($this->tz));
        return $t ? $t->modify('+' . (int) $sec . ' seconds')->format('Y:m:d H:i:s') : $taken;
    }

    // a finished loop (or its poster, or a preview) by its token, for the page and for the Save
    public function file(string $tok, string $what): ?string {
        if (!preg_match('/^[0-9a-f]{16}(-\d{1,9}-\d{1,9})?$/', $tok)) return null;
        $f = $this->dir() . '/' . $tok . ['loop' => '.mp4', 'poster' => '.jpg', 'preview' => '.preview.mp4'][$what];
        return is_file($f) ? $f : null;
    }

    // work older than two weeks goes
    private function sweep(): void {
        foreach (glob($this->dir() . '/*') ?: [] as $f) if (is_file($f) && filemtime($f) < time() - 14 * 86400) @unlink($f);
    }
}
