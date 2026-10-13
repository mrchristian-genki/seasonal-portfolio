<?php
/* STUDIO: the site's health, checked from the server itself for the Stats tab (api.php stats; studio.js drawHealth).
   Each check says good, warn or bad, with a line in plain words and, where there's one, what to do:
     domain       when christiangehrke.com's registration runs out (RDAP, the public registry lookup)
     certificate  the HTTPS certificate each name gets, valid and for how long (a real connection, as a browser makes)
     redirect     plain http:// sent on to https://www (both names, a page kept)
     hsts         browsers told to always use https (Strict-Transport-Security)
     email        SPF, DKIM and DMARC: the DNS records that stop others sending mail as the domain
     disk         how much the Studio's own folders hold on the server
   They reach out to the network, so the answers are kept a few hours (~/studio-private/health.json); "Check again"
   asks afresh. The config's site_domain (default christiangehrke.com) and dkim_selector (default dreamhost) set them. */
declare(strict_types=1);

final class SiteHealth
{
    const KEEP = 21600;   // seconds the answers are kept: six hours

    private string $domain;
    private string $www;
    private string $home;

    public function __construct(private array $cfg)
    {
        $this->domain = strtolower((string) ($cfg['site_domain'] ?? 'christiangehrke.com'));
        $this->www = 'www.' . $this->domain;
        $this->home = dirname(studio_private_dir());
    }

    private function file(): string { return studio_private_dir() . '/health.json'; }

    /** The checks, kept or (if old, or asked) made afresh. */
    public function report(bool $fresh = false): array
    {
        $f = $this->file();
        $kept = is_file($f) ? json_decode((string) file_get_contents($f), true) : null;
        if (!$fresh && is_array($kept) && time() - (int) ($kept['at'] ?? 0) < self::KEEP) return $kept;
        $checks = [];
        foreach (['domain', 'certificate', 'redirect', 'hsts', 'email', 'disk'] as $k) {
            try { $checks[] = ['id' => $k] + $this->$k(); }
            catch (Throwable $e) { $checks[] = ['id' => $k, 'label' => ucfirst($k), 'state' => 'warn', 'say' => 'Couldn\'t check: ' . $e->getMessage()]; }
        }
        $out = ['at' => time(), 'checks' => $checks];
        @file_put_contents($f, json_encode($out, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), LOCK_EX);
        return $out;
    }

    private static function days(int $t): int { return (int) floor(($t - time()) / 86400); }
    private static function day(int $t): string { return date('M j, Y', $t); }

    // a URL fetched without following redirects: [status, headers (lowercase name => value), body]
    private static function fetch(string $url, string $method = 'GET'): array
    {
        $ctx = stream_context_create(['http' => ['method' => $method, 'follow_location' => 0, 'max_redirects' => 1, 'ignore_errors' => true, 'timeout' => 8,
            'header' => "User-Agent: christiangehrke.com Studio health check\r\nAccept: application/json, text/html\r\n"], 'ssl' => ['verify_peer' => true, 'verify_peer_name' => true]]);
        $body = @file_get_contents($url, false, $ctx);
        $hdr = $http_response_header ?? [];
        if (!$hdr) throw new RuntimeException('no answer from ' . parse_url($url, PHP_URL_HOST));
        $status = preg_match('~^HTTP/\S+\s+(\d{3})~', $hdr[0], $m) ? (int) $m[1] : 0;
        $h = [];
        foreach (array_slice($hdr, 1) as $l) if (strpos($l, ':') !== false) { [$k, $v] = explode(':', $l, 2); $h[strtolower(trim($k))] = trim($v); }
        return [$status, $h, $body === false ? '' : $body];
    }

