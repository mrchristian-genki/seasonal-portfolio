<?php
/* STUDIO: site stats from the server's own access logs (no analytics on the pages, no cookies; privacy/index.html).
   DreamHost writes a log line for every request; this reads them, leaves out bots, the Studio and the files a page
   pulls in (styles, scripts, images), and keeps a summary for each day in ~/studio-private/stats/YYYY-MM-DD.json, so
   the history outlives DreamHost's log rotation. No IP address is kept: a visitor is a salted hash of address and
   browser, new every day (so a person can't be followed from one day to the next), and only its count is stored,
   plus a 6-letter tag in the last week's visitor log so one visit's pages read together.

   What a day holds: views (pages), visits (people that day), areas (Home, Field Notes, the Parts Catalog...), notes
   (each Note's page views, opened as a page or in place from Home: both fetch /play/<id>/), listens (people who
   started a Note's episode, from its MP3), refs (where page views came from, by site), feed (podcast app checks),
   bots (requests left out), and for the last week, log (its page views, newest last). */
declare(strict_types=1);

final class SiteStats
{
    const KEEP_LOG_DAYS = 7;       // the visitor log is kept this many days; the counts are kept for good
    const LOG_MAX = 400;           // page views kept in a day's visitor log
    const PAGES_MAX = 200;         // pages kept per day (the rest count toward their area)

    private string $dir;
    private string $home;

    public function __construct(private array $cfg)
    {
        $this->dir = studio_private_dir() . '/stats';
        $this->home = dirname(studio_private_dir());
    }

    /** The access logs this server keeps for the site: the config's stats_logs (a glob) if set, else DreamHost's
     *  ~/logs/<domain>/http{,s}/access.log* for this site's domain. */
    public function logFiles(): array
    {
        $globs = !empty($this->cfg['stats_logs']) ? (array) $this->cfg['stats_logs']
            : [$this->home . '/logs/*christiangehrke*/http/access.log*', $this->home . '/logs/*christiangehrke*/https/access.log*'];
        $out = [];
        foreach ($globs as $g) foreach (glob($g) ?: [] as $f) if (is_file($f) && is_readable($f)) $out[$f] = true;
        $files = array_keys($out);
        usort($files, fn($a, $b) => filemtime($a) <=> filemtime($b));
        return $files;
    }

    /** What the Studio can see: the log files (name, size, last change), and where it looked. */
    public function source(): array
    {
        $files = $this->logFiles();
        return [
            'found' => (bool) $files,
            'looked' => !empty($this->cfg['stats_logs']) ? (array) $this->cfg['stats_logs'] : ['~/logs/<this site>/http/access.log*', '~/logs/<this site>/https/access.log*'],
            'logsDir' => is_dir($this->home . '/logs') ? array_values(array_map('basename', glob($this->home . '/logs/*', GLOB_ONLYDIR) ?: [])) : null,
            'files' => array_map(fn($f) => ['name' => str_replace($this->home, '~', $f), 'bytes' => filesize($f), 'changed' => filemtime($f)], $files),
        ];
    }

    /** Brings the summaries up to date: every day the logs hold that isn't summed up for good yet. A day is final
     *  once it's two days old (the logs have rotated past it); until then it's summed up again each time. */
    public function update(): array
    {
        if (!is_dir($this->dir) && !@mkdir($this->dir, 0700, true)) throw new RuntimeException('The Studio can\'t make its stats folder (' . $this->dir . ').');
        $lock = fopen($this->dir . '/.lock', 'c');
        if (!$lock || !flock($lock, LOCK_EX)) throw new RuntimeException('The stats are being updated; try again in a moment.');
        try {
            $files = $this->logFiles();
            if (!$files) return ['days' => 0];
            $final = $this->finalDays();
            $cutoff = strtotime('today -1 day');            // days from yesterday on are summed up again
            // only the files written since the last day summed up for good (a file holding a later day was written
            // on or after it); on the first run, every file
            $last = $final ? max(array_keys($final)) : null;
            $from = $last ? strtotime($last . ' +1 day') : 0;
            $read = array_values(array_filter($files, fn($f) => filemtime($f) >= $from));
            $days = [];
            foreach ($read as $f) $this->readFile($f, $days, $final);
            foreach ($days as $d => $acc) $this->save($d, $acc, strtotime($d) < $cutoff);
            $this->prune();
            return ['days' => count($days)];
        } finally {
            flock($lock, LOCK_UN); fclose($lock);
        }
    }

