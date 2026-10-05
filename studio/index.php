<?php
/* STUDIO: the private admin for Field Notes. Log in, then create or edit an entry: drop the track
   and photos (trimmed and cleaned in the browser), write notes, draft with Claude, save to GitHub. */
declare(strict_types=1);
require __DIR__ . '/lib/bootstrap.php';

studio_security_headers();
studio_config();   // stops here with a message if setup hasn't been run
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    studio_session();
    $act = $_POST['act'] ?? '';
    if ($act === 'login') {
        if (studio_locked_out()) $error = 'Too many tries. Wait 15 minutes and try again.';
        elseif (studio_login((string) ($_POST['username'] ?? ''), (string) ($_POST['password'] ?? ''))) { header('Location: ./'); exit; }
        else $error = 'That username and password don\'t match.';
    } elseif ($act === 'logout' && hash_equals(studio_csrf(), (string) ($_POST['csrf'] ?? ''))) {
        $_SESSION = [];
        session_destroy();
        header('Location: ./');
        exit;
    }
}

$in = studio_logged_in();
?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Studio · Field Notes</title>
<meta name="description" content="Field Notes, behind the scenes: the private workshop where rides become posts and episodes, on a glowing river desk that turns from day to night.">
<link rel="canonical" href="https://www.christiangehrke.com/studio/">
<meta property="og:site_name" content="Christian Gehrke"><meta property="og:locale" content="en_US"><meta property="og:type" content="website">
<meta property="og:title" content="Studio · Field Notes"><meta property="og:url" content="https://www.christiangehrke.com/studio/">
<meta property="og:description" content="Field Notes, behind the scenes: the private workshop where rides become posts and episodes.">
<meta property="og:image" content="https://www.christiangehrke.com/studio/assets/og-studio.jpg?v=1"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="The Studio at night: a brass STUDIO nameplate over a glowing green river, and on the wood below a brass projector casting a squid hologram beside a glowing compass.">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="Studio · Field Notes">
<meta name="twitter:description" content="Field Notes, behind the scenes: the private workshop where rides become posts and episodes.">
<meta name="twitter:image" content="https://www.christiangehrke.com/studio/assets/og-studio.jpg?v=1">
<link rel="icon" href="/favicon.ico?v=2" sizes="any"><link rel="icon" href="/favicon.svg?v=2" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2"><meta name="theme-color" content="#2a1d14">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;800&family=Special+Elite&display=swap">
<link rel="stylesheet" href="../css/route-dash.css?v=<?= STUDIO_VERSION ?>-3">
<link rel="stylesheet" href="assets/studio.css?v=<?= STUDIO_VERSION ?>-32">
<link rel="stylesheet" href="table/table.css?v=44">
</head>
<?php if (!$in): ?>
<body class="login">
<?php else: ?>
<body data-csrf="<?= h(studio_csrf()) ?>">
<?php endif; ?>

<section class="st-hero" aria-label="Studio">
  <div class="river" id="river" aria-hidden="true">
    <img class="rv-still day" src="table/a/river-day.webp?v=4" alt="">
    <img class="rv-still night" src="table/a/river-night.webp?v=4" alt="">
    <img class="rv-still bday" src="table/a/river-blue-day.webp?v=1" alt="">
    <img class="rv-still bnight" src="table/a/river-blue-night.webp?v=1" alt="">
  </div>
  <div class="table" id="table" data-set="header" data-base="table/">
    <div class="layer" id="layer"></div>
    <div class="shade" aria-hidden="true"></div>
  </div>
  <nav class="st-nav" aria-label="Site">
<?php $tab = $in ? ' target="_blank" rel="noopener"' : ''; $arrow = $in ? '<span class="ext"> ↗</span>' : ''; ?>
    <a href="/"<?= $tab ?>>Home<?= $arrow ?></a>
    <a href="/play/"<?= $tab ?>>Play<?= $arrow ?></a>
    <a href="/catalog/"<?= $tab ?>>Catalog<?= $arrow ?></a>
