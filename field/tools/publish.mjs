#!/usr/bin/env node
/* Build the public Play pages (Field Notes) from the adventures marked Published.

     node field/tools/publish.mjs

   Writes play/ at the site root:
     play/index.html            every published adventure, newest first
     play/<id>/index.html       one adventure: episode player, route, post with photos
     play/data/<id>.json        the route for the map (trimmed line, profile, stats)
     play/media/<id>/…          the photos and the episode audio
     play/feed.xml              RSS with the episodes as enclosures (podcast apps can read it)
   Only public fields leave field/: no field notes, questions, consent records, original file names
   or photo times. Anything not Published is removed from play/ on the next run.
   play/play.css and play/play.js are hand-written and left alone. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIELD = path.resolve(here, '..');
const SITE = path.resolve(FIELD, '..');
const OUT = path.join(SITE, 'play');
const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const show = readJSON(path.join(FIELD, 'data/show.json'));
const V = Date.now().toString(36);   // cache tag for the shared css/js

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const KIND = { ride: 'Ride', hike: 'Hike', forage: 'Foraging walk', make: 'Mini-Cast' };
const day = (d, long) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', weekday: long ? 'long' : 'short', month: long ? 'long' : 'short', day: 'numeric', year: 'numeric' });
const mi = (km) => (km * 0.621371).toFixed(km * 0.621371 < 10 ? 1 : 0) + ' mi';
const ft = (m) => Math.round(m * 3.28084).toLocaleString('en-US') + ' ft';
const dur = (s) => { const h = Math.floor(s / 3600), m = Math.round(s % 3600 / 60); return h ? `${h} h ${String(m).padStart(2, '0')} m` : `${m} min`; };
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const paras = (t) => String(t || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

// MP3 length from its frames (CBR): bytes after any ID3 tag × 8 / bitrate.
function mp3Seconds(file) {
  const b = fs.readFileSync(file); let i = 0;
  if (b.slice(0, 3).toString() === 'ID3') i = 10 + ((b[6] << 21) | (b[7] << 14) | (b[8] << 7) | b[9]);
  while (i < b.length - 4 && !(b[i] === 0xff && (b[i + 1] & 0xe0) === 0xe0)) i++;
  const v = (b[i + 1] >> 3) & 3, idx = b[i + 2] >> 4;
  const rates = v === 3 ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320] : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
  return (b.length - i) * 8 / (rates[idx] * 1000);
}

const events = fs.readdirSync(path.join(FIELD, 'data/events')).filter((f) => f.endsWith('.json'))
  .map((f) => readJSON(path.join(FIELD, 'data/events', f)))
  .filter((e) => e.status === 'published' && !e.sample)
  .sort((a, b) => (a.date < b.date ? 1 : -1));

// Clear out anything from earlier runs that isn't published any more (keeps the hand-written files).
fs.mkdirSync(OUT, { recursive: true });
const keep = new Set(['play.css', 'play.js', 'index.html', 'feed.xml', 'hub.json', 'data', 'media', 'gallery', 'daydreams', 'above', ...events.map((e) => e.id)]);
for (const f of fs.readdirSync(OUT)) if (!keep.has(f)) fs.rmSync(path.join(OUT, f), { recursive: true, force: true });
for (const d of ['data', 'media']) {
  fs.mkdirSync(path.join(OUT, d), { recursive: true });
  for (const f of fs.readdirSync(path.join(OUT, d))) if (!events.some((e) => f === e.id || f === e.id + '.json')) fs.rmSync(path.join(OUT, d, f), { recursive: true, force: true });
}

// Shared with the homepage and About: the brand mark (favicon.svg at the site root) and the
// lake-scene share card, used when a page has no photo of its own.
const ICONS = '<link rel="icon" href="/favicon.ico?v=2" sizes="any"><link rel="icon" href="/favicon.svg?v=2" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2"><meta name="theme-color" content="#4f8fd0">';
const SITE_IMAGE = 'https://www.christiangehrke.com/og-image.jpg?v=2';
const robots = show.listed ? '' : '<meta name="robots" content="noindex">\n';
// Every page carries the main site's tabs (each opens that tab on the homepage) and Play's own bar.
const PLAYBAR = [['field-notes', 'Field Notes', '#field-notes'], ['daily-dose', 'Daily Dose', '#daily-dose'], ['above', 'From Above', 'above/'], ['daydreams', 'Daydreams', '#daydreams']];
const head = (title, desc, url, image, rel, sub = '') => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${robots}<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="article"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(image || SITE_IMAGE)}"><meta name="twitter:card" content="summary_large_image">
<link rel="alternate" type="application/rss+xml" title="${esc(show.showTitle)}" href="${rel}feed.xml">
${ICONS}
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">
<link rel="stylesheet" href="${rel}play.css?v=${V}">
</head>
<body>
<header class="bar"><a class="brand" href="${rel}../"><span class="dot" aria-hidden="true"></span>Christian Gehrke</a>
<nav class="site" aria-label="Site"><a href="${rel}../?books">Books</a><a href="${rel}../?web">Web</a><a href="${rel}../?workshop">Workshop</a><a class="on" href="${rel}" aria-current="page">Play</a></nav></header>
<nav class="playbar" aria-label="Play">${PLAYBAR.map(([id, label, href]) => `<a href="${rel}${href}"${id === sub ? ' class="on" aria-current="page"' : ''}>${label}</a>`).join('')}<button type="button" class="chip" id="units" hidden>mi · ft</button></nav>
`;
const foot = (rel) => `<footer class="foot"><p>${esc(show.narrationNote)}</p>
<p><a href="${rel}">Play</a> · <a href="${rel}feed.xml">Field Notes RSS</a> · <a href="${rel}../">christiangehrke.com</a></p></footer>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js" defer></script>
<script src="${rel}../js/route-view.js?v=${V}" defer></script>
<script src="${rel}play.js?v=${V}" defer></script>
</body>
</html>
`;

const pages = [];
for (const e of events) {
  const dir = path.join(OUT, e.id), media = path.join(OUT, 'media', e.id);
  fs.mkdirSync(dir, { recursive: true }); fs.rmSync(media, { recursive: true, force: true }); fs.mkdirSync(media, { recursive: true });
  const photos = (e.photos || []).filter((p) => p.use !== 'skip').map((p, i) => {
    const name = String(i + 1).padStart(2, '0') + '.jpg';
    if (p.video) {   // a short clip (with its poster frame)
      const base = String(i + 1).padStart(2, '0');
      fs.copyFileSync(path.join(FIELD, p.src), path.join(media, base + '.mp4'));
      fs.copyFileSync(path.join(FIELD, p.poster), path.join(media, base + '.jpg'));
      const tag = '?v=' + fs.statSync(path.join(FIELD, p.src)).size.toString(36);   // same name, new clip: let caches go
      return { src: `../media/${e.id}/${base}.mp4${tag}`, poster: `../media/${e.id}/${base}.jpg${tag}`, abs: `${show.siteUrl}media/${e.id}/${base}.jpg`, caption: p.caption || '', w: p.w, h: p.h, cover: false, video: true, ai: !!p.ai, table: p.table || null, after: p.after };
    }
    fs.copyFileSync(path.join(FIELD, p.src), path.join(media, name));
    return { src: `../media/${e.id}/${name}`, abs: `${show.siteUrl}media/${e.id}/${name}`, caption: p.caption || '', w: p.w, h: p.h, cover: !!p.cover };
  });
  const cover = photos.find((p) => p.cover) || photos.find((p) => !p.video) || null;
  let audio = null;
  if (e.episode && e.episode.audio && fs.existsSync(path.join(FIELD, e.episode.audio))) {
    fs.copyFileSync(path.join(FIELD, e.episode.audio), path.join(media, 'episode.mp3'));
    audio = { src: `../media/${e.id}/episode.mp3`, abs: `${show.siteUrl}media/${e.id}/episode.mp3`, bytes: fs.statSync(path.join(media, 'episode.mp3')).size, sec: mp3Seconds(path.join(media, 'episode.mp3')) };
  }
  const t = e.track || null, s = t && t.stats;
  if (t) fs.writeFileSync(path.join(OUT, 'data', e.id + '.json'), JSON.stringify({ kind: e.kind, stats: s, line: t.line, profile: t.profile, shownKm: t.trim && t.trim.shownKm }) + '\n');

  // Photos sit between the post's paragraphs (the cover heads the page), spread evenly.
  // Clips marked "table" (old photos laid out on a table) gather into one figure, after paragraph
  // "after" (0-based); its caption is the first clip's tableCaption. Others spread evenly.
  const ps = paras(e.post && e.post.body), table = photos.filter((p) => p.table), inline = photos.filter((p) => p !== cover && !p.table);
  const slots = inline.map((_, i) => Math.min(ps.length - 1, Math.round((i + 1) * ps.length / (inline.length + 1)) - 1));
  const tableSlot = table.length ? Math.min(ps.length - 1, table[0].after != null ? table[0].after : ps.length - 2) : -1;
  const tableCap = (e.photos || []).find((p) => p.tableCaption);
  const tableFig = () => `<figure class="table"><div class="table-top">${table.map((p, k) =>
    `<a class="print p${k + 1}" href="${esc(p.src)}" data-lightbox data-video title="${esc(p.caption)}"><video src="${esc(p.src)}" poster="${esc(p.poster)}" width="${p.w}" height="${p.h}" muted loop playsinline autoplay preload="metadata" aria-label="${esc(p.caption)}"></video><span class="print-cap">${esc(p.caption)}</span></a>`).join('')}</div>${tableCap ? `<figcaption><span class="ai-badge">Animated with AI</span> ${esc(tableCap.tableCaption)}</figcaption>` : ''}</figure>`;
  const fig = (p, cls) => p.video
    ? `<figure class="${cls || 'photo'} clip"><a href="${esc(p.src)}" data-lightbox data-video><video src="${esc(p.src)}" poster="${esc(p.poster)}" width="${p.w}" height="${p.h}" muted loop playsinline autoplay preload="metadata"></video></a>${p.caption ? `<figcaption>${p.ai ? '<span class="ai-badge">Made with AI</span> ' : ''}${esc(p.caption)}</figcaption>` : ''}</figure>`
    : `<figure class="${cls || 'photo'}"><a href="${esc(p.src)}" data-lightbox><img src="${esc(p.src)}" alt="${esc(p.caption)}" width="${p.w}" height="${p.h}" loading="lazy"></a>${p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : ''}</figure>`;
  let body = '';
  ps.forEach((p, i) => {
    const m = /^What I learned:\s*/i.exec(p);
    body += m ? `<p class="learned"><b>What I learned:</b> ${esc(p.slice(m[0].length))}</p>\n` : `<p>${esc(p)}</p>\n`;
    inline.forEach((ph, k) => { if (slots[k] === i) body += fig(ph) + '\n'; });
    if (i === tableSlot) body += tableFig() + '\n';
  });

  const url = `${show.siteUrl}${e.id}/`, title = `${e.post && e.post.title || e.title} · ${show.showTitle}`;
  const desc = e.summary || paras(e.post && e.post.body)[0] || '';
  const html = head(title, desc, url, cover && cover.abs, '../', 'field-notes') + `<main class="article"${t ? ` data-route="../data/${esc(e.id)}.json"` : ''}>
<p class="kicker"><span class="kind ${esc(e.kind)}">${KIND[e.kind] || esc(e.kind)}</span> · <time datetime="${esc(e.date)}">${day(e.date, true)}</time>${e.place ? ` · ${esc(e.place)}` : ''}</p>
<h1>${esc(e.post && e.post.title || e.title)}</h1>
${e.summary ? `<p class="lede">${esc(e.summary)}</p>` : ''}
${audio ? `<section class="listen" aria-label="Listen to the episode"><div><span class="listen-label">Listen · ${mmss(audio.sec)}</span><b>${esc(e.episode.title || e.title)}</b></div>
<audio controls preload="metadata" src="${esc(audio.src)}"></audio></section>` : ''}
${cover ? fig(cover, 'cover') : ''}
${t ? `<section class="route" aria-label="The route"><h2>The route</h2>
<div class="route-grid"><div class="map" id="map" role="img" aria-label="Map of the route"></div><div class="stats" id="stats">
<div class="stat"><b>${mi(s.distanceKm)}</b><span>Distance</span></div><div class="stat"><b>${dur(s.movingSec)}</b><span>Moving time</span></div>
<div class="stat"><b>${ft(s.gainM)}</b><span>Climbing</span></div><div class="stat"><b>${ft(s.maxEleM)}</b><span>High point</span></div></div></div>
<div class="profile" id="profile"></div>
${t.trim && t.trim.shownKm != null && t.trim.shownKm < s.distanceKm - 0.2 ? `<p class="note">The map shows ${mi(t.trim.shownKm)} of the ${mi(s.distanceKm)}; the numbers count all of it.</p>` : ''}
</section>` : ''}
<article class="post">
${body}</article>
${(e.links || []).length ? `<p class="links"><span>More</span> ${e.links.map((l) => `<a href="${esc(l.url)}" rel="noopener" target="_blank">${esc(l.label)}</a>`).join('')}</p>` : ''}
<nav class="pager" id="pager"></nav>
</main>
` + foot('../');
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  pages.push({ e, cover, audio, url, desc });
}