    /** The summaries from $since (YYYY-MM-DD) on, oldest first. */
    public function days(string $since): array
    {
        $out = [];
        foreach (glob($this->dir . '/????-??-??.json') ?: [] as $f) {
            $d = basename($f, '.json');
            if ($d < $since) continue;
            $j = json_decode((string) file_get_contents($f), true);
            if (!is_array($j)) continue;
            unset($j['final'], $j['pages']);   // pages stay on the server for later; the Stats tab doesn't use them
            if ($d < date('Y-m-d', strtotime('today -' . (self::KEEP_LOG_DAYS - 1) . ' days'))) unset($j['log']);
            $out[] = ['date' => $d] + $j;
        }
        return $out;
    }

    // the days already summed up for good, as a set
    private function finalDays(): array
    {
        $out = [];
        foreach (glob($this->dir . '/????-??-??.json') ?: [] as $f) {
            $j = json_decode((string) file_get_contents($f), true);
            if (!empty($j['final'])) $out[basename($f, '.json')] = true;
        }
        return $out;
    }

    // a day's salt: a secret kept in the stats folder, mixed with the date, so a visitor's hash is new every day
    private function salt(string $day): string
    {
        static $secret = null;
        if ($secret === null) {
            $f = $this->dir . '/.secret';
            if (!is_file($f)) { file_put_contents($f, bin2hex(random_bytes(32))); @chmod($f, 0600); }
            $secret = trim((string) file_get_contents($f));
        }
        return hash('sha256', $secret . $day);
    }

    private function readFile(string $file, array &$days, array $final): void
    {
        $h = str_ends_with($file, '.gz') ? @gzopen($file, 'rb') : @fopen($file, 'rb');
        if (!$h) return;
        $gets = str_ends_with($file, '.gz') ? 'gzgets' : 'fgets';
        while (($line = $gets($h)) !== false) {
            $r = self::parse($line);
            if (!$r || isset($final[$r['day']])) continue;
            $this->add($days, $r);
        }
        str_ends_with($file, '.gz') ? gzclose($h) : fclose($h);
    }

    /** One line of an Apache "combined" log (DreamHost's), with or without a leading host:
     *  1.2.3.4 - - [13/Oct/2026:13:55:03 -0700] "GET /play/ HTTP/1.1" 200 1234 "https://ref/" "Mozilla/5.0 ..." */
    public static function parse(string $line): ?array
    {
        if (!preg_match('~^(?:\S+\s+)?(\S+) \S+ \S+ \[(\d{2})/(\w{3})/(\d{4}):(\d{2}):(\d{2}):\d{2} [+-]\d{4}\] "(\w+) (\S+)[^"]*" (\d{3}) \S+(?: "([^"]*)" "([^"]*)")?~', $line, $m)) return null;
        $mon = ['Jan' => 1, 'Feb' => 2, 'Mar' => 3, 'Apr' => 4, 'May' => 5, 'Jun' => 6, 'Jul' => 7, 'Aug' => 8, 'Sep' => 9, 'Oct' => 10, 'Nov' => 11, 'Dec' => 12][$m[3]] ?? 0;
        if (!$mon) return null;
        return ['ip' => $m[1], 'day' => sprintf('%04d-%02d-%02d', $m[4], $mon, $m[2]), 'time' => $m[5] . ':' . $m[6], 'method' => $m[7],
            'url' => $m[8], 'status' => (int) $m[9], 'ref' => $m[10] ?? '', 'ua' => $m[11] ?? ''];
    }

