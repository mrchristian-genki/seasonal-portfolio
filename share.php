<?php
// The homepage, with the share card of whatever its address opens. A Note or a Daydreams series opened on
// the homepage puts its id in the address (?spring+notes+2026-10-06-the-whole-machine), and that address is
// what gets shared; Messages, Slack and social sites don't run the page's script, so they'd all see the
// homepage's card. The root .htaccess sends those addresses here (see .github/share.htaccess), and this swaps
// the homepage's title, description and share tags for the ones Play built into that item's own page.
// Anything unexpected falls back to the plain homepage.
$root = __DIR__;
$home = @file_get_contents("$root/index.html");
if ($home === false) { http_response_code(500); exit; }
header('Content-Type: text/html; charset=UTF-8');

$words = preg_split('/[+&,;\s]+/', strtolower(rawurldecode($_SERVER['QUERY_STRING'] ?? '')), -1, PREG_SPLIT_NO_EMPTY);
$page = null;
foreach ($words as $w) {
  $w = explode('=', $w)[0];
  if (!preg_match('/^[a-z0-9][a-z0-9-]{1,80}$/', $w)) continue;
  foreach (["play/$w/index.html", "play/daydreams/$w/index.html"] as $f)
    if (is_file("$root/$f")) { $page = "$root/$f"; break 2; }
}
// The homepage's own tabs (?workshop, ?web) get their own cards too.
$TABS = [
  'workshop' => ['The Workshop · Christian Gehrke', 'The tools behind this site, each told as a feature: the Studio, ProPre, the Parts Catalog, the Workshop and the lake.',
    'og-workshop.jpg?v=1', 'Six glowing workshop scenes from the tools behind the site, under the title The Workshop.'],
  'web' => ['The Tumble · Christian Gehrke', 'Scroll down and fall back in time: twenty-nine years of web development, era by era, from container queries to table layouts.',
    'web/og-tumble.jpg?v=1', 'The Tumble: a retro time machine console of copper, glowing jewel buttons and teal dials.'],
];
if (!$page) foreach ($words as $w) {
  $w = explode('=', $w)[0];
  if (!isset($TABS[$w])) continue;
  [$t, $d, $img, $alt] = array_map(fn($v) => htmlspecialchars($v, ENT_QUOTES), $TABS[$w]);
  $url = "https://www.christiangehrke.com/?$w"; $img = "https://www.christiangehrke.com/$img";
  $item = "<head><title>$t</title><meta name=\"description\" content=\"$d\"><link rel=\"canonical\" href=\"$url\">"
    . "<meta property=\"og:type\" content=\"website\"><meta property=\"og:site_name\" content=\"Christian Gehrke\"><meta property=\"og:title\" content=\"$t\">"
    . "<meta property=\"og:description\" content=\"$d\"><meta property=\"og:url\" content=\"$url\"><meta property=\"og:image\" content=\"$img\">"
    . "<meta property=\"og:image:width\" content=\"1200\"><meta property=\"og:image:height\" content=\"630\"><meta property=\"og:image:alt\" content=\"$alt\">"
    . "<meta name=\"twitter:card\" content=\"summary_large_image\"><meta name=\"twitter:title\" content=\"$t\"><meta name=\"twitter:description\" content=\"$d\">"
    . "<meta name=\"twitter:image\" content=\"$img\"></head>";
  break;
}
$item = $item ?? ($page ? @file_get_contents($page) : false);
if ($item === false || !preg_match('#<head>(.*?)</head>#s', $item, $h)) { echo $home; exit; }

// The item's share tags: its title, description, canonical address, and every og:, article: and twitter: tag.
preg_match_all('#<title>.*?</title>|<meta name="description"[^>]*>|<link rel="canonical"[^>]*>|<meta (?:property|name)="(?:og|article|twitter):[^"]*"[^>]*>#s', $h[1], $m);
if (!$m[0]) { echo $home; exit; }
$tags = implode("\n", $m[0]);

// Out with the homepage's own, in with the item's, just after the viewport tag.
$head = preg_replace('#\s*(<title>.*?</title>|<meta name="description"[^>]*>|<link rel="canonical"[^>]*>|<meta (?:property|name)="(?:og|article|twitter):[^"]*"[^>]*>)#s', '', $home, -1);
$head = preg_replace('#(<meta name="viewport"[^>]*>)#', "$1\n$tags", $head, 1);
echo $head;