// Prev / next links, filled in now that every page exists.
pages.forEach((p, i) => {
  const newer = pages[i - 1], older = pages[i + 1], f = path.join(OUT, p.e.id, 'index.html');
  const link = (q, label) => q ? `<a href="../${q.e.id}/"><span>${label}</span>${esc(q.e.post && q.e.post.title || q.e.title)}</a>` : '<span></span>';
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('<nav class="pager" id="pager"></nav>', `<nav class="pager">${link(older, '← Earlier')}${link(newer, 'Later →')}</nav>`));
});

// Galleries: Daydreams (AI series) and From Above (drone photography), from field/data/gallery.json
// and the media fetched by tools/gallery.py.
const G = readJSON(path.join(FIELD, 'data/gallery.json'));
const GSRC = path.join(FIELD, 'data/gallery'), MAN = fs.existsSync(path.join(GSRC, 'manifest.json')) ? readJSON(path.join(GSRC, 'manifest.json')) : null;
const GOUT = path.join(OUT, 'gallery');
fs.rmSync(GOUT, { recursive: true, force: true }); fs.rmSync(path.join(OUT, 'daydreams'), { recursive: true, force: true }); fs.rmSync(path.join(OUT, 'above'), { recursive: true, force: true });
const copyMedia = (g) => { for (const f of [g.file, g.poster].filter(Boolean)) { fs.mkdirSync(path.dirname(path.join(GOUT, f)), { recursive: true }); fs.copyFileSync(path.join(GSRC, f), path.join(GOUT, f)); } };
// A tile: photos open in the lightbox; short clips loop silently in place (play.js starts them on screen).
const tile = (g, rel, label) => {
  const src = `${rel}gallery/${g.file}`, img = `${rel}gallery/${g.poster || g.file}`, cap = label || g.caption || '';
  const inner = g.video
    ? `<video muted loop playsinline preload="none" poster="${esc(img)}" width="${g.w}" height="${g.h}" data-autoplay><source src="${esc(src)}" type="video/mp4"></video><span class="loop" aria-hidden="true">▶</span>`
    : `<img src="${esc(img)}" alt="${esc(cap)}" width="${g.w}" height="${g.h}" loading="lazy">`;
  return `<figure class="tile"><a href="${esc(src)}" data-lightbox${g.video ? ' data-video' : ''}>${inner}</a>${cap ? `<figcaption>${esc(cap)}</figcaption>` : ''}</figure>`;
};
const AI = `<span class="ai-badge" title="${esc(G.tools)}">Made with AI</span>`;
const series = [];
if (MAN) {
  MAN.above.forEach(copyMedia);
  for (const s of G.daydreams) {
    const m = MAN.daydreams[s.key]; if (!m) continue;
    m.picks.forEach(copyMedia); (m.real || []).forEach(copyMedia);
    const cover = (s.cover != null && m.picks.find((g) => g.n === s.cover)) || (m.real && m.real.find((g) => !g.video)) || m.picks.find((g) => !g.video) || m.picks[0];
    series.push({ s, m, cover });
    let body;
    if (m.real) body = `<h2 class="sec">Real <span class="real-badge">Photographs</span></h2><div class="grid">${m.real.map((g) => tile(g, '../../')).join('')}</div>
<h2 class="sec">Imagined ${AI}</h2><div class="grid">${m.picks.map((g) => tile(g, '../../')).join('')}</div>`;
    else if (s.original != null) {
      const orig = m.picks.find((g) => g.n === s.original), rest = m.picks.filter((g) => g !== orig);
      body = `${orig ? `<h2 class="sec">The original <span class="real-badge">1882 photograph</span></h2><div class="grid one">${tile(orig, '../../', 'Virginia Street and Second Street, Reno, 1882.')}</div>` : ''}
<h2 class="sec">What they might have seen ${AI}</h2><div class="grid">${rest.map((g) => tile(g, '../../')).join('')}</div>`;
    } else if (s.key === 'under-the-surface') body = `<div class="grid">${m.picks.map((g, i) => tile(g, '../../', 'Scene ' + (i + 1))).join('')}</div>`;
    else body = `<div class="grid">${m.picks.map((g) => tile(g, '../../')).join('')}</div>`;
    const dir = path.join(OUT, 'daydreams', s.key); fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), head(`${s.title} · Daydreams · Play`, s.about, `${show.siteUrl}daydreams/${s.key}/`, `${show.siteUrl}gallery/${cover.poster || cover.file}`, '../../', 'daydreams') +
      `<main class="gallery-page"><p class="kicker"><a href="../../#daydreams">Daydreams</a> · ${m.real ? 'Real and imagined' : AI}</p><h1>${esc(s.title)}</h1><p class="lede">${esc(s.about)}</p>
${body}
<p class="note tools">${esc(G.tools)}</p>
<nav class="pager" data-series-pager="${s.key}"></nav></main>
` + foot('../../').replace('../../../js/', '../../../js/'));
  }
  // Earlier / next series links, now that every series page exists.
  series.forEach(({ s }, i) => {
    const f = path.join(OUT, 'daydreams', s.key, 'index.html'), prev = series[i - 1], next = series[i + 1];
    const link = (q, label, cls) => q ? `<a class="${cls}" href="../${q.s.key}/"><span>${label}</span>${esc(q.s.title)}</a>` : `<a class="${cls}" href="../../#daydreams"><span>${label}</span>All Daydreams</a>`;
    fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(`<nav class="pager" data-series-pager="${s.key}"></nav>`, `<nav class="pager">${link(prev, '← Previous', 'prev')}${link(next, 'Next →', 'next')}</nav>`));
  });
  const dir = path.join(OUT, 'above'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), head(`${G.above.title} · Play`, G.above.about, `${show.siteUrl}above/`, `${show.siteUrl}gallery/${MAN.above[0].file}`, '../', 'above') +
    `<main class="gallery-page"><p class="kicker"><a href="../#above">Play</a> · <span class="real-badge">Real photographs</span></p><h1>${esc(G.above.title)}</h1><p class="lede">${esc(G.above.about)}</p>
<div class="grid">${MAN.above.map((g) => tile(g, '../')).join('')}</div>
<nav class="pager"><a href="../#above"><span>← Back</span>Play</a><span></span></nav></main>
` + foot('../'));
}