    /** What a request is: a page in an area (with its Note, if it's one), an episode, the feed, or nothing to count. */
    public static function classify(string $url): ?array
    {
        $path = strtolower(rawurldecode((string) parse_url($url, PHP_URL_PATH)));
        if ($path === '' || str_contains($path, '..')) return null;
        if (preg_match('~^/play/media/([a-z0-9-]+)/episode\.mp3$~', $path, $m)) return ['type' => 'listen', 'note' => $m[1]];
        if ($path === '/play/feed.xml') return ['type' => 'feed'];
        // pages only: a folder, an .html file, or share.php (a shared link); never the Studio or the private tools
        if (!preg_match('~(/|\.html|^/share\.php)$~', $path)) return null;
        if (preg_match('~^/(studio|field|propre-ai)\b~', $path)) return null;
        $path = preg_replace('~index\.html$~', '', $path);
        if (preg_match('~^/play/(\d{4}-\d{2}-\d{2}-[a-z0-9-]+)/$~', $path, $m)) return ['type' => 'page', 'area' => 'Field Notes', 'path' => $path, 'note' => $m[1]];
        $areas = ['/play/' => 'Field Notes', '/catalog/' => 'Parts Catalog', '/web/' => 'The Tumble', '/books/' => 'Books', '/about/' => 'About',
            '/privacy/' => 'Privacy', '/propre/' => 'Propre', '/share.php' => 'Shared links'];
        $area = $path === '/' ? 'Home' : 'Other';
        foreach ($areas as $p => $a) if (str_starts_with($path, $p)) { $area = $a; break; }
        // Home's address words open its tabs: ?workshop, ?about, ?notes+<a Note>, ?play (js/ws-cards.js, js/play-inline.js)
        if ($area === 'Home') {
            $q = strtolower(rawurldecode((string) parse_url($url, PHP_URL_QUERY)));
            $w = preg_split('~[+&,;\s=]+~', $q, -1, PREG_SPLIT_NO_EMPTY) ?: [];
            if (in_array('workshop', $w, true)) $area = 'Workshop';
        }
        return ['type' => 'page', 'area' => $area, 'path' => $path];
    }

    public static function isBot(string $ua): bool
    {
        return $ua === '' || $ua === '-' || (bool) preg_match('~bot|crawl|spider|slurp|scrap|fetch|preview|monitor|uptime|curl|wget|python|httpclient|okhttp|go-http|java/|libwww|headless|lighthouse|facebookexternalhit|embedly|whatsapp|discord|telegram|skype|validator|feed|rss|pingdom|ahrefs|semrush|bing|yandex|baidu|duckduck|petal|bytespider|gptbot|claude|perplexity|ccbot|dataforseo|mj12|zgrab|masscan|nmap|nikto|sqlmap~i', $ua);
    }

    // podcast apps fetch the feed and the episodes; they're people listening, not bots
    public static function isPodcastApp(string $ua): bool
    {
        return (bool) preg_match('~podcast|applecoremedia|itunes|overcast|pocket ?casts|castro|castbox|spotify|antennapod|podcastaddict|stitcher|player fm|downcast|gpodder~i', $ua);
    }

    // a short, readable browser and device: "Safari · phone"
    public static function agent(string $ua): string
    {
        $b = preg_match('~Edg/~', $ua) ? 'Edge' : (preg_match('~OPR/|Opera~', $ua) ? 'Opera' : (preg_match('~Firefox/|FxiOS~', $ua) ? 'Firefox'
            : (preg_match('~Chrome/|CriOS~', $ua) ? 'Chrome' : (preg_match('~Safari/~', $ua) ? 'Safari' : (self::isPodcastApp($ua) ? 'Podcast app' : 'Other')))));
        $d = preg_match('~iPad|Tablet~', $ua) ? 'tablet' : (preg_match('~Mobile|iPhone|Android~', $ua) ? 'phone' : 'computer');
        return $b . ' · ' . $d;
    }

    // where a page view came from: another site's host, or nothing for a visit from inside the site or typed in
    private static function refHost(string $ref): string
    {
        if ($ref === '' || $ref === '-') return '';
        $h = strtolower((string) parse_url($ref, PHP_URL_HOST));
        $h = preg_replace('~^(www\.|m\.|l\.|lm\.)~', '', $h);
        if ($h === '' || str_ends_with($h, 'christiangehrke.com')) return '';
        if (preg_match('~(^|\.)google\.~', $h)) return 'Google';
        if (preg_match('~(^|\.)bing\.com$~', $h)) return 'Bing';
        if (preg_match('~(^|\.)duckduckgo\.com$~', $h)) return 'DuckDuckGo';
        if (preg_match('~(^|\.)(facebook\.com|fb\.me)$~', $h)) return 'Facebook';
        if (preg_match('~(^|\.)instagram\.com$~', $h)) return 'Instagram';
        if (preg_match('~(^|\.)(t\.co|twitter\.com|x\.com)$~', $h)) return 'X';
        if (preg_match('~(^|\.)linkedin\.com$|^lnkd\.in$~', $h)) return 'LinkedIn';
        if (preg_match('~(^|\.)reddit\.com$~', $h)) return 'Reddit';
        if (preg_match('~(^|\.)github\.com$~', $h)) return 'GitHub';
        return $h;
    }

