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

function studio_session(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    session_name('studio');
    session_set_cookie_params([
        'lifetime' => 0, 'path' => '/studio/', 'secure' => true, 'httponly' => true, 'samesite' => 'Strict',
    ]);
    session_start();
    // Sessions end after 12 hours, or after 2 hours idle.
    $now = time();
    if (isset($_SESSION['born']) && ($now - $_SESSION['born'] > 43200 || $now - ($_SESSION['seen'] ?? 0) > 7200)) {
        $_SESSION = [];
        session_regenerate_id(true);
    }
    $_SESSION['seen'] = $now;
}

function studio_logged_in(): bool {
    studio_session();
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
}
function studio_clear_failures(): void {
    $f = studio_throttle_file();
    if (is_file($f)) unlink($f);
}

function studio_login(string $password): bool {
    if (studio_locked_out()) return false;
    $cfg = studio_config();
    if (!password_verify($password, $cfg['password_hash'] ?? '')) {
        studio_note_failure();
        usleep(400000);
        return false;
    }
    studio_clear_failures();
    studio_session();
    session_regenerate_id(true);
    $_SESSION = ['ok' => true, 'born' => time(), 'seen' => time()];
    return true;
}

function studio_security_headers(): void {
    header('X-Frame-Options: DENY');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: same-origin');
    header('Cache-Control: no-store');
    header("Content-Security-Policy: default-src 'self'; img-src 'self' blob: data:; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
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

function h(string $s): string {
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