<?php if ($in): ?>
    <form method="post"><input type="hidden" name="act" value="logout"><input type="hidden" name="csrf" value="<?= h(studio_csrf()) ?>"><button type="submit">Log out</button></form>
<?php endif; ?>
  </nav>
  <svg width="0" height="0" class="defs" aria-hidden="true"><defs>
    <linearGradient id="vBrass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6e2a6"/><stop offset=".35" stop-color="#c9994a"/><stop offset=".7" stop-color="#7b5521"/><stop offset="1" stop-color="#d8b26a"/></linearGradient>
    <radialGradient id="vHub" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#fff0c0"/><stop offset=".4" stop-color="#c9994a"/><stop offset="1" stop-color="#4f3412"/></radialGradient>
    <symbol id="valveWheel" viewBox="-50 -50 100 100" overflow="visible">
      <g class="knurl" fill="url(#vBrass)" stroke="#3b2608" stroke-width=".8"><circle r="5.4" cx="0" cy="-40"/><circle r="5.4" cx="23.5" cy="-32.4"/><circle r="5.4" cx="38" cy="-12.4"/><circle r="5.4" cx="38" cy="12.4"/><circle r="5.4" cx="23.5" cy="32.4"/><circle r="5.4" cx="0" cy="40"/><circle r="5.4" cx="-23.5" cy="32.4"/><circle r="5.4" cx="-38" cy="12.4"/><circle r="5.4" cx="-38" cy="-12.4"/><circle r="5.4" cx="-23.5" cy="-32.4"/></g>
      <circle r="40" fill="none" stroke="#3b2608" stroke-width="10.5"/>
      <circle r="40" fill="none" stroke="url(#vBrass)" stroke-width="8.5"/>
      <circle r="42.6" fill="none" stroke="rgba(255,240,200,.55)" stroke-width=".9"/>
      <g fill="url(#vBrass)" stroke="#3b2608" stroke-width=".8"><path d="M-3.4 -9 L-2.6 -36 L2.6 -36 L3.4 -9 Z"/><path d="M-3.4 -9 L-2.6 -36 L2.6 -36 L3.4 -9 Z" transform="rotate(72)"/><path d="M-3.4 -9 L-2.6 -36 L2.6 -36 L3.4 -9 Z" transform="rotate(144)"/><path d="M-3.4 -9 L-2.6 -36 L2.6 -36 L3.4 -9 Z" transform="rotate(216)"/><path d="M-3.4 -9 L-2.6 -36 L2.6 -36 L3.4 -9 Z" transform="rotate(288)"/></g>
      <circle r="12" fill="url(#vHub)" stroke="#3b2608" stroke-width="1"/>
      <polygon points="9,0 4.5,7.8 -4.5,7.8 -9,0 -4.5,-7.8 4.5,-7.8" fill="#5a3c14" stroke="#e9cf8e" stroke-width=".7"/>
    </symbol></defs></svg>
  <!-- the two controls: brass handwheels on the rock in the river. Turning one turns the river with it, in
       step with the change, and it can't be turned again until the change is done -->
  <div class="st-valves">
    <button type="button" class="valve" id="dayNight" role="switch" aria-checked="false" aria-label="Day. Switch to night" data-kind="light">
      <svg class="vw" viewBox="-50 -50 100 100" aria-hidden="true"><use href="#valveWheel" x="-50" y="-50" width="100" height="100"/><circle class="jewel" r="6.2"/><circle class="jewel-hi" cx="-1.8" cy="-2" r="1.8"/></svg>
      <span class="vtag"><small>LIGHT</small><b data-a="DAY" data-b="NIGHT">DAY</b></span>
    </button>
    <button type="button" class="valve" id="flow" role="switch" aria-checked="false" aria-label="Blue river. Switch to green" data-kind="flow">
      <svg class="vw" viewBox="-50 -50 100 100" aria-hidden="true"><use href="#valveWheel" x="-50" y="-50" width="100" height="100"/><circle class="jewel" r="6.2"/><circle class="jewel-hi" cx="-1.8" cy="-2" r="1.8"/></svg>
      <span class="vtag"><small>FLOW</small><b data-a="BLUE" data-b="GREEN">BLUE</b></span>
    </button>
  </div>
  <div class="st-label">
    <div class="st-dn">
      <span class="pipe" aria-hidden="true"></span>
      <div class="st-dial" aria-hidden="true">
        <img class="dial-disc" id="dialDisc" src="table/a/dial-disc.webp?v=2" alt="">
        <img class="dial-face" src="table/a/dial-face.webp?v=2" alt="">
      </div>
      <div class="st-plate"><h1>Studio</h1><p>Field Notes · Behind the scenes</p></div>
    </div>
  </div>
