<?php
/* STUDIO API. JSON in, JSON out, for the Studio page only: every call needs the login session, and
   every change also needs the page's CSRF token. Entries and photos go to the GitHub repo as commits;
   the only thing written to this server is what the Drive copy brings into ~/incoming. */
declare(strict_types=1);
require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/github.php';
require __DIR__ . '/lib/drafter.php';
require __DIR__ . '/lib/drive.php';
require __DIR__ . '/lib/video.php';
require __DIR__ . '/vendor/autoload.php';

studio_security_headers();
if (!studio_logged_in()) json_fail('Please log in again.', 401);

$action = $_GET['a'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'POST') {
    if (!hash_equals(studio_csrf(), $_SERVER['HTTP_X_CSRF'] ?? '')) json_fail('This page is out of date. Reload it and try again.', 403);
    // Files come up as raw bytes (their few fields in the query string), not base64 in JSON: DreamHost's
    // firewall scans JSON fields, and now and then a run of base64 looks like an attack to it (a 418).
    $raw = null;
    if (str_starts_with((string) ($_SERVER['CONTENT_TYPE'] ?? ''), 'application/octet-stream')) {
        $raw = (string) file_get_contents('php://input'); $body = $_GET;
    } else {
        $body = json_decode((string) file_get_contents('php://input'), true);
        if (!is_array($body)) json_fail('Bad request.');
    }
}

$cfg = studio_config();
$gh = new GitHub($cfg);
const EVENTS = 'field/data/events';
const PHOTOS = 'field/data/photos';
const AUDIO = 'field/data/audio';
const AUDIO_MAX = 40_000_000;
const CLIP_MAX = 40_000_000;            // a loop of up to 30 s at 960 px is a few MB           // an episode MP3 is a few MB; this leaves plenty of room

// An MP3 starts with an ID3 tag or an MPEG audio frame.
function is_mp3(string $head): bool {
    return str_starts_with($head, 'ID3') || (strlen($head) > 1 && ord($head[0]) === 0xFF && (ord($head[1]) & 0xE0) === 0xE0);
}

// The same layout as the repo's own tools write (JSON.stringify(ev, null, 1)), so diffs stay clean.
function repo_json(array $e): string {
    $j = json_encode($e, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION);
    return preg_replace_callback('/^( +)/m', fn($m) => str_repeat(' ', intdiv(strlen($m[1]), 4)), $j) . "\n";
}

// One note on the list (the grid): what the cards show and the filters and sorting use. The cover is picked the
// way the share cards pick it (field/tools/cards.py): the one marked cover, else the first photo; a loop's poster.
function list_row(array $e): array {
    $ph = array_values(array_filter($e['photos'] ?? [], fn($p) => is_array($p) && ($p['use'] ?? '') !== 'skip'));
    $c = null;
    foreach ($ph as $p) if (!empty($p['cover'])) { $c = $p; break; }
    if (!$c) foreach ($ph as $p) if (empty($p['video'])) { $c = $p; break; }
    if (!$c && $ph) $c = $ph[0];
    $cover = $c ? basename((string) (!empty($c['video']) ? ($c['poster'] ?? '') : ($c['src'] ?? ''))) : '';
    $loops = count(array_filter($e['photos'] ?? [], fn($p) => is_array($p) && !empty($p['video'])));
    return ['id' => $e['id'], 'title' => $e['title'] ?? '', 'date' => $e['date'] ?? '', 'kind' => $e['kind'] ?? '',
        'status' => $e['status'] ?? 'notes', 'photos' => count($e['photos'] ?? []) - $loops, 'loops' => $loops, 'summary' => $e['summary'] ?? '',
        'place' => trim(explode(',', (string) ($e['place'] ?? ''))[0]), 'audio' => !empty($e['episode']['audio']),
        'cover' => preg_match('/^[a-z0-9-]{1,40}\.jpg$/', $cover) ? $cover : '', 'cats' => note_cats($e), 'look' => (string) ($e['narratorLook']['look'] ?? '')];
}
/** A Note's categories, as Play's filters have them (field/tools/publish.mjs tagsOf, without the year): its own tags, then its kind. */
function note_cats(array $e): array {
    $kind = ['ride' => 'ride', 'hike' => 'hike', 'forage' => 'foraging', 'make' => 'mini-cast'][$e['kind'] ?? ''] ?? (string) ($e['kind'] ?? '');
    $out = [];
    foreach (array_merge((array) ($e['tags'] ?? []), [$kind]) as $t) {
        $t = trim(preg_replace('/[^a-z0-9]+/', '-', strtolower(trim((string) $t))), '-');
        if ($t !== '' && !preg_match('/^\d{4}$/', $t) && !in_array($t, $out, true)) $out[] = $t;
    }
    return $out;
}