    private function domain(): array
    {
        $tld = substr(strrchr($this->domain, '.'), 1);
        $urls = $tld === 'com' || $tld === 'net' ? ["https://rdap.verisign.com/$tld/v1/domain/{$this->domain}"] : [];
        $urls[] = "https://rdap.org/domain/{$this->domain}";
        foreach ($urls as $u) {
            try { [$st, , $body] = self::fetch($u); } catch (Throwable $e) { continue; }
            $j = json_decode($body, true);
            if ($st !== 200 || !is_array($j)) continue;
            $exp = null; $reg = '';
            foreach ($j['events'] ?? [] as $e) if (($e['eventAction'] ?? '') === 'expiration') $exp = strtotime((string) $e['eventDate']);
            foreach ($j['entities'] ?? [] as $e) if (in_array('registrar', $e['roles'] ?? [], true)) {
                foreach ($e['vcardArray'][1] ?? [] as $v) if (($v[0] ?? '') === 'fn') $reg = (string) $v[3];
            }
            if (!$exp) break;
            $d = self::days($exp);
            return ['label' => 'Domain renewal', 'state' => $d < 15 ? 'bad' : ($d < 60 ? 'warn' : 'good'),
                'say' => $this->domain . ' is registered until ' . self::day($exp) . ' (' . $d . ' days)' . ($reg ? ', with ' . $reg : '') . '.',
                'todo' => $d < 60 ? 'Renew it with ' . ($reg ?: 'the registrar') . ', or check that auto-renew is on.' : null];
        }
        return ['label' => 'Domain renewal', 'state' => 'warn', 'say' => 'The registry didn\'t say when ' . $this->domain . ' runs out.'];
    }

    // the certificate a browser gets for one name: [valid, its details or the error]
    private static function cert(string $host): array
    {
        $ctx = stream_context_create(['ssl' => ['capture_peer_cert' => true, 'verify_peer' => true, 'verify_peer_name' => true, 'peer_name' => $host, 'SNI_enabled' => true]]);
        $s = @stream_socket_client("ssl://$host:443", $no, $err, 8, STREAM_CLIENT_CONNECT, $ctx);
        $ok = (bool) $s;
        if (!$s) {   // not trusted: look again without checking, to say what's wrong with it
            $ctx = stream_context_create(['ssl' => ['capture_peer_cert' => true, 'verify_peer' => false, 'verify_peer_name' => false, 'peer_name' => $host, 'SNI_enabled' => true]]);
            $s = @stream_socket_client("ssl://$host:443", $no2, $err2, 8, STREAM_CLIENT_CONNECT, $ctx);
            if (!$s) return [false, ['error' => $err ?: $err2 ?: 'no connection']];
        }
        $c = stream_context_get_params($s)['options']['ssl']['peer_certificate'] ?? null;
        fclose($s);
        $x = $c ? openssl_x509_parse($c) : null;
        if (!$x) return [false, ['error' => 'no certificate came back']];
        $names = array_map(fn($n) => strtolower(trim(substr($n, 4))), array_filter(explode(',', (string) ($x['extensions']['subjectAltName'] ?? '')), fn($n) => str_starts_with(trim($n), 'DNS:')));
        return [$ok, ['to' => (int) $x['validTo_time_t'], 'from' => (int) $x['validFrom_time_t'], 'issuer' => (string) ($x['issuer']['O'] ?? $x['issuer']['CN'] ?? ''), 'names' => array_values($names), 'error' => $ok ? '' : ($err ?: 'not trusted')]];
    }

