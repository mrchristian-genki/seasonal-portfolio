<?php
/* PROPRE ENGINE's AI calls. Does what the Cloudflare Worker did (add the Anthropic key and pass the
   request on), but only for a logged-in Studio session, with the page's CSRF token in X-ProPre-Token,
   and with the key from the Studio's private config. The engine sends Messages API bodies and reads
   Anthropic's reply as it comes back. */
declare(strict_types=1);
require __DIR__ . '/lib/bootstrap.php';

header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
if (!studio_logged_in()) json_fail('Please log in to the Studio again.', 401);
if (!studio_is_owner()) json_fail('ProPre Engine is for the owner only.', 403);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_fail('Method not allowed.', 405);
if (!hash_equals(studio_csrf(), $_SERVER['HTTP_X_PROPRE_TOKEN'] ?? '')) json_fail('This page is out of date. Reload it and try again.', 403);

$in = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($in) || !is_array($in['messages'] ?? null) || !$in['messages']) json_fail('Bad request.');
$model = (string) ($in['model'] ?? '');
if (!preg_match('/^claude-[a-z0-9.-]{1,60}$/', $model)) json_fail('Unknown model.');

// Only the fields the engine uses, with a ceiling on length.
$body = ['model' => $model, 'max_tokens' => max(1, min(8000, (int) ($in['max_tokens'] ?? 1024))), 'messages' => $in['messages']];
foreach (['system', 'temperature'] as $k) if (isset($in[$k])) $body[$k] = $in[$k];

$cfg = studio_config();
set_time_limit(180);
$ch = curl_init(rtrim($cfg['anthropic_base_url'] ?? 'https://api.anthropic.com', '/') . '/v1/messages');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($body, JSON_UNESCAPED_UNICODE),
    CURLOPT_HTTPHEADER => ['content-type: application/json', 'anthropic-version: 2023-06-01', 'x-api-key: ' . $cfg['anthropic_api_key']],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 170,
]);
$out = curl_exec($ch);
$code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$err = curl_error($ch);
curl_close($ch);
if ($out === false) json_fail('Could not reach the AI service: ' . $err, 502);

http_response_code($code ?: 502);
header('Content-Type: application/json; charset=utf-8');
echo $out;