</section>
<?php if (!$in): ?>
<main class="login-main">
<form method="post" class="login-box" autocomplete="on">
  <h1>Studio</h1>
  <p class="sub">Field Notes, behind the scenes.</p>
  <input type="hidden" name="act" value="login">
  <label>Username <input type="text" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required autofocus></label>
  <label>Password <input type="password" name="password" autocomplete="current-password" required></label>
  <?php if ($error): ?><p class="err"><?= h($error) ?></p><?php endif; ?>
  <button type="submit">Log in</button>
</form>
<section class="about-studio" aria-labelledby="whatH">
  <h2 id="whatH">What the Studio does</h2>
  <p class="lede">The Studio is where a day out becomes a Field Note: a written post with photos and a map, and a short episode for the Field Notes podcast. It's a private workshop, so it needs a login; what it makes is public on <a href="/play/">Play</a>.</p>
  <ol class="steps">
    <li><b>Bring it in</b><span>Photos, video, the ride's track and any notes go into a Google Drive folder. One tap copies them to the server.</span></li>
    <li><b>Sort it out</b><span>Each folder becomes a draft note, grouped by day. Photos are resized and their location data removed before they leave the device, and private places are trimmed off the track.</span></li>
    <li><b>Draft with Claude</b><span>Claude reads the notes, the track and the photos, then writes the post, the captions and an episode script. Where it isn't sure, it asks, and the answers go back in one pass.</span></li>
    <li><b>Record the episode</b><span>The script is read by a voice tool. Drop in the audio and it's levelled to podcast loudness and made into an MP3 right here in the browser.</span></li>
    <li><b>Publish</b><span>Save keeps everything in the site's repository. Publish, and Play and the podcast feed update in about a minute.</span></li>
  </ol>
  <p class="more"><a href="/play/">See what it's made on Play →</a></p>
</section>
</main>
<?php else: ?>
<main id="app"><p class="muted">Loading…</p></main>
<?php endif; ?>
<footer class="st-foot" aria-label="Studio">
  <div class="st-foot-wood" aria-hidden="true"><span class="day"></span><span class="night"></span></div>
  <button type="button" class="st-lamps" id="lamps" aria-label="Day. Switch to night">
    <img class="lp-off" src="table/a/panel-off.webp" alt="">
    <img class="lp-day" src="table/a/panel-day.webp" alt="">
    <img class="lp-night" src="table/a/panel-night.webp" alt="">
    <span class="lp-glow"></span>
  </button>
</footer>
<?php if ($in): ?>
<div id="toast" role="status" aria-live="polite"></div>
<script src="assets/track.js?v=<?= STUDIO_VERSION ?>-3"></script>
<script src="assets/hdr.js?v=<?= STUDIO_VERSION ?>-1"></script>
<script src="../js/route-view.js?v=<?= STUDIO_VERSION ?>-4"></script>
<script src="assets/studio.js?v=<?= STUDIO_VERSION ?>-34"></script>
<?php endif; ?>
<script src="table/table.js?v=22"></script>
<script src="table/river.js?v=9"></script>
<script src="table/switch.js?v=6"></script>
<script src="table/valve.js?v=1"></script>
<script src="table/shelf.js?v=15"></script>
</body>
</html>