    private function certificate(): array
    {
        $bad = []; $soonest = null; $issuer = '';
        foreach ([$this->www, $this->domain] as $h) {
            [$ok, $c] = self::cert($h);
            if (!$ok) { $bad[] = $h . ': ' . ($c['error'] ?? 'not trusted') . (!empty($c['names']) ? ' (it names ' . implode(', ', $c['names']) . ')' : '') . (!empty($c['to']) && $c['to'] < time() ? ' (it ran out ' . self::day($c['to']) . ')' : ''); continue; }
            $issuer = $c['issuer'];
            if ($soonest === null || $c['to'] < $soonest) $soonest = $c['to'];
        }
        if ($bad) return ['label' => 'HTTPS certificate', 'state' => 'bad', 'say' => 'A browser wouldn\'t trust the certificate for ' . implode('; ', $bad) . '.',
            'todo' => 'In the DreamHost panel, under Websites, Secure Certificates, re-add the free Let\'s Encrypt certificate for both names.'];
        $d = self::days($soonest);
        return ['label' => 'HTTPS certificate', 'state' => $d < 7 ? 'bad' : ($d < 21 ? 'warn' : 'good'),
            'say' => 'Valid for ' . $this->www . ' and ' . $this->domain . ' until ' . self::day($soonest) . ' (' . $d . ' days)' . ($issuer ? ', from ' . $issuer : '') . '.' . ($issuer === "Let's Encrypt" ? ' It renews itself about a month before.' : ''),
            'todo' => $d < 21 ? 'It should have renewed by now: check Secure Certificates in the DreamHost panel.' : null];
    }

    private function redirect(): array
    {
        $want = 'https://' . $this->www;
        $bad = [];
        foreach (["http://{$this->domain}/play/", "http://{$this->www}/play/", "https://{$this->domain}/play/"] as $u) {
            [$st, $h] = self::fetch($u, 'HEAD');
            $loc = $h['location'] ?? '';
            if (!in_array($st, [301, 308], true) || $loc !== $want . '/play/') $bad[] = $u . ' gives ' . $st . ($loc ? ' to ' . $loc : '');
        }
        return $bad ? ['label' => 'Redirect to HTTPS', 'state' => 'bad', 'say' => 'Not every address is sent on to ' . $want . ': ' . implode('; ', $bad) . '.',
                'todo' => 'In the DreamHost panel, turn on "Redirect HTTP to HTTPS" for the site and pick the www version.']
            : ['label' => 'Redirect to HTTPS', 'state' => 'good', 'say' => 'http:// and the name without www go to ' . $want . ', with the page kept, for good (301).'];
    }

    private function hsts(): array
    {
        [$st, $h] = self::fetch('https://' . $this->www . '/studio/', 'HEAD');
        $v = $h['strict-transport-security'] ?? '';
        $age = preg_match('~max-age=(\d+)~i', $v, $m) ? (int) $m[1] : 0;
        return $age >= 86400 * 30
            ? ['label' => 'Always HTTPS (HSTS)', 'state' => 'good', 'say' => 'Browsers are told to use only https for ' . $this->www . ' for ' . round($age / 86400) . ' days after each visit, so a typed or old http:// link never loads insecurely.']
            : ['label' => 'Always HTTPS (HSTS)', 'state' => 'warn', 'say' => 'Browsers aren\'t told to use only https' . ($v ? ' (the header is set for too short a time)' : '') . ', so an old http:// link loads insecurely once before the redirect.',
               'todo' => 'The Studio sends it (lib/bootstrap.php); deploy, then check again.'];
    }