// Daily Dose of Paradise: the newest videos from the YouTube channel's public feed, as thumbnails that
// load the player only when tapped.
let yt = [];
try {
  const x = execFileSync('curl', ['-sL', '-m', '30', `https://www.youtube.com/feeds/videos.xml?channel_id=${G.youtube.channel}`], { encoding: 'utf8' });
  yt = [...x.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m) => ({
    id: (/<yt:videoId>([^<]+)/.exec(m[1]) || [])[1], title: ((/<title>([^<]+)/.exec(m[1]) || [])[1] || '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim(),
    date: ((/<published>([^<]+)/.exec(m[1]) || [])[1] || '').slice(0, 10),
    desc: ((/<media:description>([\s\S]*?)<\/media:description>/.exec(m[1]) || [])[1] || '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim() }))
    .filter((v) => v.id && /daily dose of paradise/i.test(v.title));   // the feed holds the newest 15
} catch (err) { /* handled below */ }
// The feed is fetched on every build (here and in the deploy). If it can't be reached, keep the last
// good list rather than dropping the section.
const ytFile = path.join(FIELD, 'data', 'youtube-cache.json');
if (yt.length) fs.writeFileSync(ytFile, JSON.stringify(yt) + '\n');
else { try { yt = JSON.parse(fs.readFileSync(ytFile, 'utf8')); console.warn('YouTube feed unavailable; using the last good Daily Dose list'); } catch { console.warn('YouTube feed unavailable; Daily Dose section left out this time'); } }

// Index
const cards = pages.map(({ e, cover, audio }) => {
  const s = e.track && e.track.stats;
  return `<a class="card" href="${e.id}/">${cover ? `<img src="${esc(cover.src.replace('../', ''))}" alt="" width="${cover.w}" height="${cover.h}" loading="lazy">` : '<div class="noimg"></div>'}
<div class="card-body"><p class="kicker"><span class="kind ${esc(e.kind)}">${KIND[e.kind] || esc(e.kind)}</span> · ${day(e.date)}</p>
<h2>${esc(e.post && e.post.title || e.title)}</h2>${e.summary ? `<p>${esc(e.summary)}</p>` : ''}
<p class="meta">${s ? `${mi(s.distanceKm)} · ↑ ${ft(s.gainM)}` : ''}${audio ? ` · <span class="pill">▶ ${mmss(audio.sec)}</span>` : ''}</p></div></a>`;
}).join('\n');
const ytHTML = yt.length ? `<section id="daily-dose" class="block"><h2 class="sec">${esc(G.youtube.title)}</h2><p class="sub">${esc(G.youtube.about)}</p>
<div class="yt">${yt.slice(0, G.youtube.show).map((v) => `<figure class="yt-item"><button type="button" class="yt-play" data-yt="${esc(v.id)}" aria-label="Play ${esc(v.title)}"><img src="https://i.ytimg.com/vi/${esc(v.id)}/hqdefault.jpg" alt="" loading="lazy" width="480" height="360" onerror="this.onerror=null;this.src='https://i.ytimg.com/vi/${esc(v.id)}/mqdefault.jpg'"><span class="yt-btn" aria-hidden="true">▶</span></button><figcaption>${esc(v.title.replace(/^Daily Dose of Paradise\s*[:\-–]\s*/i, ''))}</figcaption></figure>`).join('')}</div>
<p class="more"><a href="https://www.youtube.com/${esc(G.youtube.handle)}/videos" rel="noopener">All of them on YouTube →</a></p></section>` : '';
const aboveHTML = MAN && MAN.above.length ? `<section id="above" class="block"><h2 class="sec">${esc(G.above.title)} <span class="real-badge">Real photographs</span></h2><p class="sub">${esc(G.above.about)}</p>
<div class="grid">${MAN.above.slice(0, 8).map((g) => tile(g, '')).join('')}</div><p class="more"><a href="above/">All ${MAN.above.length} →</a></p></section>` : '';
const ddHTML = series.length ? `<section id="daydreams" class="block"><h2 class="sec">Daydreams ${AI}</h2><p class="sub">Ideas that only exist as pictures, so far. ${esc(G.tools)}</p>
<div class="series">${series.map(({ s, m, cover }) => `<a class="serie" href="daydreams/${s.key}/"><img src="gallery/${esc(cover.poster || cover.file)}" alt="" loading="lazy" width="${cover.w}" height="${cover.h}"><span><b>${esc(s.title)}</b><i>${m.picks.length + (m.real ? m.real.length : 0)}${m.real ? ', real and imagined' : ''}</i></span></a>`).join('')}</div></section>` : '';
fs.writeFileSync(path.join(OUT, 'index.html'), head('Play · Christian Gehrke', show.about, show.siteUrl, pages[0] && pages[0].cover && pages[0].cover.abs, '') +
  `<main class="index"><p class="season-line">Spring, when everything is starting</p><h1>Play</h1><p class="lede">The fun part. Rides, hikes and foraging, a decade of flying, and the things I make, real and imagined.</p>
<section id="field-notes" class="block"><h2 class="sec">${esc(show.showTitle)}</h2><p class="sub">${esc(show.about)}</p>
${pages.length ? `<div class="cards">${cards}</div>` : '<p class="empty">The first one is on its way.</p>'}</section>
${ytHTML}
${aboveHTML}
${ddHTML}
</main>
` + foot(''));

// hub.json: everything in Play for the homepage's Play tab, which shows it in place (paths from the site root).
const R = (f) => 'play/' + f;
const gItem = (g, cap) => ({ src: R('gallery/' + g.file), poster: g.poster ? R('gallery/' + g.poster) : null, w: g.w, h: g.h, video: g.video, caption: cap != null ? cap : (g.caption || '') });
const totalKm = pages.reduce((a, { e }) => a + (e.track && e.track.stats ? e.track.stats.distanceKm : 0), 0);
const totalM = pages.reduce((a, { e }) => a + (e.track && e.track.stats ? e.track.stats.gainM : 0), 0);
fs.writeFileSync(path.join(OUT, 'hub.json'), JSON.stringify({
  totals: { miles: Math.round(totalKm * 0.621371), feet: Math.round(totalM * 3.28084), episodes: pages.filter((p) => p.audio).length,
    photos: MAN ? MAN.above.length : 0, daydreams: series.length },
  episodes: pages.map(({ e, cover, audio }) => ({ id: e.id, url: R(e.id + '/'), title: e.post && e.post.title || e.title, kind: KIND[e.kind] || e.kind, date: day(e.date),
    place: e.place || '', summary: e.summary || '', cover: cover ? { src: R(cover.src.replace('../', '')), w: cover.w, h: cover.h } : null,
    audio: audio ? { src: R(audio.src.replace('../', '')), time: mmss(audio.sec) } : null,
    stats: e.track && e.track.stats ? `${mi(e.track.stats.distanceKm)} · ↑ ${ft(e.track.stats.gainM)}` : '' })),
  fieldNotes: { title: show.showTitle, about: show.about, note: show.narrationNote },
  daily: yt.length ? { title: G.youtube.title, about: G.youtube.about, channel: `https://www.youtube.com/${G.youtube.handle}/videos`,
    videos: yt.map((v) => ({ id: v.id, title: v.title.replace(/^Daily Dose of Paradise\s*[:\-–]\s*/i, ''), date: v.date ? day(v.date, true) : '', desc: v.desc.slice(0, 600) })) } : null,
  above: MAN ? { title: G.above.title, about: G.above.about, url: R('above/'), items: MAN.above.map((g) => gItem(g)) } : null,
  daydreams: series.length ? { tools: G.tools, series: series.map(({ s, m, cover }) => ({ key: s.key, title: s.title, about: s.about, url: R(`daydreams/${s.key}/`),
    cover: gItem(cover), count: m.picks.length + (m.real ? m.real.length : 0),
    groups: m.real ? [{ label: 'Real', real: true, items: m.real.map((g) => gItem(g)) }, { label: 'Imagined', ai: true, items: m.picks.map((g) => gItem(g)) }]
      : s.original != null ? [{ label: 'The original', real: true, items: m.picks.filter((g) => g.n === s.original).map((g) => gItem(g, 'Virginia Street and Second Street, Reno, 1882.')) },
        { label: 'What they might have seen', ai: true, items: m.picks.filter((g) => g.n !== s.original).map((g) => gItem(g)) }]
      : [{ label: '', ai: true, items: m.picks.map((g, i) => gItem(g, s.key === 'under-the-surface' ? 'Scene ' + (i + 1) : '')) }] })) } : null
}) + '\n');

// RSS (episodes as enclosures)
const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${esc(show.showTitle)}</title>
<link>${esc(show.siteUrl)}</link>
<atom:link href="${esc(show.siteUrl)}feed.xml" rel="self" type="application/rss+xml"/>
<description>${esc(show.about + ' ' + show.narrationNote)}</description>
<language>en-us</language>
<itunes:author>Christian Gehrke</itunes:author>
<itunes:explicit>false</itunes:explicit>
${pages.map(({ e, audio, url, desc }) => `<item>
<title>${esc(e.episode && e.episode.title || e.title)}</title>
<link>${esc(url)}</link>
<guid isPermaLink="true">${esc(url)}</guid>
<pubDate>${new Date((e.publishedAt || e.date) + 'T16:00:00Z').toUTCString()}</pubDate>
<description>${esc(desc)}</description>
${audio ? `<enclosure url="${esc(audio.abs)}" length="${audio.bytes}" type="audio/mpeg"/>\n<itunes:duration>${Math.round(audio.sec)}</itunes:duration>` : ''}
</item>`).join('\n')}
</channel>
</rss>
`;
fs.writeFileSync(path.join(OUT, 'feed.xml'), rss);
console.log(`play/: ${pages.length} published (${pages.map((p) => p.e.id).join(', ') || 'none'})${show.listed ? '' : ', unlisted (noindex)'}`);
