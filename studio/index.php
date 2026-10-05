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
<link rel="stylesheet" href="assets/studio.css?v=<?= STUDIO_VERSION ?>-38">
<link rel="stylesheet" href="table/table.css?v=62">
</head>
<?php if (!$in): ?>
<body class="login">
<?php else: ?>
<body data-csrf="<?= h(studio_csrf()) ?>">
<?php endif; ?>

<section class="st-hero" aria-label="Studio">
  <div class="river" id="river" aria-hidden="true">
    <img class="rv-still day" src="table/a/river-day.webp?v=5" alt="">
    <img class="rv-still night" src="table/a/river-night.webp?v=5" alt="">
    <img class="rv-still bday" src="table/a/river-blue-day.webp?v=3" alt="">
    <img class="rv-still bnight" src="table/a/river-blue-night.webp?v=3" alt="">
    <img class="rv-still oday" src="table/a/river-orange-day.webp?v=1" alt="">
    <img class="rv-still onight" src="table/a/river-orange-night.webp?v=1" alt="">
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
  <div class="st-label">
    <div class="st-dn">
      <span class="pipe" aria-hidden="true"></span>
      <div class="st-dial" aria-hidden="true">
        <img class="dial-disc" id="dialDisc" src="table/a/dial-disc.webp?v=2" alt="">
        <img class="dial-face" src="table/a/dial-face.webp?v=2" alt="">
      </div>
      <div class="st-plate"><h1>Studio</h1><p>Field Notes · Behind the scenes</p></div>
      <!-- the two controls: a toggle and its pilot lamps (day, night; blue, green, orange); while the river changes, the lamp it's
           going to breathes and the slot under the toggle fills (toggle.js) -->
      <div class="st-ctl">
        <button type="button" class="tgl" id="dayNight" data-kind="light" role="switch" aria-checked="false" aria-label="Day. Switch to night">
          <span class="tg-row"><span class="lamp" data-i="0" aria-hidden="true"></span><span class="tg-sw" aria-hidden="true"><span class="bat"></span></span><span class="lamp" data-i="1" aria-hidden="true"></span></span>
          <span class="tg-bar" aria-hidden="true"><span></span></span>
          <span class="tg-lbl" aria-hidden="true">DAY/NIGHT</span>
        </button>
        <button type="button" class="tgl" id="flow" data-kind="flow" aria-label="Blue liquid. Change to green">
          <span class="tg-row"><span class="tg-sw" aria-hidden="true"><span class="bat"></span></span><span class="lamp" data-i="0" aria-hidden="true"></span><span class="lamp" data-i="1" aria-hidden="true"></span><span class="lamp" data-i="2" aria-hidden="true"></span></span>
          <span class="tg-bar" aria-hidden="true"><span></span></span>
          <span class="tg-lbl" aria-hidden="true">CHANGE LIQUID</span>
        </button>
      </div>
    </div>
  </div>
</section>
<?php if (!$in): ?>
<main class="login-main">
<form method="post" class="login-box" autocomplete="on">
  <h1>Studio</h1>
  <input type="hidden" name="act" value="login">
  <label><span>Username</span> <input type="text" name="username" placeholder="Username" autocomplete="username" autocapitalize="none" spellcheck="false" required autofocus></label>
  <label><span>Password</span> <input type="password" name="password" placeholder="Password" autocomplete="current-password" required></label>
  <button type="submit">Log in</button>
  <?php if ($error): ?><p class="err"><?= h($error) ?></p><?php endif; ?>
</form>
<section class="about-studio" aria-labelledby="whatH">
  <h2 id="whatH">What the Studio does</h2>
  <p class="lede">Where a day out becomes a Field Note: a post with photos and a map, and a short podcast episode. Private to work in; what it makes is public on <a href="/play/">Play</a>.</p>
  <ol class="steps">
    <li><b>Bring it in</b><span>Photos, video, the track and notes, copied from Drive.</span></li>
    <li><b>Sort it out</b><span>A draft per day; locations stripped, private places trimmed.</span></li>
    <li><b>Draft with Claude</b><span>The post, captions and script, with questions where unsure.</span></li>
    <li><b>Record</b><span>The episode, levelled to podcast loudness in the browser.</span></li>
    <li><b>Publish</b><span>Play and the podcast feed update in about a minute.</span></li>
  </ol>
</section>
</main>
<?php else: ?>
<main id="app"><p class="muted">Loading…</p></main>
<?php endif; ?>
<footer class="st-foot" aria-label="Studio">
  <div class="st-flow" id="footFlow" aria-hidden="true">
    <img class="fs bd" src="table/a/foot-blue-day.webp?v=1" alt=""><img class="fs bn" src="table/a/foot-blue-night.webp?v=1" alt="">
    <img class="fs gd" src="table/a/foot-green-day.webp?v=1" alt=""><img class="fs gn" src="table/a/foot-green-night.webp?v=1" alt="">
    <img class="fs od" src="table/a/foot-orange-day.webp?v=1" alt=""><img class="fs on" src="table/a/foot-orange-night.webp?v=1" alt="">
  </div>
</footer>
<?php if ($in): ?>
<div id="toast" role="status" aria-live="polite"></div>
<script src="assets/track.js?v=<?= STUDIO_VERSION ?>-3"></script>
<script src="assets/hdr.js?v=<?= STUDIO_VERSION ?>-1"></script>
<script src="../js/route-view.js?v=<?= STUDIO_VERSION ?>-4"></script>
<script src="assets/studio.js?v=<?= STUDIO_VERSION ?>-34"></script>
<?php endif; ?>
<script src="table/table.js?v=25"></script>
<script src="table/river.js?v=16"></script>
<script src="table/switch.js?v=8"></script>
<script src="table/toggle.js?v=2"></script>
<script src="table/foot.js?v=2"></script>
<script src="table/shelf.js?v=22"></script>
</body>
</html>
