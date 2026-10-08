/* THE WORKSHOP'S PROJECTS on the Workshop tab (css/ws-cards.css). One card per big project, from its case study on Play
   (assets/workshop/projects.json: its clips and captions, taken from the Note): the card loops its clip, one card at a
   time as a little tour, and a hover plays one; a click opens its case study as a magazine feature (its story from
   the Note, its clips through the column, a pull quote and its numbers) with links to the tool and to its episode. Starts when the cards come near the screen. */
(function () {
  'use strict';
  var box = document.querySelector('[data-wscards]'); if (!box) return;
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches, P = [], cards = [], dlg = null;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function play(c, on) {
    var v = c.querySelector('video'); if (!v) return;
    if (on) { if (!v.src) v.src = v.getAttribute('data-src'); c.classList.add('on'); var p = v.play(); if (p && p.catch) p.catch(function () {}); }
    else { c.classList.remove('on'); v.pause(); }
  }
  function card(p, i) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'wsc-card' + (i === 0 ? ' wide' : '');
    var m = p.card || p.media[0] || {};
    b.innerHTML = '<img alt="" loading="lazy" decoding="async" src="' + esc(m.poster || m.src) + '">' +
      (m.type === 'video' && !still ? '<video muted loop playsinline preload="none" data-src="' + esc(m.src) + '"></video>' : '') +
      '<span class="wsc-more">See more</span><span class="wsc-t"><b>' + esc(p.name) + '</b><span>' + esc(p.tagline) + '</span></span>';
    b.setAttribute('aria-label', p.name + ': ' + p.tagline + '. Open for more.');
    b.addEventListener('mouseenter', function () { cards.forEach(function (c) { if (c !== b) play(c, false); }); play(b, true); });
    b.addEventListener('mouseleave', function () { play(b, false); });
    b.addEventListener('click', function () { open(p); });
    return b;
  }
  // the window: the project's case study set as a magazine feature (css/feature.css, as on her RIVETING TONE profile): its
  // clip as the cover, a feature head, the story in a column with its clips set between the paragraphs, a pull quote,
  // the numbers, and the links. Clips play while they're on screen.
  function pic(m) {
    var wh = m.w && m.h ? ' width="' + m.w + '" height="' + m.h + '"' : '';   // so it keeps its own shape before it loads
    return m.type === 'video'
      ? '<video muted loop playsinline preload="none" poster="' + esc(m.poster || '') + '" data-src="' + esc(m.src) + '"' + wh + (still ? ' controls' : '') + '></video>'
      : '<img alt="' + esc(m.caption || '') + '" loading="lazy" src="' + esc(m.src) + '">';
  }
  function fig(m) { return '<figure class="wsf-fig"><div class="wsf-pic">' + pic(m) + '</div>' + (m.caption ? '<figcaption>' + esc(m.caption) + '</figcaption>' : '') + '</figure>'; }
  function open(p) {
    cards.forEach(function (c) { play(c, false); });
    if (!dlg) {
      dlg = document.createElement('dialog'); dlg.className = 'wsm'; document.body.appendChild(dlg);
      dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });   // a click on the dimmed page closes it
      dlg.addEventListener('close', function () { [].forEach.call(dlg.querySelectorAll('video'), function (v) { v.pause(); }); });
    }
    var n = P.indexOf(p), next = P[(n + 1) % P.length], cover = p.card || p.media[0], rest = p.media.filter(function (m) { return m.src !== cover.src; });
    var story = (p.story && p.story.length ? p.story : [p.summary]).map(function (t) { return '<p>' + esc(t) + '</p>'; });
    // the clips go between the paragraphs, spread through the story; the pull quote after the second paragraph
    // (a clip with "after" goes right after that paragraph, counting from 1; the rest are spread evenly)
    var slots = {}, gaps = Math.max(1, story.length - 1), free = rest.filter(function (m) { return !m.after; });
    rest.forEach(function (m) { if (m.after) { var at = Math.min(story.length, Math.max(1, m.after)); (slots[at] = slots[at] || []).push(m); } });
    free.forEach(function (m, i) { var at = Math.min(story.length - 1, Math.max(1, Math.round((i + 1) * gaps / (free.length + 1)))); (slots[at] = slots[at] || []).push(m); });
    var body = story.map(function (t, i) {
      return t + (slots[i + 1] || []).map(function (m) { return fig(m); }).join('') +
        (i === 1 && p.pull ? '<blockquote class="pull"><p>' + esc(p.pull) + '</p></blockquote>' : '');
    }).join('');
    var links = (p.tool ? '<a class="btn solid" href="' + esc(p.tool.url) + '"' + (p.tool.url.charAt(0) === '#' ? '' : ' target="_blank" rel="noopener"') + '>' + esc(p.tool.label) + '</a>' : '') +
      (p.extra ? '<a class="btn solid" href="' + esc(p.extra.url) + '">' + esc(p.extra.label) + '</a>' : '') +
      '<a class="btn" href="' + esc(p.note) + '">Listen to its episode</a>';
    dlg.innerHTML = '<div class="wsm-bar"><button type="button" class="wsm-x" aria-label="Close">×</button></div>' +
      '<article class="feature wsf">' +
      '<header class="mag-cover wsf-cover"><div class="mag-img">' + pic(cover) + '</div>' +
      '<div class="mag-top"><span class="wsf-mast">The Workshop</span><span class="mag-tag">Project ' + (n + 1) + ' of ' + P.length + '</span></div></header>' +
      (cover.caption ? '<p class="mag-cap">' + esc(cover.caption) + '</p>' : '') +
      '<div class="mag-head"><p class="mag-label">' + esc(p.name) + ' · Case study</p><h1>' + esc(p.title || p.name) + '</h1><p class="mag-deck">' + esc(p.summary) + '</p>' +
      '<p class="mag-byline"><span>Words and pictures by Christian Gehrke</span><span>' + esc(p.date) + '</span></p></div>' +
      '<div class="post">' + body + '</div>' +
      (p.numbers ? '<aside class="wsf-nums"><h2>By the numbers</h2><ul>' + p.numbers.map(function (x) { return '<li><b>' + esc(x[0]) + '</b><span>' + esc(x[1]) + '</span></li>'; }).join('') + '</ul></aside>' : '') +
      '<div class="wsm-links">' + links + '</div>' +
      '<button type="button" class="wsf-next"><span>Next feature</span><b>' + esc(next.title || next.name) + ' <i aria-hidden="true">→</i></b></button>' +
      '</article>';
    dlg.querySelector('.wsm-x').onclick = function () { dlg.close(); };
    dlg.querySelector('.wsf-next').onclick = function () { open(next); };
    [].forEach.call(dlg.querySelectorAll('.wsm-links a[href^="#"]'), function (a) { a.onclick = function () { dlg.close(); }; });
    // each clip plays while it's on screen in the window
    var vids = dlg.querySelectorAll('video');
    if ('IntersectionObserver' in window && !still) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { var v = e.target; if (e.isIntersecting) { if (!v.src) v.src = v.getAttribute('data-src'); var r = v.play(); if (r && r.catch) r.catch(function () {}); } else v.pause(); });
      }, { root: dlg, threshold: .35 });
      [].forEach.call(vids, function (v) { io.observe(v); });
      dlg.addEventListener('close', function () { io.disconnect(); }, { once: true });
    } else [].forEach.call(vids, function (v) { v.src = v.getAttribute('data-src'); });
    if (!dlg.open) { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); }
    dlg.scrollTop = 0;
  }
  // the tour: every few seconds the next card in view plays its clip, the others rest
  var at = 0;
  function tour() {
    setTimeout(function () {
      if (!document.hidden && box.offsetParent && !(dlg && dlg.open) && !box.matches(':hover')) {
        var seen = cards.filter(function (c) { var q = c.getBoundingClientRect(); return q.bottom > 60 && q.top < innerHeight - 60; });
        cards.forEach(function (c) { play(c, false); });
        if (seen.length) play(seen[at++ % seen.length], true);
      }
      tour();
    }, 5200);
  }
  function start() {
    fetch('assets/workshop/projects.json?v=4').then(function (r) { return r.json(); }).then(function (list) {
      P = list; P.forEach(function (p, i) { var c = card(p, i); box.appendChild(c); cards.push(c); });
      if (!still) { play(cards[0], true); tour(); }
    }).catch(function () { box.hidden = true; });
  }
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es, o) { if (es.some(function (e) { return e.isIntersecting; })) { o.disconnect(); start(); } }, { rootMargin: '300px' }).observe(box);
  else start();
})();