    private function email(): array
    {
        // a name's TXT records: the server's own lookup, else Google's public DNS over HTTPS; null if neither answers
        $txt = function (string $name): ?array {
            $r = function_exists('dns_get_record') ? @dns_get_record($name, DNS_TXT) : false;
            if (is_array($r) && $r) return array_map(fn($x) => (string) ($x['txt'] ?? implode('', $x['entries'] ?? [])), $r);
            try {
                [$st, , $body] = self::fetch('https://dns.google/resolve?type=TXT&name=' . rawurlencode($name));
                $j = json_decode($body, true);
                if ($st !== 200 || !is_array($j) || !isset($j['Status'])) return is_array($r) ? [] : null;
                return array_map(fn($a) => str_replace(['" "', '"'], ['', ''], (string) $a['data']), array_filter($j['Answer'] ?? [], fn($a) => (int) ($a['type'] ?? 0) === 16));
            } catch (Throwable $e) { return is_array($r) ? [] : null; }
        };
        $root = $txt($this->domain);
        if ($root === null) return ['label' => 'Email protection', 'state' => 'warn', 'say' => 'The server couldn\'t look up the domain\'s DNS records just now.'];
        $spf = array_values(array_filter($root, fn($t) => stripos($t, 'v=spf1') === 0));
        $sel = (string) ($this->cfg['dkim_selector'] ?? 'dreamhost');
        $dkim = array_values(array_filter($txt($sel . '._domainkey.' . $this->domain) ?? [], fn($t) => stripos($t, 'v=DKIM1') !== false || stripos($t, 'p=') !== false));
        $dmarc = array_values(array_filter($txt('_dmarc.' . $this->domain) ?? [], fn($t) => stripos($t, 'v=DMARC1') === 0));
        $have = ['SPF' => (bool) $spf, 'DKIM' => (bool) $dkim, 'DMARC' => (bool) $dmarc];
        $miss = array_keys(array_filter($have, fn($x) => !$x));
        $pol = $dmarc && preg_match('~\bp=(\w+)~i', $dmarc[0], $m) ? strtolower($m[1]) : '';
        $say = 'SPF ' . ($spf ? 'set' : 'missing') . ', DKIM ' . ($dkim ? 'set' : 'missing') . ', DMARC ' . ($dmarc ? 'set (' . ($pol ?: 'no policy') . ')' : 'missing') . '.';
        if (!$miss) return ['label' => 'Email protection', 'state' => $pol === 'none' ? 'warn' : 'good', 'say' => $say,
            'todo' => $pol === 'none' ? 'DMARC only watches (p=none); once nothing real fails, make it p=quarantine.' : null];
        return ['label' => 'Email protection', 'state' => in_array('SPF', $miss, true) ? 'bad' : 'warn', 'say' => $say . ' Without ' . implode(' and ', $miss) . ', someone else can send mail that seems to come from @' . $this->domain . '.',
            'todo' => in_array('DMARC', $miss, true) ? 'In the DreamHost panel (Domains, DNS), add a TXT record named _dmarc with the value: v=DMARC1; p=quarantine; adkim=r; aspf=r' : 'Add the missing records in the DreamHost panel (Domains, DNS).'];
    }

    private function disk(): array
    {
        $parts = ['Drive copies' => $this->home . '/incoming', 'Studio files and videos' => studio_private_dir(), 'Server logs' => $this->home . '/logs'];
        $sizes = []; $total = 0;
        foreach ($parts as $label => $dir) {
            if (!is_dir($dir)) continue;
            $out = []; $rc = 1;
            if (function_exists('exec')) @exec('timeout 20 du -sk ' . escapeshellarg($dir) . ' 2>/dev/null', $out, $rc);
            $kb = $rc === 0 && preg_match('~^(\d+)~', (string) ($out[0] ?? ''), $m) ? (int) $m[1] : null;
            if ($kb === null) continue;
            $sizes[] = $label . ' ' . self::size($kb * 1024); $total += $kb * 1024;
        }
        $free = @disk_free_space($this->home); $all = @disk_total_space($this->home);
        $low = $free !== false && $all ? $free / $all < 0.05 : false;
        return ['label' => 'Disk space', 'state' => $low ? 'warn' : 'good',
            'say' => ($sizes ? implode(', ', $sizes) . '.' : 'The Studio\'s folders couldn\'t be measured.') . ($free !== false ? ' ' . self::size((float) $free) . ' free on the server\'s disk.' : ''),
            'todo' => $low ? 'Free some space: ignore old Drive folders (with their server copies) on the Drive tab.' : null];
    }

    private static function size(float $b): string
    {
        return $b >= 1073741824 ? round($b / 1073741824, 1) . ' GB' : ($b >= 1048576 ? round($b / 1048576) . ' MB' : max(1, round($b / 1024)) . ' KB');
    }
}
