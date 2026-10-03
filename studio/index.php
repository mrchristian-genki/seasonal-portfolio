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
        elseif (studio_login((string) ($_POST['password'] ?? ''))) { header('Location: ./'); exit; }
        else $error = 'That password isn\'t right.';
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
<link rel="icon" href="/favicon.svg?v=2" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;800&display=swap">
<link rel="stylesheet" href="assets/studio.css?v=<?= STUDIO_VERSION ?>-5">
<link rel="stylesheet" href="table/table.css?v=16">
</head>
<?php if (!$in): ?>
<body class="login">
<form method="post" class="login-box" autocomplete="on">
  <h1>Studio</h1>
  <p class="sub">Field Notes, behind the scenes.</p>
  <input type="hidden" name="act" value="login">
  <label>Password <input type="password" name="password" autocomplete="current-password" required autofocus></label>
  <?php if ($error): ?><p class="err"><?= h($error) ?></p><?php endif; ?>
  <button type="submit">Log in</button>
</form>
</body>
<?php else: ?>
<body data-csrf="<?= h(studio_csrf()) ?>">

<section class="st-hero" aria-label="Studio">
  <div class="table" id="table" data-set="header" data-base="table/">
    <img class="wood day" src="table/a/table-day.webp" alt="">
    <img class="wood night" src="table/a/table-night.webp" alt="">
    <div class="lamp-pool" aria-hidden="true"></div>
    <div class="layer" id="layer"></div>
    <div class="shade" aria-hidden="true"></div>
  </div>
  <nav class="st-nav" aria-label="Studio">
    <a href="/play/" target="_blank" rel="noopener">Play ↗</a>
    <form method="post"><input type="hidden" name="act" value="logout"><input type="hidden" name="csrf" value="<?= h(studio_csrf()) ?>"><button type="submit">Log out</button></form>
  </nav>
  <div class="st-label">
    <img class="st-logo" src="/icon-512.png?v=2" alt="">
    <div class="st-card"><h1>Studio</h1><p>Field Notes, behind the scenes</p></div>
  </div>
</section>
<main id="app"><p class="muted">Loading…</p></main>
<footer class="st-foot" aria-label="Studio">
  <div class="st-foot-wood" aria-hidden="true"><span class="day"></span><span class="night"></span></div>
  <div class="st-dial" aria-hidden="true">
    <img class="dial-disc" id="dialDisc" src="table/a/dial-disc.webp?v=2" alt="">
    <img class="dial-face" src="table/a/dial-face.webp?v=2" alt="">
  </div>
  <button type="button" class="st-switch" id="dayNight" role="switch" aria-checked="false" aria-label="Day. Switch to night">
    <img class="sw-day" src="table/a/switch-day.webp" alt="">
    <img class="sw-night" src="table/a/switch-night.webp" alt="">
    <span class="sw-label sw-top">DAY</span><span class="sw-label sw-bottom">NIGHT</span>
    <span class="sw-glow" aria-hidden="true"></span>
  </button>
</footer>
<div id="toast" role="status" aria-live="polite"></div>
<script src="assets/track.js?v=<?= STUDIO_VERSION ?>"></script>
<script src="assets/studio.js?v=<?= STUDIO_VERSION ?>-6"></script>
<script src="table/table.js?v=16"></script>
<script src="table/switch.js?v=2"></script>
</body>
<?php endif; ?>
</html>
