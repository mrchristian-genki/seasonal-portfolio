/* THE MAGAZINES (Christian, Oct 19): christiangehrke.com/magazine/ is a newsstand of the made-up magazines
   (field/data/magazines.json), and /magazine/<name>/ is one of them as a standalone page in its own look
   (css/feature.css .feature.mag-<id>, css/magazine.css): its masthead, this issue's cover story and contents, every
   published Note dressed in it as a feature, a photo spread from its own pictures (field/data/magazine-art.json,
   brought in from the Studio's Magazines tab, each said to be real or made with AI), and the other magazines on the
   stand. A magazine gets its page as soon as one published Note wears it, and every deploy builds them again
   (publish.mjs calls buildMagazines), so the folder isn't kept in git. */
import fs from 'node:fs';
import path from 'node:path';

export const magSlug = (t) => String(t.masthead || t.id).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function buildMagazines(ctx) {
  const { SITE, FIELD, pages, esc, day, V, ICONS, shareMeta, show, THEME_FONTS } = ctx;
  const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
  const T = readJSON(path.join(FIELD, 'data/magazines.json')).templates || [];
  const ART = fs.existsSync(path.join(FIELD, 'data/magazine-art.json')) ? (readJSON(path.join(FIELD, 'data/magazine-art.json')).magazines || {}) : {};
  const OUT = path.join(SITE, 'magazine');
  fs.rmSync(OUT, { recursive: true, force: true });
  // each magazine's published Notes, newest first (pages are), and the ones with none have no page yet
  const byMag = {};
  pages.forEach((p) => { const F = p.e.feature; if (F && F.masthead) (byMag[F.theme || 'riveting'] = byMag[F.theme || 'riveting'] || []).push(p); });
  const live = T.filter((t) => (byMag[t.id] || []).length);
  if (!live.length) return [];
  fs.mkdirSync(OUT, { recursive: true });

  const abs = (src) => String(src || '').replace(/^\.\.\//, '/play/');   // a Note page's ../media/... from the site root
  const still = (c) => abs(c.video ? c.poster : c.src);
  const AIB = '<span class="ai-badge">Made with AI</span>', REALB = (w) => `<span class="real-badge">${w}</span>`;
  // a Note's cover picture, labelled the way its own page labels it (publish.mjs: its cover label, else the picture's)
  const coverBadge = (p) => { const l = (p.e.feature && p.e.feature.coverLabel) || (p.cover && p.cover.ai === true ? 'ai' : p.cover && p.cover.ai === false ? 'real' : ''); return l === 'ai' ? AIB : l === 'real' ? REALB(p.cover && p.cover.video ? 'Real video' : 'Real photo') : ''; };
  const artOf = (id, key) => { const a = (ART[id] && ART[id].art || {})[key]; return a && a.file && fs.existsSync(path.join(SITE, 'assets/magazines', id, a.file)) ? { src: `/assets/magazines/${id}/${a.file}?v=${esc(a.v || V)}`, source: a.source, video: /\.mp4$/.test(a.file) } : null; };
  const artBadge = (a) => a.source === 'ai' ? AIB : a.source === 'real' ? REALB(a.video ? 'Real video' : 'Real photo') : '';
  const pic = (src, poster, video, cls, alt) => video
    ? `<video class="${cls}" src="${esc(src)}" poster="${esc(poster || '')}" muted loop playsinline preload="none" data-autoplay aria-hidden="true"></video>`
    : `<img class="${cls}" src="${esc(src)}" alt="${esc(alt || '')}" loading="lazy">`;
  const fonts = (ids) => { const q = ids.map((id) => THEME_FONTS[id]).filter(Boolean).join('&'); return q ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${q}&display=swap">` : ''; };
  const page = (title, desc, url, image, body, fontIds, meta) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
${ICONS}
${shareMeta(title, desc, url, image, meta || {})}${meta && meta.ld ? `\n<script type="application/ld+json">${JSON.stringify(meta.ld).replace(/</g, '\\u003c')}</script>` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800&display=swap">
${fonts(fontIds)}
<link rel="stylesheet" href="/css/feature.css?v=${V}">
<link rel="stylesheet" href="/css/magazine.css?v=${V}">
</head><body class="zine-body">
${body}
<script src="/js/motion.js?v=2" defer></script>
<script src="/play/play.js?v=${V}" defer></script>
</body></html>
`;
  const mast = (t) => String(t.masthead || '').trim().split(/\s+/).map((w) => `<span>${esc(w)}</span>`).join(' ');
  const standCover = (t, rel) => {   // a magazine on the stand: its masthead over its picture, in its own look
    const ps = byMag[t.id], lead = ps[0], m = artOf(t.id, 'masthead'), F = lead.e.feature;
    const img = m && !m.video ? m.src : lead.cover ? still(lead.cover) : '';
    return `<a class="zn-stand-item feature mag-${esc(t.id)}" href="${rel}${magSlug(t)}/"><span class="zn-stand-cover mag-cover">${img ? `<span class="mag-img"><img src="${esc(img)}" alt="" loading="lazy"></span>` : ''}
<span class="mag-top"><b class="mag-mast">${mast(t)}</b>${t.tagline ? `<span class="mag-tag">${esc(t.tagline)}</span>` : ''}</span><span class="mag-issue">${esc(F.issue || t.issue || '')}</span></span>
<span class="zn-stand-meta"><b>${esc(t.category)}</b> ${ps.length} ${ps.length === 1 ? 'story' : 'stories'}</span></a>`;
  };

  // ---- share cards (Christian, Oct 19: "share magazines and get social media and meta cards") ----
  // Each magazine, and the newsstand, gets a 1200 x 630 card at its own address (card.jpg): its real cover in its own
  // look, drawn by field/tools/magcards.mjs from a small page here (magazine/_cards/, removed once it's drawn). Until
  // it's drawn (or if it can't be) the card is the cover story's picture, so a share always has an image.
  const ROOT = show.siteUrl.replace(/play\/?$/, '');
  const CARDS = path.join(OUT, '_cards'); fs.mkdirSync(CARDS, { recursive: true });
  const cardJobs = [];
  // a magazine's name for a browser tab or a search result: "ROLLING TERRAIN" -> "Rolling Terrain", "<SOURCE ORDER />" -> "Source Order"
  const nice = (t) => String(t.masthead || t.id).replace(/[<>\/]/g, ' ').trim().split(/\s+/).map((w, i) => w === '&' ? '&' : i && /^(of|and|the|a|an|in|on|to)$/i.test(w) ? w.toLowerCase() : w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
  const PERSON = { '@type': 'Person', name: 'Christian Gehrke', url: ROOT };
  const stamp = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h.toString(36); };
  const fallbackCard = (t, to) => {   // the cover story's picture, copied, as the card until the drawn one replaces it
    const lead = byMag[t.id][0], src = lead.cover ? still(lead.cover).replace(/\?.*$/, '') : '';
    if (src && fs.existsSync(path.join(SITE, src))) fs.copyFileSync(path.join(SITE, src), to);
  };
  const cardPage = (name, ids, inner) => { fs.writeFileSync(path.join(CARDS, name + '.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8">
${fonts(ids)}<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800&display=swap">
<link rel="stylesheet" href="/css/feature.css?v=${V}"><link rel="stylesheet" href="/css/magazine.css?v=${V}">
<style>
html,body{margin:0;width:1200px;height:630px;overflow:hidden}
.mc{position:relative;width:1200px;height:630px;overflow:hidden;background:#1c1714;color:#fff;font-family:"Nunito",sans-serif;display:flex;align-items:center;gap:56px;padding:0 70px;box-sizing:border-box}
.mc-bg{position:absolute;inset:-40px;background-size:cover;background-position:center;filter:blur(26px) saturate(1.1) brightness(.42)}
.mc>*:not(.mc-bg){position:relative}
.mc .zn-stand-item{display:block;width:330px;flex:none;text-decoration:none;color:inherit;transform:rotate(-2.5deg)}
.mc .zn-stand-cover.mag-cover{display:block;aspect-ratio:3/4;margin:0;border-radius:6px;box-shadow:0 30px 50px -18px rgba(0,0,0,.85),0 0 0 1px rgba(255,255,255,.08)}
.mc .zn-stand-item{container-type:inline-size}
.mc .zn-stand-item .mag-mast{font-size:clamp(14px,13.5cqw,48px);letter-spacing:0}
.mc .zn-stand-item .mag-tag{display:none}.mc .mag-issue{font-size:12px;padding:5px 11px}
.mc .zn-stand-meta{display:none}
.mc-text{flex:1;min-width:0}
.mc-kicker{margin:0 0 14px;font:800 17px/1.2 "Nunito",sans-serif;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.72)}
.mc-text .mag-mast{display:block;margin:0;color:#fff;font-size:76px;line-height:.95;text-shadow:0 3px 18px rgba(0,0,0,.5)}
.mc-tag{margin:18px 0 0;font:600 26px/1.3 Georgia,serif;font-style:italic;color:rgba(255,255,255,.9)}
.mc-foot{margin:30px 0 0;font:700 20px/1.3 "Nunito",sans-serif;color:rgba(255,255,255,.75)}
.mc-foot b{color:#fff}
.mc-rack{flex:none;display:grid;grid-template-columns:1fr 1fr;gap:26px 22px;width:430px}
.mc-rack .zn-stand-item{width:auto;transform:none}
.mc-rack .zn-stand-item .mag-mast{font-size:clamp(12px,13.5cqw,30px)}
.mc-rack .mag-tag,.mc-rack .mag-issue{display:none}
.mc-paper{background:#f2ede2;color:#1c2b2a}
.mc-paper .mc-kicker{color:#7a6a55}.mc-paper .mc-title{margin:0;font:800 64px/1 Georgia,serif;color:#1c2b2a}.mc-paper .mc-tag{color:#3f4f52}.mc-paper .mc-foot{color:#4c5f63}.mc-paper .mc-foot b{color:#1c2b2a}
</style></head><body>${inner}</body></html>`); };

  // ---- each magazine ----
  for (const t of live) {
    const ps = byMag[t.id], lead = ps[0], F = lead.e.feature, slug = magSlug(t), url = `${show.siteUrl.replace(/play\/?$/, '')}magazine/${slug}/`;
    const m = artOf(t.id, 'masthead'), opener = artOf(t.id, 'opener'), tex = artOf(t.id, 'texture'), mark = artOf(t.id, 'mark');
    const coverImg = m ? pic(m.src, '', m.video, 'zn-cover-pic', '') : lead.cover ? pic(abs(lead.cover.src), lead.cover.video ? still(lead.cover) : '', lead.cover.video, 'zn-cover-pic', lead.cover.caption) : '';
    const coverLabel = m ? artBadge(m) : coverBadge(lead);
    const spread = ['spread-1', 'spread-2', 'spread-3', 'spread-4', 'spread-5', 'spread-6'].map((k) => ({ k, a: artOf(t.id, k), slot: ((ART[t.id] || {}).slots || []).find((s) => s.key === k) })).filter((x) => x.a);
    const feat = (p, k) => { const G = p.e.feature || {};
      return `<article class="zn-feat${k === 0 ? ' lead' : ''}"><a href="/play/${esc(p.e.id)}/">${p.cover ? `<span class="zn-feat-pic">${pic(still(p.cover), '', false, '', p.cover.caption)}</span>` : ''}
<span class="zn-feat-body"><span class="zn-kicker">${esc(G.label || 'Feature')}</span><b>${esc(p.e.post && p.e.post.title || p.e.title)}</b>${p.e.summary ? `<span class="zn-deck">${esc(p.e.summary)}</span>` : ''}
<span class="zn-by">${G.byline ? esc(G.byline) + ' · ' : ''}<time datetime="${esc(p.e.date)}">${day(p.e.date, true)}</time></span><span class="zn-read">Read the story →</span></span></a>${coverBadge(p) ? `<p class="zn-label">${coverBadge(p)}</p>` : ''}</article>`; };
    const others = live.filter((x) => x !== t);
    const body = `<main class="feature mag-${esc(t.id)} zine"${tex ? ` style="--zn-tex:url('${esc(tex.src)}')"` : ''}>
<nav class="zn-top" aria-label="The newsstand"><a href="/magazine/">← The newsstand</a><a href="/">christiangehrke.com</a></nav>
<header class="mag-cover zn-cover"><div class="mag-img">${coverImg}</div>
<div class="mag-top"><h1 class="mag-mast">${mast(t)}</h1>${t.tagline ? `<span class="mag-tag">${esc(t.tagline)}</span>` : ''}</div>
<span class="mag-issue">${esc(F.issue || t.issue || '')}</span>${(F.coverLines || []).length ? `<ul class="mag-lines">${F.coverLines.slice(0, 4).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}</header>
<p class="mag-cap zn-cap">${coverLabel ? coverLabel + ' ' : ''}${m ? '' : `Cover story: <a href="/play/${esc(lead.e.id)}/">${esc(lead.e.post && lead.e.post.title || lead.e.title)} →</a>`}</p>
<p class="zn-about">${esc(t.category)}. ${esc(t.format)}. A made-up magazine; every story in it is one of Christian's Field Notes.</p>
<section class="zn-contents">${opener ? `<figure class="zn-opener">${pic(opener.src, '', opener.video, '', '')}<figcaption>${artBadge(opener)}</figcaption></figure>` : ''}
<h2>${mark ? `<img class="zn-mark" src="${esc(mark.src)}" alt="">` : ''}In this issue</h2>
<ol>${ps.map((p, k) => { const G = p.e.feature || {}; return `<li><a href="/play/${esc(p.e.id)}/"><span class="zn-n">${String(k + 1).padStart(2, '0')}</span><span><span class="zn-kicker">${esc(G.label || 'Feature')}</span><b>${esc(p.e.post && p.e.post.title || p.e.title)}</b>${p.e.summary ? `<span class="zn-deck">${esc(p.e.summary)}</span>` : ''}</span></a></li>`; }).join('')}</ol></section>
<section class="zn-feats" aria-label="The stories">${ps.map(feat).join('\n')}</section>
${spread.length ? `<section class="mag-book zn-logbook"><h2 class="sub">From the logbook</h2><div class="mag-book-grid L-${spread.length === 3 ? 'side' : spread.length >= 4 ? 'hero3' : 'grid2'}">${spread.map((x, k) => `<figure class="mag-look${k === 0 && spread.length !== 2 ? ' wide' : ''}"><a href="${esc(x.a.src)}" data-lightbox${x.a.video ? ' data-video' : ''}>${pic(x.a.src, '', x.a.video, '', x.slot ? x.slot.label : '')}</a><figcaption>${artBadge(x.a)} <b>${esc(x.slot ? x.slot.label.replace(/^From the logbook: /, '') : '')}</b></figcaption></figure>`).join('')}</div></section>` : ''}
</main>
<div class="zine zn-after">${others.length ? `<nav class="zn-stand zn-more" aria-label="More from the newsstand"><h2>More from the newsstand</h2><div class="zn-stand-row">${others.map((o) => standCover(o, '../')).join('')}</div></nav>` : ''}
<footer class="zn-foot"><p>${esc(t.masthead)} is one of the made-up magazines on <a href="/">christiangehrke.com</a>. The stories are real Field Notes; each picture says whether it's a real photo or made with AI.</p></footer></div>`;
    const dir = path.join(OUT, slug); fs.mkdirSync(dir, { recursive: true });
    fallbackCard(t, path.join(dir, 'card.jpg'));
    const bg = m && !m.video ? m.src : lead.cover ? still(lead.cover) : '';
    cardPage(slug, [t.id], `<div class="mc feature mag-${esc(t.id)}">${bg ? `<div class="mc-bg" style="background-image:url('${esc(bg)}')"></div>` : ''}${standCover(t, '/magazine/')}
<div class="mc-text"><p class="mc-kicker">A made-up magazine</p><b class="mag-mast">${esc(t.masthead)}</b>${t.tagline ? `<p class="mc-tag">${esc(t.tagline)}</p>` : ''}
<p class="mc-foot"><b>${ps.length} ${ps.length === 1 ? 'story' : 'stories'}</b> from the Field Notes · christiangehrke.com</p></div></div>`);
    cardJobs.push({ page: `/magazine/_cards/${slug}.html`, out: `magazine/${slug}/card.jpg` });
    const desc = `${t.category}: ${ps.length} ${ps.length === 1 ? 'story' : 'stories'} from Christian Gehrke's Field Notes, in ${t.masthead}, a made-up magazine.`;
    const html = page(`${nice(t)}: ${t.category.toLowerCase()} stories · Christian Gehrke`, desc, url, `${url}card.jpg?v=${stamp(lead.e.id + ps.length + t.masthead + (t.tagline || ''))}`,
      body.replace('<a href="/">christiangehrke.com</a></nav>', `<button type="button" class="zn-share" data-share-url="${esc(url)}" data-share-title="${esc(t.masthead)}" data-share-text="${esc(t.tagline || desc)}">Share</button><a href="/">christiangehrke.com</a></nav>`),
      [t.id, ...others.map((o) => o.id)], { w: 1200, h: 630, alt: `${t.masthead}, a made-up magazine of Christian Gehrke's Field Notes: its cover`,
        ld: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: nice(t), description: desc, url, author: PERSON, inLanguage: 'en',
          isPartOf: { '@type': 'CollectionPage', name: 'The newsstand', url: `${ROOT}magazine/` },
          hasPart: ps.map((p) => ({ '@type': 'BlogPosting', headline: p.e.post && p.e.post.title || p.e.title, url: `${ROOT}play/${p.e.id}/`, datePublished: p.e.date })) } });
    fs.writeFileSync(path.join(dir, 'index.html'), html);
  }

  // ---- the newsstand ----
  const total = live.reduce((a, t) => a + byMag[t.id].length, 0);
  const stand = `<main class="zine zn-newsstand">
<nav class="zn-top" aria-label="The site"><a href="/play/">← Play</a><button type="button" class="zn-share" data-share-url="${esc(ROOT)}magazine/" data-share-title="The newsstand" data-share-text="Made-up magazines, real stories">Share</button></nav>
<header class="zn-stand-head"><p class="zn-kicker">The newsstand</p><h1>Made-up magazines, real stories</h1>
<p class="zn-lede">${live.length} magazines, ${total} stories. Each one is a Field Note dressed as a feature in a magazine that doesn't exist: biking, hiking, drones, the workshop and more. A magazine turns up here as soon as it has a story.</p></header>
<div class="zn-rack">${live.map((t) => standCover(t, '')).join('\n')}</div>
<footer class="zn-foot"><p>Every picture says whether it's a real photo or made with AI.</p></footer>
</main>`;
  // the newsstand's card: four covers on the rack, the way Play shows them
  const rack4 = live.slice().sort((a, b) => byMag[b.id].length - byMag[a.id].length || (byMag[b.id][0].e.date > byMag[a.id][0].e.date ? 1 : -1)).slice(0, 4);
  fallbackCard(rack4[0], path.join(OUT, 'card.jpg'));
  cardPage('newsstand', rack4.map((t) => t.id), `<div class="mc mc-paper"><div class="mc-text"><p class="mc-kicker">The newsstand</p><h1 class="mc-title">Made-up magazines, real stories</h1>
<p class="mc-foot"><b>${live.length} magazines, ${total} stories</b> from the Field Notes · christiangehrke.com</p></div>
<div class="mc-rack">${rack4.map((t) => standCover(t, '/magazine/')).join('')}</div></div>`);
  cardJobs.push({ page: '/magazine/_cards/newsstand.html', out: 'magazine/card.jpg' });
  fs.writeFileSync(path.join(CARDS, 'jobs.json'), JSON.stringify(cardJobs, null, 1));
  fs.writeFileSync(path.join(OUT, 'index.html'), page('The newsstand · Christian Gehrke', `Made-up magazines, real stories: ${total} Field Notes in ${live.length} magazines.`, ROOT + 'magazine/',
    `${ROOT}magazine/card.jpg?v=${stamp(rack4.map((t) => t.id + byMag[t.id][0].e.id).join() + total)}`, stand, live.map((t) => t.id), { w: 1200, h: 630, alt: 'The newsstand: four made-up magazines on a rack',
      ld: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'The newsstand', description: 'Made-up magazines, real stories', url: `${ROOT}magazine/`, author: PERSON,
        hasPart: live.map((t) => ({ '@type': 'CollectionPage', name: nice(t), url: `${ROOT}magazine/${magSlug(t)}/` })) } }));
  const out = live.map((t) => ({ id: t.id, slug: magSlug(t), masthead: t.masthead, count: byMag[t.id].length }));
  // Play's own rack (Christian, Oct 19: "a two by two rack of actual magazines"): the four with the most stories,
  // newest cover story first among equals, as the stand shows them, on two shelves
  const four = live.slice().sort((a, b) => byMag[b.id].length - byMag[a.id].length || (byMag[b.id][0].e.date > byMag[a.id][0].e.date ? 1 : -1)).slice(0, 4);
  out.rackIds = four.map((t) => t.id);
  out.rack = [four.slice(0, 2), four.slice(2, 4)].filter((r) => r.length).map((r) => `<div class="np-row">${r.map((t) => standCover(t, '/magazine/')).join('')}</div>`).join('\n');
  return out;
}
