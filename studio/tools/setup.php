<?php
/* STUDIO SETUP. Run once over SSH (and again any time to change a value):

     ssh -t adapt123@<server> "php christiangehrke.com/studio/tools/setup.php"

   It asks for the Studio password, the Anthropic API key, the GitHub token and the private zones,
   and writes them to ~/studio-private/config.php (readable only by you, outside the web folder).
   Press Return at any question to keep what's already there. Nothing is printed back. */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

$dir = dirname(__DIR__, 3) . '/studio-private';
$file = "$dir/config.php";
if (!is_dir($dir)) mkdir($dir, 0700, true);
chmod($dir, 0700);
$cfg = is_file($file) ? (require $file) : [];

function ask(string $q, bool $hidden = false): string {
    echo $q;
    if ($hidden) system('stty -echo');
    $a = trim((string) fgets(STDIN));
    if ($hidden) { system('stty echo'); echo "\n"; }
    return $a;
}
function have(array $cfg, string $k): string { return empty($cfg[$k]) ? '' : ' [set; Return keeps it]'; }

echo "Studio setup for christiangehrke.com\n\n";

$u = ask('Your Studio username [' . ($cfg['owner_user'] ?? 'christian') . '; Return keeps it]: ', false);
if ($u !== '') {
    if (!preg_match('/^[a-z0-9]{2,24}$/', strtolower($u))) exit("  Letters and digits only. Nothing saved.\n");
    $cfg['owner_user'] = strtolower($u);
}

while (true) {
    $p = ask('Studio password (12+ characters)' . have($cfg, 'password_hash') . ': ', true);
    if ($p === '' && !empty($cfg['password_hash'])) break;
    if (strlen($p) < 12) { echo "  Too short.\n"; continue; }
    if (ask('Same password again: ', true) !== $p) { echo "  They didn't match.\n"; continue; }
    $cfg['password_hash'] = password_hash($p, PASSWORD_DEFAULT);
    break;
}

$k = ask('Anthropic API key (sk-ant-...)' . have($cfg, 'anthropic_api_key') . ': ', true);
if ($k !== '') {
    if (!str_starts_with($k, 'sk-ant-')) exit("  That doesn't look like an Anthropic key. Nothing saved.\n");
    $cfg['anthropic_api_key'] = $k;
}

$t = ask('GitHub token (github_pat_...)' . have($cfg, 'github_token') . ': ', true);
if ($t !== '') $cfg['github_token'] = $t;
$cfg['github_repo'] = $cfg['github_repo'] ?? 'mrchristian-genki/seasonal-portfolio';
$cfg['github_branch'] = $cfg['github_branch'] ?? 'main';

echo "\nPrivate zones: paste the contents of \"Field Notes - private zones (do not share).json\" on one line\n";
$z = ask('(it starts with {"zones":)' . (empty($cfg['private_zones']) ? '' : ' [' . count($cfg['private_zones']) . ' set; Return keeps them]') . ': ', true);
if ($z !== '') {
    $j = json_decode($z, true);
    $zones = $j['zones'] ?? null;
    if (!is_array($zones) || !$zones) exit("  Couldn't read any zones from that. Nothing saved.\n");
    foreach ($zones as $zz) if (!is_numeric($zz['lat'] ?? null) || !is_numeric($zz['lon'] ?? null)) exit("  A zone is missing lat/lon. Nothing saved.\n");
    $cfg['private_zones'] = array_map(fn($zz) => ['name' => (string) ($zz['name'] ?? 'Private'), 'lat' => (float) $zz['lat'], 'lon' => (float) $zz['lon'], 'radius' => (int) ($zz['radius'] ?? 500)], $zones);
}

foreach (['password_hash', 'anthropic_api_key', 'github_token', 'private_zones'] as $need) {
    if (empty($cfg[$need])) exit("\n$need is still empty. Run setup again to finish. Nothing saved.\n");
}

$tmp = "$file.tmp";
file_put_contents($tmp, "<?php\n// Written by studio/tools/setup.php. Private: never copy this into the web folder or git.\nreturn " . var_export($cfg, true) . ";\n");
chmod($tmp, 0600);
rename($tmp, $file);
echo "\nSaved to $file\n";

// Quick checks that the keys work (no secrets are printed).
$gh = curl_init('https://api.github.com/repos/' . $cfg['github_repo']);
curl_setopt_array($gh, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $cfg['github_token'], 'User-Agent: studio-setup', 'Accept: application/vnd.github+json']]);
$r = json_decode((string) curl_exec($gh), true);
echo 'GitHub: ' . (!empty($r['permissions']['push']) ? 'OK, can save to ' . $cfg['github_repo'] : 'the token can\'t write to ' . $cfg['github_repo'] . ' (check its repository access and Contents: Read and write)') . "\n";
$an = curl_init('https://api.anthropic.com/v1/models?limit=1');
curl_setopt_array($an, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => ['x-api-key: ' . $cfg['anthropic_api_key'], 'anthropic-version: 2023-06-01']]);
curl_exec($an);
echo 'Anthropic: ' . (curl_getinfo($an, CURLINFO_RESPONSE_CODE) === 200 ? 'OK' : 'the key was refused (check it in the Console)') . "\n";
echo "\nDone. Open https://www.christiangehrke.com/studio/ and log in.\n";
