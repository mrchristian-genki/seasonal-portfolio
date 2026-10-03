<?php
/* STUDIO API. JSON in, JSON out, for the Studio page only: every call needs the login session, and
   every change also needs the page's CSRF token. Entries and photos go to the GitHub repo as commits;
   the only thing written to this server is what the Drive copy brings into ~/incoming. */
declare(strict_types=1);
require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/github.php';
require __DIR__ . '/lib/drafter.php';
require __DIR__ . '/lib/drive.php';
require __DIR__ . '/vendor/autoload.php';

studio_security_headers();
if (!studio_logged_in()) json_fail('Please log in again.', 401);

$action = $_GET['a'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'POST') {
    if (!hash_equals(studio_csrf(), $_SERVER['HTTP_X_CSRF'] ?? '')) json_fail('This page is out of date. Reload it and try again.', 403);
    $body = json_decode((string) file_get_contents('php://input'), true);
    if (!is_array($body)) json_fail('Bad request.');
}

$cfg = studio_config();
$gh = new GitHub($cfg);
const EVENTS = 'field/data/events';
const PHOTOS = 'field/data/photos';

// The same layout as the repo's own tools write (JSON.stringify(ev, null, 1)), so diffs stay clean.
function repo_json(array $e): string {
    $j = json_encode($e, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION);
    return preg_replace_callback('/^( +)/m', fn($m) => str_repeat(' ', intdiv(strlen($m[1]), 4)), $j) . "\n";
}

function valid_id(string $id): bool { return (bool) preg_match('/^\d{4}-\d{2}-\d{2}-[a-z0-9-]{1,60}$/', $id); }

try {
    switch ("$method $action") {

        // What the page needs to work: the private zones and trailheads for trimming in the
        // browser, and the status steps. Private zones never leave this logged-in call.
        case 'GET config':
            $trail = json_decode($gh->read('field/data/trailheads.json') ?? '{}', true);
            $show = json_decode($gh->read('field/data/show.json') ?? '{}', true);
            json_out([
                'zones' => $cfg['private_zones'] ?? [],
                'trailheads' => $trail['trailheads'] ?? [],
                'statuses' => $show['statuses'] ?? [],
                'audioPrompt' => $show['audioPrompt'] ?? '',
            ]);

        case 'GET list':
            $out = [];
            foreach ($gh->listDir(EVENTS) as $name) {
                if (!str_ends_with($name, '.json') || str_starts_with($name, 'sample')) continue;
                $e = json_decode($gh->read(EVENTS . "/$name") ?? 'null', true);
                if (!$e) continue;
                $out[] = ['id' => $e['id'], 'title' => $e['title'] ?? '', 'date' => $e['date'] ?? '', 'kind' => $e['kind'] ?? '',
                    'status' => $e['status'] ?? 'notes', 'photos' => count($e['photos'] ?? []), 'summary' => $e['summary'] ?? ''];
            }
            usort($out, fn($a, $b) => strcmp($b['date'], $a['date']));
            json_out(['entries' => $out]);

        case 'GET entry':
            $id = $_GET['id'] ?? '';
            if (!valid_id($id)) json_fail('No such entry.', 404);
            $raw = $gh->read(EVENTS . "/$id.json");
            if ($raw === null) json_fail('No such entry.', 404);
            json_out(['entry' => json_decode($raw, true)]);

        // A photo already in the repo, for the editor's thumbnails.
        case 'GET photo':
            $id = $_GET['id'] ?? ''; $n = $_GET['n'] ?? '';
            if (!valid_id($id) || !preg_match('/^[a-z0-9-]{1,40}\.jpg$/', $n)) json_fail('No such photo.', 404);
            $bytes = $gh->readBytes(PHOTOS . "/$id/$n");
            if ($bytes === null) json_fail('No such photo.', 404);
            header('Content-Type: image/jpeg');
            header('Cache-Control: private, max-age=3600');
            echo $bytes;
            exit;

        // A new photo (already resized and stripped of location data in the browser) goes up one
        // at a time as a Git blob, so no request is large; the save then commits it by its id.
        case 'POST blob':
            $bytes = base64_decode((string) ($body['b64'] ?? ''), true);
            if ($bytes === false || substr($bytes, 0, 3) !== "\xFF\xD8\xFF" || strlen($bytes) > 4_000_000) json_fail("That photo isn't a usable JPEG.");
            json_out(['sha' => $gh->blob(base64_encode($bytes))]);

        // Save = one commit: the entry JSON, the new photos (by blob id) and any removed ones.
        case 'POST save':
            $e = $body['entry'] ?? null;
            if (!is_array($e) || !valid_id((string) ($e['id'] ?? ''))) json_fail('The entry needs a date and a title.');
            $id = $e['id'];
            // Photos and clips may only point into this entry's own folder.
            foreach ($e['photos'] ?? [] as $p) {
                foreach (['src', 'poster'] as $k) {
                    if (isset($p[$k]) && !preg_match('#^data/photos/' . preg_quote($id, '#') . '/[a-z0-9-]{1,40}\.(jpg|mp4)$#', (string) $p[$k])) json_fail('A photo path is outside this entry.');
                }
            }
            $files = [];
            foreach ($body['newPhotos'] ?? [] as $p) {
                $n = (string) ($p['name'] ?? ''); $sha = (string) ($p['sha'] ?? '');
                if (!preg_match('/^\d{2}\.jpg$/', $n) || !preg_match('/^[0-9a-f]{40}$/', $sha)) json_fail('Bad photo.');
                $files[PHOTOS . "/$id/$n"] = ['sha' => $sha];
            }
            foreach ($body['removePhotos'] ?? [] as $n) {
                if (preg_match('/^[a-z0-9-]{1,40}\.(jpg|mp4)$/', (string) $n)) $files[PHOTOS . "/$id/$n"] = null;
            }
            $files[EVENTS . "/$id.json"] = ['text' => repo_json($e)];
            $what = ($e['status'] ?? '') === 'published' ? 'Publish' : 'Save';
            $sha = $gh->commit($files, "Studio: $what $id");
            // a note made from an inbox folder: remember which, so the folder shows it's done
            if (isset($e['source']) && is_string($e['source'])) (new Drive($cfg))->remember($e['source'], $id);
            json_out(['ok' => true, 'commit' => $sha]);

        case 'POST draft':
            @set_time_limit(240);
            $guide = $gh->read('field/SHOW-GUIDE.md') ?? '';
            $draft = (new Drafter($cfg, $guide))->draft($body['facts'] ?? [], $body['thumbs'] ?? []);
            json_out(['draft' => $draft]);

        // Google Drive to the server: what's arrived so far, and the button that fetches new files.
        case 'GET drive':
            json_out((new Drive($cfg))->status());

        case 'POST drive':
            json_out((new Drive($cfg))->start());

        // Process Content: what's in one inbox folder, and its photos, tracks and notes one at a time
        case 'GET inbox':
            json_out((new Drive($cfg))->files((string) ($_GET['f'] ?? '')));

        case 'GET inboxfile':
            (new Drive($cfg))->send((string) ($_GET['f'] ?? ''), (string) ($_GET['n'] ?? ''));

        default:
            json_fail('Unknown request.', 404);
    }
} catch (Throwable $t) {
    error_log('studio: ' . $t->getMessage());
    json_fail($t->getMessage(), 500);
}
