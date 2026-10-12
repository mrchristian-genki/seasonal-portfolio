// The Studio refuses a save from a stale page (studio/api.php POST save, studio/assets/studio.js staleSave).
// A harness, not the real server: the PHP is stripped from studio/index.php, the page's files come from this
// checkout, and api.php is mocked here, keeping a one-Note "repo" and checking each save's version the way
// api.php does (the Note's git blob sha). A "merged PR" then changes the repo's copy behind the open page.
//
//   node field/tools/studio-stale-save.test.mjs      (uses the Playwright installed with Node; exits 1 on a failure)
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); }
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ORIGIN = 'http://studio.test';
const ID = '2026-10-01-stale-test';
const STALE = 'This Note changed since you opened it; reload to get the latest.';

// ---- the page: studio/index.php as a logged-in owner sees it ----
function page() {
  let s = readFileSync(path.join(ROOT, 'studio/index.php'), 'utf8');
  s = s.slice(s.indexOf('?>') + 2);                                                   // the login handling at the top
  s = s.replace(/<\?php if \(!\$in\): \?>[\s\S]*?<\?php else: \?>([\s\S]*?)<\?php endif; \?>/g, '$1');
  s = s.replace(/<\?php if \(\$in\): \?>([\s\S]*?)<\?php endif; \?>/g, '$1');
  s = s.replace(/<\?= h\(studio_csrf\(\)\) \?>/g, 'test-csrf').replace(/<\?= STUDIO_VERSION \?>/g, '1');
  s = s.replace(/<\?php[\s\S]*?\?>/g, '').replace(/<\?=[\s\S]*?\?>/g, '');
  return s;
}

// ---- the "repo": the Note's file, as api.php's repo_json writes it ----
const repo = { text: null, saves: 0, refused: 0 };
const json = (e) => JSON.stringify(e, null, 1) + '\n';
const blobSha = (t) => t == null ? null : createHash('sha1').update(`blob ${Buffer.byteLength(t)}\0`).update(t).digest('hex');
function note() {
  return {
    id: ID, title: 'Stale test', date: '2026-10-01', kind: 'make', place: 'The Workshop', status: 'draft',
    summary: 'A Note for the stale-save test.', trailhead: null, links: [], track: null, photos: [],
    fieldNotes: 'Notes.', post: { title: 'Stale test', body: 'The first post text.' }, episode: { title: '', script: '', audio: null },
    questions: [], consent: '', palette: ['#6986d3', '#d18f60'], paletteBy: 'hand',
    feature: { lookbook: { items: [{ src: `data/photos/${ID}/scene-1.jpg` }, { src: `data/photos/${ID}/scene-2.jpg` }] } },
  };
}
function mergedPr(change) { const e = JSON.parse(repo.text); change(e); repo.text = json(e); }

// a body comes up as a multipart file scrambled with X-Mask (studio.js api())
function unmask(req) {
  const buf = req.postDataBuffer(), key = Buffer.from(req.headers()['x-mask'], 'hex');
  const start = buf.indexOf('\r\n\r\n') + 4, end = buf.lastIndexOf('\r\n--');
  const b = Buffer.from(buf.subarray(start, end));
  for (let i = 0; i < b.length; i++) b[i] ^= key[i & 31];
  return JSON.parse(b.toString('utf8'));
}
function api(route, req) {
  const u = new URL(req.url()), a = u.searchParams.get('a');
  const out = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  if (a === 'config') return out({ zones: [], trailheads: [], statuses: JSON.parse(readFileSync(path.join(ROOT, 'field/data/show.json'), 'utf8')).statuses, audioPrompt: '', audioPrompts: {}, siteUrl: '', magazines: [], me: { name: 'Christian', role: 'owner' } });
  if (a === 'list') return out({ entries: [] });
  if (a === 'entry') return out({ entry: JSON.parse(repo.text), live: JSON.parse(repo.text), review: null, version: { live: blobSha(repo.text), review: null } });
  if (a === 'save') {
    const body = unmask(req), base = body.base;
    // api.php: the version the page sent must be the repo's copy now
    if (!base || base.live !== blobSha(repo.text) || base.review !== null) {
      repo.refused++;
      return out({ error: STALE, stale: true, current: JSON.parse(repo.text), version: { live: blobSha(repo.text), review: null } }, 409);
    }
    repo.text = json(body.entry); repo.saves++;
    return out({ ok: true, commit: 'c'.repeat(40), entry: body.entry, version: { live: blobSha(repo.text), review: null } });
  }
  return out({});   // the rest (drive, inbox, looks...) aren't part of this test
}

// ---- checks ----
let failed = 0;
function check(ok, what) { console.log((ok ? '  ok   ' : '  FAIL ') + what); if (!ok) failed++; }