    private function add(array &$days, array $r): void
    {
        $c = self::classify($r['url']);
        if (!$c || $r['method'] !== 'GET') return;
        $d = $r['day'];
        $acc = &$days[$d];
        $acc ??= ['views' => 0, 'v' => [], 'areas' => [], 'av' => [], 'pages' => [], 'notes' => [], 'listens' => [], 'refs' => [], 'feed' => 0, 'bots' => 0, 'log' => []];
        $pod = self::isPodcastApp($r['ua']);
        if (self::isBot($r['ua']) && !$pod) { $acc['bots']++; return; }
        $who = substr(hash('sha256', $this->salt($d) . '|' . $r['ip'] . '|' . $r['ua']), 0, 16);
        if ($c['type'] === 'feed') { if ($r['status'] < 400) $acc['feed']++; return; }
        if ($c['type'] === 'listen') {   // an episode: one listen per person per day, however many pieces the player asks for
            if ($r['status'] === 200 || $r['status'] === 206 || $r['status'] === 304) $acc['listens'][$c['note']][$who] = true;
            return;
        }
        if ($r['status'] !== 200 && $r['status'] !== 304) return;
        $acc['views']++;
        $acc['v'][$who] = true;
        $a = $c['area'];
        $acc['areas'][$a] = ($acc['areas'][$a] ?? 0) + 1;
        $acc['av'][$a][$who] = true;
        $acc['pages'][$c['path']] = ($acc['pages'][$c['path']] ?? 0) + 1;
        if (!empty($c['note'])) $acc['notes'][$c['note']] = ($acc['notes'][$c['note']] ?? 0) + 1;
        $ref = self::refHost($r['ref']);
        if ($ref !== '') $acc['refs'][$ref] = ($acc['refs'][$ref] ?? 0) + 1;
        $acc['log'][] = [$r['time'], $c['path'] . ($a === 'Workshop' ? '?workshop' : ''), $ref, self::agent($r['ua']), substr($who, 0, 6)];
    }

    // a day's tallies, saved: sets become counts, the longest lists are cut to their top entries
    private function save(string $day, array $acc, bool $final): void
    {
        arsort($acc['pages']); arsort($acc['refs']); arsort($acc['notes']);
        $areas = [];
        foreach ($acc['areas'] as $a => $n) $areas[$a] = ['views' => $n, 'visits' => count($acc['av'][$a] ?? [])];
        uasort($areas, fn($x, $y) => $y['views'] <=> $x['views']);
        $keepLog = $day >= date('Y-m-d', strtotime('today -' . (self::KEEP_LOG_DAYS - 1) . ' days'));
        $out = [
            'views' => $acc['views'], 'visits' => count($acc['v']), 'areas' => $areas,
            'pages' => array_slice($acc['pages'], 0, self::PAGES_MAX, true), 'notes' => $acc['notes'],
            'listens' => array_map('count', $acc['listens']), 'refs' => array_slice($acc['refs'], 0, 100, true),
            'feed' => $acc['feed'], 'bots' => $acc['bots'],
            'log' => $keepLog ? array_slice($acc['log'], -self::LOG_MAX) : [],
            'final' => $final,
        ];
        $f = $this->dir . '/' . $day . '.json';
        file_put_contents($f . '.tmp', json_encode($out, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), LOCK_EX);
        rename($f . '.tmp', $f);
        @chmod($f, 0600);
    }

    /** Takes the visitor log out of summaries older than a week (the counts stay). */
    public function prune(): void
    {
        $old = date('Y-m-d', strtotime('today -' . self::KEEP_LOG_DAYS . ' days'));
        foreach (glob($this->dir . '/????-??-??.json') ?: [] as $f) {
            if (basename($f, '.json') >= $old) continue;
            $j = json_decode((string) file_get_contents($f), true);
            if (!is_array($j) || empty($j['log'])) continue;
            $j['log'] = [];
            file_put_contents($f, json_encode($j, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), LOCK_EX);
        }
    }
}
