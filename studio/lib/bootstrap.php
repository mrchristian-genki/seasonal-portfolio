<?php
/* STUDIO: shared setup for every request. Loads the private config (outside the web folder),
   starts a locked-down session, and gives the JSON helpers the pages and the API use.

   The config lives at ~/studio-private/config.php, written by tools/setup.php over SSH. It holds the
   password hash, the Anthropic API key, the GitHub token and the private zones, so none of it is in
   git or anywhere a browser can reach. */
declare(strict_types=1);

const STUDIO_VERSION = '1';

function studio_private_dir(): string {
    // /home/<user>/christiangehrke.com/studio/lib -> /home/<user>/studio-private
    return dirname(__DIR__, 3) . '/studio-private';
}

function studio_config(): array {
    static $cfg = null;
    if ($cfg !== null) return $cfg;
    $file = studio_private_dir() . '/config.php';
    if (!is_file($file)) {
        http_response_code(503);
        header('Content-Type: text/plain; charset=utf-8');
        exit("The Studio isn't set up yet. Run tools/setup.php over SSH (see studio/README.md).\n");
    }
    $cfg = require $file;
    return $cfg;
}

// "Keep me signed in on this device" (Christian, Oct 18: a phone that reloads the tab shouldn't mean logging in again):
// such a session lasts 30 days from its last use, 90 at most; any other ends after 12 hours, or 2 idle.
const STUDIO_KEEP_IDLE = 30 * 86400, STUDIO_KEEP_MAX = 90 * 86400;
function studio_session(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    session_name('studio');
    // the sessions live in the private folder and are kept as long as the longest may last: the host's shared
    // session folder clears anything idle for 24 minutes, which logged a phone out between visits
    $dir = studio_private_dir() . '/sessions';
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    if (is_dir($dir) && is_writable($dir)) session_save_path($dir);
    ini_set('session.gc_maxlifetime', (string) STUDIO_KEEP_IDLE);
    session_set_cookie_params([
        'lifetime' => 0, 'path' => '/studio/', 'secure' => true, 'httponly' => true, 'samesite' => 'Strict',
    ]);
    session_start();
    $now = time();
    $keep = !empty($_SESSION['keep']);
    if (isset($_SESSION['born']) && ($now - $_SESSION['born'] > ($keep ? STUDIO_KEEP_MAX : 43200) || $now - ($_SESSION['seen'] ?? 0) > ($keep ? STUDIO_KEEP_IDLE : 7200))) {
        $_SESSION = [];
        session_regenerate_id(true);
        $keep = false;
    }
    $_SESSION['seen'] = $now;
    if ($keep) studio_keep_cookie();
}
// a kept session's cookie outlives the browser closing, and is renewed with each use
function studio_keep_cookie(int $for = STUDIO_KEEP_IDLE): void {
    if (headers_sent()) return;
    setcookie(session_name(), $for > 0 ? session_id() : '', ['expires' => $for > 0 ? time() + $for : 1, 'path' => '/studio/', 'secure' => true, 'httponly' => true, 'samesite' => 'Strict']);
}

function studio_logged_in(): bool {
    studio_session();
    if (!empty($_SESSION['ok']) && !studio_logged_in_still()) $_SESSION = [];
    return !empty($_SESSION['ok']);
}

function studio_csrf(): string {
    studio_session();
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf'];
}

/* Login throttle: five wrong passwords from one address locks it out for 15 minutes. */
function studio_throttle_file(): string {
    return studio_private_dir() . '/throttle-' . hash('sha256', $_SERVER['REMOTE_ADDR'] ?? '-') . '.json';
}
function studio_locked_out(): bool {
    $f = studio_throttle_file();
    if (!is_file($f)) return false;
    $t = json_decode((string) file_get_contents($f), true) ?: [];
    $recent = array_filter($t, fn($ts) => $ts > time() - 900);
    return count($recent) >= 5;
}
function studio_note_failure(): void {
    $f = studio_throttle_file();
    $t = is_file($f) ? (json_decode((string) file_get_contents($f), true) ?: []) : [];
    $t = array_values(array_filter($t, fn($ts) => $ts > time() - 900));
    $t[] = time();
    file_put_contents($f, json_encode($t), LOCK_EX);
    studio_count_failure(count($t) >= 5);
}
/* Failed logins per day, for the Stats tab's Site health: how many, and how many of them locked an address out.
   Counts only (no addresses), the last 400 days. */
