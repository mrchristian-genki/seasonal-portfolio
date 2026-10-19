/* THE MAGAZINES' SHARE CARDS: draws each magazine's card, and the newsstand's, at 1200 x 630 (what Messages, Slack
   and social sites show for a link to it) from the small pages field/tools/magazines.mjs leaves in magazine/_cards/,
   then removes those pages. Each card is the magazine's real cover in its own look, beside its name and tagline.

   Runs after publish.mjs: node field/tools/magcards.mjs (needs Playwright and its Chromium; the deploy installs them).
   Without them, or if a card won't draw, the card stays the cover story's picture that magazines.mjs put there, and
   the deploy goes on. */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const SITE = path.join(path.dirname(new URL(import.meta.url).pathname), '../..');
const CARDS = path.join(SITE, 'magazine/_cards');
const done = (msg) => { fs.rmSync(CARDS, { recursive: true, force: true }); console.log(msg); process.exit(0); };
if (!fs.existsSync(path.join(CARDS, 'jobs.json'))) done('magazine cards: nothing to draw');
const jobs = JSON.parse(fs.readFileSync(path.join(CARDS, 'jobs.json'), 'utf8'));

let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { done('magazine cards: Playwright isn\'t installed; the cards stay the cover pictures'); }

// the site from its folder, for the card pages and everything they load
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => {
  const f = path.join(SITE, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(SITE) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;

let made = 0;
try {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  for (const j of jobs) {
    try {
      await page.goto(base + j.page, { waitUntil: 'networkidle', timeout: 30000 });
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map((i) => i.complete ? 0 : new Promise((ok) => { i.onload = i.onerror = ok; })));
      });
      await page.screenshot({ path: path.join(SITE, j.out), type: 'jpeg', quality: 86 });
      made++;
    } catch (err) { console.log(`magazine cards: ${j.out} stays the cover picture (${err.message.split('\n')[0]})`); }
  }
  await browser.close();
} catch (err) { console.log(`magazine cards: the browser didn't start (${err.message.split('\n')[0]})`); }
server.close();
done(`magazine cards: ${made} of ${jobs.length} drawn`);