function valid_id(string $id): bool { return (bool) preg_match('/^\d{4}-\d{2}-\d{2}-[a-z0-9-]{1,60}$/', $id); }

/* Review. An editor's save goes to the branch review/<id>, never to the live branch, so nothing they do
   reaches the site until the owner approves it (merges it in). The state of each review (ready, or sent
   back with a note) is kept beside the private config. */
function rb(string $id): string { return "review/$id"; }
function reviews_file(): string { return studio_private_dir() . '/reviews.json'; }
function reviews(): array { $f = reviews_file(); return is_file($f) ? (json_decode((string) file_get_contents($f), true) ?: []) : []; }
function set_review(string $id, ?array $r): void {
    $all = reviews(); if ($r === null) unset($all[$id]); else $all[$id] = $r;
    file_put_contents(reviews_file(), json_encode($all, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
}
const LOOKS_JSON = 'assets/narrator/looks.json';
/** looks.json the way it's kept: one look per line. */
function looks_json(array $list, array $cats = [], array $bds = [], array $bcats = []): string
{
    $line = fn(array $l) => '{ ' . implode(', ', array_map(fn($k) => json_encode($k) . ': ' . json_encode($l[$k], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), array_keys($l))) . ' }';
    $out = "{\n \"looks\": [\n  " . implode(",\n  ", array_map($line, $list)) . "\n ]";
    // the looks given to whole categories (Play's filter tags: ride, case-study, with-marley...), one per line
    $map = function (string $key, array $m): string {
        if (!$m) return '';
        ksort($m);
        return ",\n \"$key\": {\n  " . implode(",\n  ", array_map(fn($k) => json_encode((string) $k) . ': ' . json_encode($m[$k]), array_keys($m))) . "\n }";
    };
    $out .= $map('categories', $cats);
    // her backdrops and the ones whole categories have, the same way
    if ($bds) $out .= ",\n \"backdrops\": [\n  " . implode(",\n  ", array_map($line, $bds)) . "\n ]";
    $out .= $map('categoryBackdrops', $bcats);
    return $out . "\n}\n";
}
/** GlazyArray's looks (Studio, "GlazyArray's look" and Categories), all in looks.json, written once into $files: a Note
 * look taken off the site ($rl), a new or replaced look ($nl: name, ext, sha of an uploaded image, about, bulb), and the
 * looks given to whole categories ($cl: category => look, '' for none). Holiday looks and hair styles are never
 * replaced or removed from here. */
function apply_looks(GitHub $gh, array &$files, array $body): void
{
    $rl = (string) ($body['removeLook'] ?? ''); $nl = $body['newLook'] ?? null; $cl = $body['categoryLooks'] ?? null;
    $rb = (string) ($body['removeBackdrop'] ?? ''); $nb = $body['newBackdrop'] ?? null; $cb = $body['categoryBackdrops'] ?? null;
    // GlazyArray's looks (Studio, "GlazyArray's look"), all in looks.json, written once: a Note look taken off the
    // site, a new or replaced Note look, and the looks given to whole categories. Holiday looks and hair styles
    // are never replaced or removed from here.
    if ($rl !== '' || is_array($nl) || is_array($cl) || $rb !== '' || is_array($nb) || is_array($cb)) {
        $lj = json_decode($gh->read(LOOKS_JSON) ?? '{"looks":[]}', true);
        $list = array_values((array) ($lj['looks'] ?? [])); $cats = (array) ($lj['categories'] ?? []);
        $bds = array_values((array) ($lj['backdrops'] ?? [])); $bcats = (array) ($lj['categoryBackdrops'] ?? []);
        // her backdrops: the scene behind the Listen bar (assets/narrator/backdrops/<name>.webp), the same way
        if ($rb !== '') {
            if (!preg_match('/^[a-z0-9-]{1,40}$/', $rb)) json_fail('Bad backdrop.');
            foreach ($bds as $k => $b) if (($b['name'] ?? '') === $rb) {
                if (preg_match('/^[a-z0-9-]{1,40}\.(webp|png|jpg)$/', (string) ($b['file'] ?? ''))) $files['assets/narrator/backdrops/' . $b['file']] = null;
                unset($bds[$k]);
            }
            $bcats = array_filter($bcats, fn($n) => $n !== $rb);
        }
        if (is_array($nb)) {
            $name = (string) ($nb['name'] ?? ''); $ext = (string) ($nb['ext'] ?? ''); $bsha = (string) ($nb['sha'] ?? '');
            if (!preg_match('/^[a-z0-9-]{1,40}$/', $name) || !in_array($ext, ['webp', 'png', 'jpg'], true) || !preg_match('/^[0-9a-f]{40}$/', $bsha)) json_fail('Bad backdrop.');
            foreach ($bds as $k => $b) if (($b['name'] ?? '') === $name) {
                if (($b['file'] ?? '') !== "$name.$ext" && preg_match('/^[a-z0-9-]{1,40}\.(webp|png|jpg)$/', (string) ($b['file'] ?? ''))) $files['assets/narrator/backdrops/' . $b['file']] = null;
                unset($bds[$k]);
            }
            $bd = ['name' => $name, 'file' => "$name.$ext", 'about' => mb_substr(trim((string) ($nb['about'] ?? '')), 0, 120), 'v' => base_convert((string) time(), 10, 36)];
            $scene = mb_substr(trim((string) ($nb['scene'] ?? '')), 0, 400); if ($scene !== '') $bd['scene'] = $scene;
            $bds[] = $bd;
            $files["assets/narrator/backdrops/$name.$ext"] = ['sha' => $bsha];
        }
        if (is_array($cb)) {
            $bnames = array_map(fn($b) => (string) ($b['name'] ?? ''), $bds);
            foreach ($cb as $cat => $b) {
                $cat = (string) $cat; $b = (string) $b;
                if (!preg_match('/^[a-z0-9-]{1,40}$/', $cat) || preg_match('/^\d{4}$/', $cat)) json_fail('Bad category.');
                if ($b === '') { unset($bcats[$cat]); continue; }
                if (!in_array($b, $bnames, true)) json_fail("There's no backdrop called \"$b\" yet. Make it first, then give it to the category.");
                $bcats[$cat] = $b;
            }
        }
        $fixed = fn(array $l) => isset($l['to']) || !empty($l['rotate']);
        if ($rl !== '') {
            if (!preg_match('/^[a-z0-9-]{1,40}$/', $rl)) json_fail('Bad look.');
            foreach ($list as $k => $l) {
                if (($l['name'] ?? '') !== $rl) continue;
                if ($fixed($l)) json_fail("\"$rl\" is one of her holiday looks or hair styles; those aren't removed from the Studio.");
                if (preg_match('/^[a-z0-9-]{1,40}\.(webp|png)$/', (string) ($l['file'] ?? ''))) $files['assets/narrator/looks/' . $l['file']] = null;
                unset($list[$k]);
            }
            $cats = array_filter($cats, fn($n) => $n !== $rl);   // a category that wore it goes back to the holiday look
        }
        if (is_array($nl)) {
            $name = (string) ($nl['name'] ?? ''); $ext = (string) ($nl['ext'] ?? ''); $lsha = (string) ($nl['sha'] ?? '');
            if (!preg_match('/^[a-z0-9-]{1,40}$/', $name) || $name === 'curls' || !in_array($ext, ['webp', 'png'], true) || !preg_match('/^[0-9a-f]{40}$/', $lsha)) json_fail('Bad look.');
            foreach ($list as $k => $l) {
                if (($l['name'] ?? '') !== $name) continue;
                if ($fixed($l)) json_fail("\"$name\" is one of her holiday looks or hair styles. Pick another name for this one.");
                if (($l['file'] ?? '') !== "$name.$ext" && preg_match('/^[a-z0-9-]{1,40}\.(webp|png)$/', (string) ($l['file'] ?? ''))) $files['assets/narrator/looks/' . $l['file']] = null;   // the old file, if it changes type
                unset($list[$k]);
            }
            // v: changes with every version, so a replaced image isn't served from a cache
            $look = ['name' => $name, 'file' => "$name.$ext", 'about' => mb_substr(trim((string) ($nl['about'] ?? '')), 0, 120), 'v' => base_convert((string) time(), 10, 36)];
            if (($nl['bulb'] ?? true) === false) $look['bulb'] = false;
            $list[] = $look;
            $files["assets/narrator/looks/$name.$ext"] = ['sha' => $lsha];
        }
        if (is_array($cl)) {
            $names = array_merge(['curls'], array_map(fn($l) => (string) ($l['name'] ?? ''), $list));
            foreach ($cl as $cat => $look) {
                $cat = (string) $cat; $look = (string) $look;
                if (!preg_match('/^[a-z0-9-]{1,40}$/', $cat) || preg_match('/^\d{4}$/', $cat)) json_fail('Bad category.');
                if ($look === '') { unset($cats[$cat]); continue; }
                if (!in_array($look, $names, true)) json_fail("There's no look called \"$look\" yet. Make it first, then give it to the category.");
                $cats[$cat] = $look;
            }
        }
        $files[LOOKS_JSON] = ['text' => looks_json(array_values($list), $cats, array_values($bds), $bcats)];
    }
}
function owner_only(): void { if (!studio_is_owner()) json_fail('Only the owner can do that.', 403); }
// a file of an entry: from its review copy when there is one, else the live one
function read_either(GitHub $gh, string $id, string $path): ?string {
    if (isset(reviews()[$id])) { $b = $gh->readBytes($path, rb($id)); if ($b !== null) return $b; }
    return $gh->readBytes($path);
}
// a new password for an editor: four short words' worth of letters and digits, easy to type once
function new_password(): string {
    $a = 'abcdefghjkmnpqrstuvwxyz23456789'; $out = [];
    for ($g = 0; $g < 4; $g++) { $w = ''; for ($i = 0; $i < 4; $i++) $w .= $a[random_int(0, strlen($a) - 1)]; $out[] = $w; }
    return implode('-', $out);
}

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
                'siteUrl' => $show['siteUrl'] ?? '',
                'me' => studio_me(),
            ]);

        case 'GET list':
            $out = [];
            foreach ($gh->listDir(EVENTS) as $name) {
                if (!str_ends_with($name, '.json') || str_starts_with($name, 'sample')) continue;
                $e = json_decode($gh->read(EVENTS . "/$name") ?? 'null', true);
                if (!$e) continue;
                $out[] = list_row($e);
            }
            // notes waiting for review: their review copy stands in for the live one (or is new)
            $byId = []; foreach ($out as $k => $x) $byId[$x['id']] = $k;
            foreach (reviews() as $rid => $r) {
                if (!valid_id((string) $rid)) continue;
                $e = json_decode($gh->read(EVENTS . "/$rid.json", rb($rid)) ?? 'null', true);
                if (!$e) { set_review((string) $rid, null); continue; }   // the branch is gone
                $row = list_row($e) + ['review' => $r + ['isNew' => !isset($byId[$rid])]];
                if (isset($byId[$rid])) $out[$byId[$rid]] = $row; else $out[] = $row;
            }
            usort($out, fn($a, $b) => strcmp($b['date'], $a['date']));
            json_out(['entries' => $out]);

        case 'GET entry':
            $id = $_GET['id'] ?? '';
            if (!valid_id($id)) json_fail('No such entry.', 404);
            $raw = $gh->read(EVENTS . "/$id.json");
            $r = reviews()[$id] ?? null;
            $rev = $r ? $gh->read(EVENTS . "/$id.json", rb($id)) : null;
            if ($raw === null && $rev === null) json_fail('No such entry.', 404);
            json_out(['entry' => json_decode($rev ?? $raw, true), 'live' => $raw === null ? null : json_decode($raw, true), 'review' => $rev === null ? null : $r]);

        // A photo already in the repo, for the editor's thumbnails.
        case 'GET photo':
            $id = $_GET['id'] ?? ''; $n = $_GET['n'] ?? '';
            if (!valid_id($id) || !preg_match('/^[a-z0-9-]{1,40}\.jpg$/', $n)) json_fail('No such photo.', 404);
            $bytes = read_either($gh, $id, PHOTOS . "/$id/$n");
            if ($bytes === null) json_fail('No such photo.', 404);
            header('Content-Type: image/jpeg');
            header('Cache-Control: private, max-age=3600');
            echo $bytes;
            exit;

        // A new photo (already resized and stripped of location data in the browser) goes up one
        // at a time as a Git blob, so no request is large; the save then commits it by its id.
        case 'POST blob':
            $bytes = $raw ?? base64_decode((string) ($body['b64'] ?? ''), true);
            if ($bytes === false || substr($bytes, 0, 3) !== "\xFF\xD8\xFF" || strlen($bytes) > 4_000_000) json_fail("That photo isn't a usable JPEG.");
            json_out(['sha' => $gh->blob(base64_encode($bytes))]);

        // GlazyArray's new look, made in the browser (assets/look.js): a WebP or PNG of her head layer, 623 x 437.
        case 'POST lookblob':
            $bytes = $raw ?? base64_decode((string) ($body['b64'] ?? ''), true);
            $webp = is_string($bytes) && substr($bytes, 0, 4) === 'RIFF' && substr($bytes, 8, 4) === 'WEBP';
            $png = is_string($bytes) && substr($bytes, 0, 8) === "\x89PNG\r\n\x1a\n"; $jpg = is_string($bytes) && substr($bytes, 0, 3) === "\xFF\xD8\xFF";
            if (!$webp && !$png && !$jpg || strlen($bytes) > 1_500_000) json_fail("That isn't a usable image.");
            json_out(['sha' => $gh->blob(base64_encode($bytes))]);

        // The episode's MP3 comes up in pieces (so no request is large), gathered in a private file on
        // this server; the last piece checks it's an MP3 and turns it into a Git blob for the save.
        case 'POST audiopart':
            $up = (string) ($body['up'] ?? ''); $i = (int) ($body['i'] ?? -1);
            if (!preg_match('/^[0-9a-f]{16}$/', $up) || $i < 0) json_fail('Bad upload.');
            $bytes = $raw ?? base64_decode((string) ($body['b64'] ?? ''), true);
            if ($bytes === false || strlen($bytes) > 3_000_000) json_fail('Bad upload piece.');
            $part = studio_private_dir() . "/audio-$up.part";
            if ($i === 0) { if (!is_mp3($bytes)) json_fail("That isn't an MP3. Export the episode as MP3 and try again."); file_put_contents($part, $bytes); }
            else { if (!is_file($part)) json_fail('The upload was interrupted. Try again.'); file_put_contents($part, $bytes, FILE_APPEND); }
            clearstatcache(true, $part);
            if (filesize($part) > AUDIO_MAX) { @unlink($part); json_fail('That audio file is too big (40 MB at most).'); }
            if (empty($body['last']) || $body['last'] === '0') json_out(['ok' => true]);
            $all = (string) file_get_contents($part); @unlink($part);
            json_out(['sha' => $gh->blob(base64_encode($all)), 'bytes' => strlen($all)]);

        // An entry's attached MP3, for the editor's player.
        case 'GET audio':
            $id = $_GET['id'] ?? '';
            if (!valid_id($id)) json_fail('No such audio.', 404);
            $bytes = read_either($gh, $id, AUDIO . "/$id.mp3");
            if ($bytes === null) json_fail('No such audio.', 404);
            header('Content-Type: audio/mpeg');
            header('Cache-Control: private, max-age=600');
            echo $bytes;
            exit;

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
                // a photo (01.jpg) or a loop's poster frame picked in the Studio (clip-1.jpg)
                if (!preg_match('/^(\d{2}|clip-\d{1,3})\.jpg$/', $n) || !preg_match('/^[0-9a-f]{40}$/', $sha)) json_fail('Bad photo.');
                $files[PHOTOS . "/$id/$n"] = ['sha' => $sha];
            }
            // Video loops made on this server (lib/video.php) go straight from it into the commit.
            $vid = new Video($cfg);
            foreach ($body['newClips'] ?? [] as $c) {
                $n = (string) ($c['name'] ?? ''); $mp4 = $vid->file((string) ($c['loop'] ?? ''), 'loop'); $jpg = $vid->file((string) ($c['loop'] ?? ''), 'poster');
                if (!preg_match('/^clip-\d{1,3}$/', $n) || !$mp4 || !$jpg) json_fail('A video loop is missing on the server. Make it again.');
                if (filesize($mp4) > CLIP_MAX) json_fail('A video loop is too big.');
                $files[PHOTOS . "/$id/$n.mp4"] = ['sha' => $gh->blob(base64_encode((string) file_get_contents($mp4)))];
                // the server's poster frame, unless one was picked by hand (it came up with the photos)
                if (!isset($files[PHOTOS . "/$id/$n.jpg"])) $files[PHOTOS . "/$id/$n.jpg"] = ['sha' => $gh->blob(base64_encode((string) file_get_contents($jpg)))];
            }
            foreach ($body['removePhotos'] ?? [] as $n) {
                if (preg_match('/^[a-z0-9-]{1,40}\.(jpg|mp4)$/', (string) $n)) $files[PHOTOS . "/$id/$n"] = null;
            }
            // The episode's audio lives at one place per entry, and only there.
            $audio = $e['episode']['audio'] ?? null;
            if ($audio !== null && $audio !== "data/audio/$id.mp3") json_fail('The audio path is outside this entry.');
            $na = (string) ($body['newAudio'] ?? '');
            if ($na !== '') {
                if (!preg_match('/^[0-9a-f]{40}$/', $na) || $audio === null) json_fail('Bad audio.');
                $files[AUDIO . "/$id.mp3"] = ['sha' => $na];
            } elseif (!empty($body['removeAudio']) && $audio === null) {
                $files[AUDIO . "/$id.mp3"] = null;
            }
            apply_looks($gh, $files, $body);
            $me = studio_me();
            if (!studio_is_owner()) {
                // An editor can't change what's live: a published note stays published (its update waits
                // for review), and nothing else can be made published.
                $live = json_decode($gh->read(EVENTS . "/$id.json") ?? 'null', true);
                $wasLive = ($live['status'] ?? '') === 'published';
                if (!$wasLive && ($e['status'] ?? '') === 'published') json_fail('Only the owner can publish. Save it, and it waits for review.', 403);
                if ($wasLive) $e['status'] = 'published';
                $files[EVENTS . "/$id.json"] = ['text' => repo_json($e)];
                $sha = $gh->commit($files, "Studio ({$me['name']}): Save $id for review", rb($id));
                set_review($id, ['by' => $me['name'], 'at' => time(), 'state' => 'ready', 'live' => $wasLive]);
                if (isset($e['source']) && is_string($e['source'])) (new Drive($cfg))->remember($e['source'], $id);
                json_out(['ok' => true, 'commit' => $sha, 'review' => true]);
            }
            // The owner saves to the live branch. A note waiting for review takes its review in first (so
            // the photos the editor added come along), and is then no longer waiting.
            if (isset(reviews()[$id])) {
                if (!$gh->mergeIn(rb($id), "Studio: take in the review of $id")) json_fail('The review copy and the live note both changed the same thing. Ask for it in a Claude Code session to merge by hand.', 409);
            }
            // the moment it first goes live: Play orders the Notes of one day by it, newest first
            if (($e['status'] ?? '') === 'published' && !preg_match('/T/', (string) ($e['publishedAt'] ?? ''))) {
                $live = json_decode($gh->read(EVENTS . "/$id.json") ?? 'null', true);
                $e['publishedAt'] = (($live['status'] ?? '') === 'published' && preg_match('/T/', (string) ($live['publishedAt'] ?? ''))) ? $live['publishedAt'] : gmdate('Y-m-d\TH:i:s\Z');
            }
            $files[EVENTS . "/$id.json"] = ['text' => repo_json($e)];
            $what = ($e['status'] ?? '') === 'published' ? 'Publish' : 'Save';
            $sha = $gh->commit($files, "Studio: $what $id");
            if (isset(reviews()[$id])) { $gh->deleteBranch(rb($id)); set_review($id, null); }
            // a note made from an inbox folder: remember which, so the folder shows it's done
            if (isset($e['source']) && is_string($e['source'])) (new Drive($cfg))->remember($e['source'], $id);
            json_out(['ok' => true, 'commit' => $sha]);

        case 'POST draft':
            @set_time_limit(240);
            $guide = $gh->read('field/SHOW-GUIDE.md') ?? '';
            $lj = (array) json_decode($gh->read(LOOKS_JSON) ?? '', true);
            $looks = (array) ($lj['looks'] ?? []); $looks['_categories'] = (array) ($lj['categories'] ?? []);
            $looks['_backdrops'] = ['backdrops' => array_map(fn($b) => ['name' => $b['name'] ?? '', 'about' => $b['about'] ?? ''], (array) ($lj['backdrops'] ?? [])), 'categoryBackdrops' => (array) ($lj['categoryBackdrops'] ?? [])];
            $draft = (new Drafter($cfg, $guide))->draft($body['facts'] ?? [], $body['thumbs'] ?? [], $looks);
            json_out(['draft' => $draft]);

        // The Social panel's captions (Instagram and Facebook), from the written Note.
        case 'POST social':
            @set_time_limit(120);
            $guide = $gh->read('field/SHOW-GUIDE.md') ?? '';
            json_out(['social' => (new Drafter($cfg, $guide))->social((array) ($body['note'] ?? []))]);

        // Google Drive to the server: what's arrived so far, and the button that fetches new files.
        case 'GET drive':
            json_out((new Drive($cfg))->status());

        case 'POST drive':
            json_out((new Drive($cfg))->start());

        // A folder that won't be used: set aside (owner only), and its server copy deleted if asked.
        case 'POST ignore':
            owner_only();
            json_out((new Drive($cfg))->ignore((string) ($body['source'] ?? ''), !empty($body['drop'])));

        case 'POST unignore':
            owner_only();
            json_out((new Drive($cfg))->unignore((string) ($body['source'] ?? '')));

        // Process Content: what's in one inbox folder, and its photos, tracks and notes one at a time
        case 'GET inbox':
            json_out((new Drive($cfg))->files((string) ($_GET['f'] ?? '')));

        case 'GET inboxfile':
            (new Drive($cfg))->send((string) ($_GET['f'] ?? ''), (string) ($_GET['n'] ?? ''));

        // Video loops: a video in the note's Drive folder gets a small preview to scrub through, then the
        // chosen part is cut into a loop, all on this server. Both run in the background; the page asks again.
        case 'GET video':
            @set_time_limit(60);
            $path = (new Drive($cfg))->path((string) ($_GET['f'] ?? ''), (string) ($_GET['n'] ?? ''));
            if ($path === null || Drive::kind($path) !== 'video') json_fail('No such video.', 404);
            json_out((new Video($cfg))->preview($path, !empty($_GET['retry'])));

        case 'POST loop':
            $path = (new Drive($cfg))->path((string) ($body['f'] ?? ''), (string) ($body['n'] ?? ''));
            if ($path === null || Drive::kind($path) !== 'video') json_fail('No such video.', 404);
            json_out((new Video($cfg))->loop($path, (float) ($body['from'] ?? 0), (float) ($body['to'] ?? 0), !empty($body['retry'])));

        case 'GET vfile':
            $t = (string) ($_GET['t'] ?? '');
            if (!in_array($t, ['preview', 'loop', 'poster'], true)) json_fail('No such file.', 404);
            $f = (new Video($cfg))->file((string) ($_GET['k'] ?? ''), $t);
            if ($f === null) json_fail('No such file.', 404);
            studio_send_file($f, $t === 'poster' ? 'image/jpeg' : 'video/mp4');

        // A saved loop, for the editor's player (fetched once and played from memory, like the audio).
        case 'GET clip':
            $id = $_GET['id'] ?? ''; $n = $_GET['n'] ?? '';
            if (!valid_id($id) || !preg_match('/^[a-z0-9-]{1,40}\.mp4$/', $n)) json_fail('No such clip.', 404);
            $bytes = read_either($gh, $id, PHOTOS . "/$id/$n");
            if ($bytes === null) json_fail('No such clip.', 404);
            header('Content-Type: video/mp4');
            header('Cache-Control: private, max-age=600');
            echo $bytes;
            exit;

        // Review, for the owner: approve (merge the review copy into the live site), send it back with a
        // note, or throw it away.
        case 'POST approve':
            owner_only();
            $id = (string) ($body['id'] ?? ''); if (!valid_id($id) || !isset(reviews()[$id])) json_fail('Nothing waits for review there.');
            $r = reviews()[$id];
            if (!$gh->mergeIn(rb($id), "Studio: approve {$r['by']}'s changes to $id")) json_fail('The review copy and the live note both changed the same thing. Ask for it in a Claude Code session to merge by hand.', 409);
            $gh->deleteBranch(rb($id)); set_review($id, null);
            json_out(['ok' => true]);

        case 'POST sendback':
            owner_only();
            $id = (string) ($body['id'] ?? ''); if (!valid_id($id) || !isset(reviews()[$id])) json_fail('Nothing waits for review there.');
            set_review($id, ['state' => 'returned', 'note' => substr(trim((string) ($body['note'] ?? '')), 0, 2000), 'returnedAt' => time()] + reviews()[$id]);
            json_out(['ok' => true]);

        case 'POST discard':
            owner_only();
            $id = (string) ($body['id'] ?? ''); if (!valid_id($id) || !isset(reviews()[$id])) json_fail('Nothing waits for review there.');
            $gh->deleteBranch(rb($id)); set_review($id, null);
            json_out(['ok' => true]);

        // People, for the owner: editors and their passwords (shown once, when made).
        case 'GET users':
            owner_only();
            json_out(['users' => array_map(fn($u) => ['name' => $u['name'], 'user' => $u['user'] ?? studio_username($u['name']), 'added' => $u['added'] ?? null], studio_users())]);

        // the Studio's Categories area: give categories a look, or add a look (owner only)
        case 'POST looks':
            owner_only();
            $files = [];
            apply_looks($gh, $files, ['newLook' => $body['newLook'] ?? null, 'categoryLooks' => $body['categoryLooks'] ?? null,
                'newBackdrop' => $body['newBackdrop'] ?? null, 'categoryBackdrops' => $body['categoryBackdrops'] ?? null]);
            if (!$files) json_fail('Nothing to save.');
            json_out(['ok' => true, 'commit' => $gh->commit($files, "Studio: GlazyArray's looks")]);

        case 'POST useradd':
            owner_only();
            $name = trim((string) ($body['name'] ?? ''));
            if (!preg_match('/^[\p{L}\p{N} .\'-]{1,40}$/u', $name)) json_fail('Give a name of up to 40 letters.');
            $users = studio_users();
            foreach ($users as $u) if (strcasecmp($u['name'], $name) === 0) json_fail('There is already someone called that.');
            // a username from the name, kept apart from everyone else's (and the owner's)
            $taken = array_merge(studio_owner_users($cfg), array_map(fn($u) => $u['user'] ?? studio_username($u['name']), $users));
            $base = studio_username($name); $user = $base; $k = 2;
            while (in_array($user, $taken, true)) $user = $base . $k++;
            $pw = new_password();
            $users[] = ['name' => $name, 'user' => $user, 'hash' => password_hash($pw, PASSWORD_DEFAULT), 'role' => 'editor', 'added' => time()];
            studio_save_users($users);
            json_out(['name' => $name, 'user' => $user, 'password' => $pw]);

        case 'POST userreset':
            owner_only();
            $name = (string) ($body['name'] ?? ''); $users = studio_users(); $pw = null;
            $user = '';
            foreach ($users as &$u) if ($u['name'] === $name) { $pw = new_password(); $u['hash'] = password_hash($pw, PASSWORD_DEFAULT); $user = $u['user'] = $u['user'] ?? studio_username($u['name']); }
            unset($u);
            if ($pw === null) json_fail('No one by that name.');
            studio_save_users($users);
            json_out(['name' => $name, 'user' => $user, 'password' => $pw]);

        case 'POST userdel':
            owner_only();
            $name = (string) ($body['name'] ?? '');
            studio_save_users(array_filter(studio_users(), fn($u) => $u['name'] !== $name));
            json_out(['ok' => true]);

        default:
            json_fail('Unknown request.', 404);
    }
} catch (Throwable $t) {
    error_log('studio: ' . $t->getMessage());
    json_fail($t->getMessage(), 500);
}