function studio_failures_file(): string { return studio_private_dir() . '/login-failures.json'; }
function studio_count_failure(bool $lockout): void {
    $f = studio_failures_file();
    $h = @fopen($f, 'c+');
    if (!$h || !flock($h, LOCK_EX)) return;
    $all = json_decode((string) stream_get_contents($h), true) ?: [];
    $d = date('Y-m-d');
    $all[$d] = ['fails' => (int) ($all[$d]['fails'] ?? 0) + 1, 'lockouts' => (int) ($all[$d]['lockouts'] ?? 0) + ($lockout ? 1 : 0)];
    ksort($all);
    $all = array_slice($all, -400, null, true);
    ftruncate($h, 0); rewind($h); fwrite($h, json_encode($all));
    flock($h, LOCK_UN); fclose($h);
    @chmod($f, 0600);
}
function studio_failures(string $since): array {
    $f = studio_failures_file();
    $all = is_file($f) ? (json_decode((string) file_get_contents($f), true) ?: []) : [];
    return array_filter($all, fn($k) => $k >= $since, ARRAY_FILTER_USE_KEY);
}
function studio_clear_failures(): void {
    $f = studio_throttle_file();
    if (is_file($f)) unlink($f);
}

/* People. The owner logs in with the password in the private config and can do everything. Editors
   (added by the owner in the Studio, kept in ~/studio-private/users.json with their usernames and
   password hashes) can work on notes, but what they save waits for the owner's review and never goes
   live by itself. Everyone logs in with a username and a password. */
function studio_users_file(): string { return studio_private_dir() . '/users.json'; }
function studio_users(): array {
    $f = studio_users_file();
    $u = is_file($f) ? (json_decode((string) file_get_contents($f), true) ?: []) : [];
    return array_values(array_filter($u, fn($x) => is_array($x) && isset($x['name'], $x['hash'])));
}
function studio_save_users(array $users): void {
    file_put_contents(studio_users_file(), json_encode(array_values($users), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
    @chmod(studio_users_file(), 0600);
}

// a username from a name: lowercase letters and digits ("Sam Lee" -> "samlee")
function studio_username(string $name): string {
    $u = strtolower(preg_replace('/[^A-Za-z0-9]+/', '', iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $name) ?: $name) ?? '');
    return substr($u !== '' ? $u : 'editor', 0, 24);
}
// the owner's usernames: the config's owner_user, else "christian" or "owner"
function studio_owner_users(array $cfg): array {
    return isset($cfg['owner_user']) ? [strtolower((string) $cfg['owner_user'])] : ['christian', 'owner'];
}

function studio_login(string $username, string $password, bool $keep = false): bool {
    if (studio_locked_out()) return false;
    $cfg = studio_config();
    $who = null; $user = strtolower(trim($username));
    if (in_array($user, studio_owner_users($cfg), true) && password_verify($password, $cfg['password_hash'] ?? '')) $who = ['name' => $cfg['owner_name'] ?? 'Christian', 'role' => 'owner'];
    else foreach (studio_users() as $u) if (($u['user'] ?? studio_username($u['name'])) === $user && password_verify($password, $u['hash'])) { $who = ['name' => $u['name'], 'role' => 'editor']; break; }
    if ($who === null) {
        studio_note_failure();
        usleep(400000);
        return false;
    }
    studio_clear_failures();
    studio_session();
    session_regenerate_id(true);
    $_SESSION = ['ok' => true, 'born' => time(), 'seen' => time(), 'name' => $who['name'], 'role' => $who['role'], 'keep' => $keep];
    if ($keep) studio_keep_cookie();
    return true;
}
function studio_logged_in_still(): bool {
    // an editor removed by the owner is logged out on their next request
    if (($_SESSION['role'] ?? 'owner') !== 'editor') return true;
    foreach (studio_users() as $u) if ($u['name'] === ($_SESSION['name'] ?? '')) return true;
    return false;
}
function studio_me(): array { return ['name' => $_SESSION['name'] ?? 'Owner', 'role' => $_SESSION['role'] ?? 'owner']; }
function studio_is_owner(): bool { return (studio_me()['role']) === 'owner'; }

function studio_security_headers(): void {
    header('X-Frame-Options: DENY');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: same-origin');
    header('Cache-Control: no-store');
    // HTTPS only from now on: a browser that sees this uses https for the whole of www.christiangehrke.com (HSTS is
    // for the host, not this folder) for a year, so an old http:// link or a typed address never loads insecurely.
    // The Let's Encrypt certificate renews itself; the Stats tab's Site health warns if it ever doesn't
    if (($_SERVER['HTTPS'] ?? '') === 'on' || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https') header('Strict-Transport-Security: max-age=31536000');
    header("Content-Security-Policy: default-src 'self'; img-src 'self' blob: data: https://tile.openstreetmap.org https://*.tile.opentopomap.org; media-src 'self' blob:; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
}

function json_out($data, int $code = 200): never {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function json_fail(string $message, int $code = 400): never {
    json_out(['error' => $message], $code);
}

// A private file to the logged-in page, a part of it when asked (Safari plays audio and video only
// from a server that answers ranges).
function studio_send_file(string $path, string $type): never {
    header('Content-Type: ' . $type);
    header('Cache-Control: private, max-age=600');
    header('Accept-Ranges: bytes');
    $total = filesize($path);
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

function h(string $s): string {
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
