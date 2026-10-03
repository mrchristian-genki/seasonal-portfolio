<?php
/* STUDIO: the repo is the store. Entries are read from and saved to seasonal-portfolio on GitHub
   (field/data/events/<id>.json plus field/data/photos/<id>/), so Claude Code sessions and the
   Studio always see the same thing. Each save is one commit; the deploy workflow then rebuilds
   Play and uploads it. Uses a fine-grained token limited to this one repo (Contents: read/write). */
declare(strict_types=1);

final class GitHub
{
    private string $repo;
    private string $branch;
    private string $token;
    private string $base;

    public function __construct(array $cfg)
    {
        $this->repo = $cfg['github_repo'];
        $this->branch = $cfg['github_branch'] ?? 'main';
        $this->token = $cfg['github_token'];
        $this->base = $cfg['github_api'] ?? 'https://api.github.com';   // overridable only for local testing
    }

    private function call(string $method, string $path, ?array $body = null, string $accept = 'application/vnd.github+json'): array
    {
        $ch = curl_init($this->base . $path);
        $headers = [
            'Authorization: Bearer ' . $this->token,
            'Accept: ' . $accept,
            'X-GitHub-Api-Version: 2022-11-28',
            'User-Agent: christiangehrke-studio',
        ];
        if ($body !== null) $headers[] = 'Content-Type: application/json';
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 60,
        ]);
        if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_SLASHES));
        $raw = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        if ($raw === false) throw new RuntimeException('GitHub: ' . $err);
        return [$code, $raw];
    }

    private function json(string $method, string $path, ?array $body = null): array
    {
        [$code, $raw] = $this->call($method, $path, $body);
        $data = json_decode($raw, true);
        if ($code >= 300) throw new RuntimeException("GitHub $code: " . ($data['message'] ?? substr($raw, 0, 200)));
        return $data ?? [];
    }

    /** A text file from the branch, or null if it isn't there. */
    public function read(string $file): ?string
    {
        [$code, $raw] = $this->call('GET', "/repos/{$this->repo}/contents/" . $this->encode($file) . '?ref=' . rawurlencode($this->branch), null, 'application/vnd.github.raw+json');
        if ($code === 404) return null;
        if ($code >= 300) throw new RuntimeException("GitHub $code reading $file");
        return $raw;
    }

    /** Raw bytes of a file (for photos), or null. */
    public function readBytes(string $file): ?string
    {
        return $this->read($file);
    }

    /** Names of the files in a folder. */
    public function listDir(string $dir): array
    {
        [$code, $raw] = $this->call('GET', "/repos/{$this->repo}/contents/" . $this->encode($dir) . '?ref=' . rawurlencode($this->branch));
        if ($code === 404) return [];
        if ($code >= 300) throw new RuntimeException("GitHub $code listing $dir");
        return array_map(fn($f) => $f['name'], array_filter(json_decode($raw, true) ?: [], fn($f) => $f['type'] === 'file'));
    }

    /**
     * One commit with several files. $files maps repo path => ['text' => string], ['base64' => string],
     * ['sha' => an uploaded blob]
     * or null to delete the file.
     */
    public function commit(array $files, string $message): string
    {
        $ref = $this->json('GET', "/repos/{$this->repo}/git/ref/heads/" . rawurlencode($this->branch));
        $parent = $ref['object']['sha'];
        $base = $this->json('GET', "/repos/{$this->repo}/git/commits/$parent");
        $tree = [];
        foreach ($files as $path => $f) {
            if ($f === null) { $tree[] = ['path' => $path, 'mode' => '100644', 'type' => 'blob', 'sha' => null]; continue; }
            if (isset($f['sha'])) { $tree[] = ['path' => $path, 'mode' => '100644', 'type' => 'blob', 'sha' => $f['sha']]; continue; }
            $blob = isset($f['base64'])
                ? $this->json('POST', "/repos/{$this->repo}/git/blobs", ['content' => $f['base64'], 'encoding' => 'base64'])
                : $this->json('POST', "/repos/{$this->repo}/git/blobs", ['content' => $f['text'], 'encoding' => 'utf-8']);
            $tree[] = ['path' => $path, 'mode' => '100644', 'type' => 'blob', 'sha' => $blob['sha']];
        }
        $newTree = $this->json('POST', "/repos/{$this->repo}/git/trees", ['base_tree' => $base['tree']['sha'], 'tree' => $tree]);
        $commit = $this->json('POST', "/repos/{$this->repo}/git/commits", ['message' => $message, 'tree' => $newTree['sha'], 'parents' => [$parent]]);
        // Not forced: if someone pushed in between, this fails and the save can simply be retried.
        $this->json('PATCH', "/repos/{$this->repo}/git/refs/heads/" . rawurlencode($this->branch), ['sha' => $commit['sha'], 'force' => false]);
        return $commit['sha'];
    }

    /** Upload one file's bytes (base64) as a blob; returns its id for a later commit. */
    public function blob(string $base64): string
    {
        return $this->json('POST', "/repos/{$this->repo}/git/blobs", ['content' => $base64, 'encoding' => 'base64'])['sha'];
    }

    private function encode(string $path): string
    {
        return implode('/', array_map('rawurlencode', explode('/', $path)));
    }
}
