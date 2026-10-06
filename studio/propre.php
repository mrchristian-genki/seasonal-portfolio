<?php
/* PROPRE ENGINE, behind the Studio login. The engine's built page sits in /propre/ (uploaded from the
   propre repo), but /propre/.htaccess sends every visit here, so only someone logged in to the Studio
   can open it. On the way out, the page's AI settings are rewritten: instead of the Cloudflare Worker
   and its shared token, it calls propre-ai.php on this server with this session's CSRF token, so no
   long-lived secret ever reaches a browser. */
declare(strict_types=1);
require __DIR__ . '/lib/bootstrap.php';

if (!studio_logged_in()) { header('Location: ./?then=propre'); exit; }
if (!studio_is_owner()) { http_response_code(403); exit('ProPre Engine is for the owner only.'); }   // it spends the owner's AI budget

$page = dirname(__DIR__) . '/propre/index.html';
if (!is_file($page)) { http_response_code(404); exit('ProPre Engine isn\'t uploaded yet.'); }
$html = (string) file_get_contents($page);

// The engine's two settings, whatever they held before.
$html = preg_replace("/var PROPRE_PROXY_URL\s*=\s*'[^']*';/", "var PROPRE_PROXY_URL = '/studio/propre-ai.php';", $html, 1);
$html = preg_replace("/var PROPRE_SECRET_TOKEN\s*=\s*'[^']*';/", "var PROPRE_SECRET_TOKEN = '" . studio_csrf() . "';", $html, 1);
// Its modules/ and other relative links still load from /propre/.
$html = preg_replace('/<head>/i', '<head><base href="/propre/">', $html, 1);

header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header('Cache-Control: no-store');
header('Content-Type: text/html; charset=utf-8');
echo $html;