const browser = await pw.chromium.launch();
const ctx = await browser.newContext();
await ctx.route('**/*', (route, req) => {
  const u = new URL(req.url());
  if (u.origin !== ORIGIN) return route.abort();                                        // fonts and the like
  if (u.pathname === '/studio/api.php') return api(route, req);
  if (u.pathname === '/studio/' || u.pathname === '/studio/index.php') return route.fulfill({ contentType: 'text/html', body: page() });
  const rel = u.pathname === '/studio/assets/track.js' ? 'field/track.js' : decodeURIComponent(u.pathname.slice(1));   // copied there at deploy
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !existsSync(file)) return route.fulfill({ status: 404, body: '' });
  return route.fulfill({ path: file });
});
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('dialog', (d) => d.accept());

async function open() {
  await p.goto(`${ORIGIN}/studio/?e=${ID}`);
  await p.waitForSelector('#postBody', { state: 'attached' });
}
async function editPost(text) {
  await p.evaluate((t) => { const d = document.querySelector('#postBody').closest('details'); if (d) d.open = true; }, null);
  await p.fill('#postBody', text);
  await p.dispatchEvent('#postBody', 'input');
}
async function save() { await p.click('#save'); }
const saved = () => JSON.parse(repo.text);

// 1. a merged PR changes the look book while the page is open; the edit made here is to the post
console.log('A stale save, with edits to other parts of the Note');
repo.text = json(note());
await open();
mergedPr((e) => { e.feature.lookbook.items = [{ src: `data/photos/${ID}/loop-1.mp4` }, { src: `data/photos/${ID}/loop-2.mp4` }]; });
const prCopy = repo.text;
await editPost('The post text, edited on a page opened before the PR merged.');
await save();
await p.waitForSelector('#stale.on');
check(repo.refused === 1 && repo.saves === 0 && repo.text === prCopy, 'the save is refused and the repo keeps the PR\'s copy');
const msg = await p.textContent('#stale');
check(/This Note changed since you opened it/.test(msg), 'it says the Note changed since it was opened');
check(/here \(post\.body\)/.test(msg) && /there \(feature\.lookbook\.items\)/.test(msg), 'it names the edit made here (post.body) and the newer change (feature.lookbook.items), nothing else');
const fade = await p.$eval('#stale', (el) => { const c = getComputedStyle(el); return { d: parseFloat(c.transitionDuration), f: c.transitionTimingFunction, p: c.transitionProperty }; });
check(fade.d >= 0.6 && fade.f === 'ease-in-out' && /opacity/.test(fade.p), `the notice eases in (${fade.p} ${fade.d}s ${fade.f})`);
check(await p.$('#staleMerge') !== null, 'it offers to put the edits on the latest copy');

// 2. put the edits on the latest copy, then save: both changes are kept
await p.click('#staleMerge');
await p.waitForSelector('#stale', { state: 'detached' });
check(await p.inputValue('#postBody') === 'The post text, edited on a page opened before the PR merged.', 'the edit is still in the editor');
await save();
await p.waitForFunction(() => document.querySelector('#saveState')?.textContent === 'Saved');
check(repo.saves === 1, 'the save goes through');
check(saved().feature.lookbook.items[0].src.endsWith('loop-1.mp4'), 'the PR\'s look book (the loops) is kept');
check(saved().post.body === 'The post text, edited on a page opened before the PR merged.', 'the edit made here is in it too');

// 3. a second save from the same page carries the new version, and isn't refused
await editPost('Edited again.');
await save();
await p.waitForFunction(() => document.querySelector('#saveState')?.textContent === 'Saved');
check(repo.saves === 2 && repo.refused === 1 && saved().post.body === 'Edited again.', 'the next save from the same page goes through');

// 4. both changed the same part: no merge, only reload
console.log('A stale save, with both changing the same part');
await open();
mergedPr((e) => { e.post.body = 'Changed in a PR.'; });
const prCopy2 = repo.text;
await editPost('Changed here too.');
await save();
await p.waitForSelector('#stale.on');
check(repo.refused === 2 && repo.text === prCopy2, 'the save is refused and the repo keeps the PR\'s copy');
check(/both changed/.test(await p.textContent('#stale')) && await p.$('#staleMerge') === null, 'it says both changed post.body and offers no merge');
await p.click('#staleReload');
await p.waitForFunction(() => document.querySelector('#postBody')?.value === 'Changed in a PR.');
check(true, 'Reload the latest brings in the PR\'s copy');

// 5. a page without a version (an older Studio page) is refused the same way
const r = await p.evaluate(async () => (await fetch('api.php?a=save', { method: 'POST', headers: { 'X-CSRF': 'x', 'X-Mask': '00'.repeat(32) }, body: (() => { const f = new FormData(); f.append('f', new Blob([JSON.stringify({ entry: { id: 'x' } })]), 'p.bin'); return f; })() })).status);
check(r === 409, 'a save with no version is refused');

check(errors.length === 0, 'no errors on the page' + (errors.length ? ': ' + errors.join('; ') : ''));
await browser.close();
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
