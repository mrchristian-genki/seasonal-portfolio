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

const here = path.dirname(fileURLToPath(import.meta.url));
const FIELD = path.resolve(here, '..');
const SITE = path.resolve(FIELD, '..');
const OUT = path.join(SITE, 'play');
const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const show = readJSON(path.join(FIELD, 'data/show.json'));
const V = Date.now().toString(36);   // cache tag for the shared css/js

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const KIND = { ride: 'Ride', hike: 'Hike', forage: 'Foraging walk' };
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
const keep = new Set(['play.css', 'play.js', 'index.html', 'feed.xml', 'data', 'media', ...events.map((e) => e.id)]);
for (const f of fs.readdirSync(OUT)) if (!keep.has(f)) fs.rmSync(path.join(OUT, f), { recursive: true, force: true });
for (const d of ['data', 'media']) {
  fs.mkdirSync(path.join(OUT, d), { recursive: true });
  for (const f of fs.readdirSync(path.join(OUT, d))) if (!events.some((e) => f === e.id || f === e.id + '.json')) fs.rmSync(path.join(OUT, d, f), { recursive: true, force: true });
}

const robots = show.listed ? '' : '<meta name="robots" content="noindex">\n';
const head = (title, desc, url, image, rel) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${robots}<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="article"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(url)}">
${image ? `<meta property="og:image" content="${esc(image)}"><meta name="twitter:card" content="summary_large_image">` : ''}
<link rel="alternate" type="application/rss+xml" title="${esc(show.showTitle)}" href="${rel}feed.xml">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='15' fill='%23d8618f'/%3E%3Cpath d='M5 23l7-9 5 6 3-4 7 7z' fill='%230f4d47'/%3E%3C/svg%3E">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">
<link rel="stylesheet" href="${rel}play.css?v=${V}">
</head>
<body>
<header class="bar"><a class="brand" href="${rel}"><span class="dot" aria-hidden="true"></span>${esc(show.showTitle)}</a>
<nav><a href="${rel}../">Christian Gehrke</a><button type="button" class="chip" id="units" hidden>mi · ft</button></nav></header>
`;
const foot = (rel) => `<footer class="foot"><p>${esc(show.narrationNote)}</p>
<p><a href="${rel}">All field notes</a> · <a href="${rel}feed.xml">RSS</a> · <a href="${rel}../">christiangehrke.com</a></p></footer>
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
    fs.copyFileSync(path.join(FIELD, p.src), path.join(media, name));
    return { src: `../media/${e.id}/${name}`, abs: `${show.siteUrl}media/${e.id}/${name}`, caption: p.caption || '', w: p.w, h: p.h, cover: !!p.cover };
  });
  const cover = photos.find((p) => p.cover) || photos[0] || null;
  let audio = null;
  if (e.episode && e.episode.audio && fs.existsSync(path.join(FIELD, e.episode.audio))) {
    fs.copyFileSync(path.join(FIELD, e.episode.audio), path.join(media, 'episode.mp3'));
    audio = { src: `../media/${e.id}/episode.mp3`, abs: `${show.siteUrl}media/${e.id}/episode.mp3`, bytes: fs.statSync(path.join(media, 'episode.mp3')).size, sec: mp3Seconds(path.join(media, 'episode.mp3')) };
  }
  const t = e.track || null, s = t && t.stats;
  if (t) fs.writeFileSync(path.join(OUT, 'data', e.id + '.json'), JSON.stringify({ kind: e.kind, stats: s, line: t.line, profile: t.profile, shownKm: t.trim && t.trim.shownKm }) + '\n');

  // Photos sit between the post's paragraphs (the cover heads the page), spread evenly.
  const ps = paras(e.post && e.post.body), inline = photos.filter((p) => p !== cover);
  const slots = inline.map((_, i) => Math.min(ps.length - 1, Math.round((i + 1) * ps.length / (inline.length + 1)) - 1));
  const fig = (p, cls) => `<figure class="${cls || 'photo'}"><a href="${esc(p.src)}" data-lightbox><img src="${esc(p.src)}" alt="${esc(p.caption)}" width="${p.w}" height="${p.h}" loading="lazy"></a>${p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : ''}</figure>`;
  let body = '';
  ps.forEach((p, i) => {
    const m = /^What I learned:\s*/i.exec(p);
    body += m ? `<p class="learned"><b>What I learned:</b> ${esc(p.slice(m[0].length))}</p>\n` : `<p>${esc(p)}</p>\n`;
    inline.forEach((ph, k) => { if (slots[k] === i) body += fig(ph) + '\n'; });
  });

  const url = `${show.siteUrl}${e.id}/`, title = `${e.post && e.post.title || e.title} · ${show.showTitle}`;
  const desc = e.summary || paras(e.post && e.post.body)[0] || '';
  const html = head(title, desc, url, cover && cover.abs, '../') + `<main class="article" data-route="../data/${esc(e.id)}.json">
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
${(e.links || []).length ? `<p class="links">Trail info: ${e.links.map((l) => `<a href="${esc(l.url)}" rel="noopener">${esc(l.label)}</a>`).join(' · ')}</p>` : ''}
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

// Index
const cards = pages.map(({ e, cover, audio }) => {
  const s = e.track && e.track.stats;
  return `<a class="card" href="${e.id}/">${cover ? `<img src="${esc(cover.src.replace('../', ''))}" alt="" width="${cover.w}" height="${cover.h}" loading="lazy">` : '<div class="noimg"></div>'}
<div class="card-body"><p class="kicker"><span class="kind ${esc(e.kind)}">${KIND[e.kind] || esc(e.kind)}</span> · ${day(e.date)}</p>
<h2>${esc(e.post && e.post.title || e.title)}</h2>${e.summary ? `<p>${esc(e.summary)}</p>` : ''}
<p class="meta">${s ? `${mi(s.distanceKm)} · ↑ ${ft(s.gainM)}` : ''}${audio ? ` · <span class="pill">▶ ${mmss(audio.sec)}</span>` : ''}</p></div></a>`;
}).join('\n');
fs.writeFileSync(path.join(OUT, 'index.html'), head(show.showTitle + ' · Christian Gehrke', show.about, show.siteUrl, pages[0] && pages[0].cover && pages[0].cover.abs, '') +
  `<main class="index"><p class="season-line">Spring, when everything is starting</p><h1>${esc(show.showTitle)}</h1><p class="lede">${esc(show.about)}</p>
${pages.length ? `<div class="cards">${cards}</div>` : '<p class="empty">The first one is on its way.</p>'}
</main>
` + foot('').replace(/\.\.\/js\//, '../js/'));

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
