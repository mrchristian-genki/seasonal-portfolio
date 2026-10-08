/* THE WORKSHOP'S PROJECTS on the Workshop tab (css/ws-cards.css). One card per big project, from its case study on Play
   (assets/workshop/projects.json: its clips and captions, taken from the Note): the card loops its clip, one card at a
   time as a little tour, and a hover plays one; a click opens a window with all its clips (a strip to switch), what
   it is, and links to the tool and to its case study. Starts when the cards come near the screen. */
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
  // the window: a stage, the caption, a strip of its clips, the story and the links
  function open(p) {
    cards.forEach(function (c) { play(c, false); });
    if (!dlg) {
      dlg = document.createElement('dialog'); dlg.className = 'wsm'; document.body.appendChild(dlg);
      dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });   // a click on the dimmed page closes it
      dlg.addEventListener('close', function () { var v = dlg.querySelector('video'); if (v) v.pause(); });
    }
    var links = (p.tool ? '<a class="btn solid" href="' + esc(p.tool.url) + '"' + (p.tool.url.charAt(0) === '#' ? '' : ' target="_blank" rel="noopener"') + '>' + esc(p.tool.label) + '</a>' : '') +
      (p.extra ? '<a class="btn solid" href="' + esc(p.extra.url) + '">' + esc(p.extra.label) + '</a>' : '') +
      '<a class="btn" href="' + esc(p.note) + '">Read the case study</a>';
    dlg.innerHTML = '<div class="wsm-stage"><button type="button" class="wsm-x" aria-label="Close">×</button></div><p class="wsm-cap"></p>' +
      (p.media.length > 1 ? '<div class="wsm-thumbs">' + p.media.map(function (m, i) { return '<button type="button" data-i="' + i + '" aria-label="' + esc(m.caption || ('Picture ' + (i + 1))) + '"><img alt="" loading="lazy" src="' + esc(m.poster || m.src) + '"></button>'; }).join('') + '</div>' : '') +
      '<div class="wsm-body"><h3>' + esc(p.name) + '</h3><p class="wsm-tag">' + esc(p.tagline) + '</p><p>' + esc(p.summary) + '</p><div class="wsm-links">' + links + '</div></div>';
    var stage = dlg.querySelector('.wsm-stage'), cap = dlg.querySelector('.wsm-cap');
    function show(i) {
      var m = p.media[i]; if (!m) return; var old = stage.querySelector('video,img'); if (old) old.remove();
      var el = document.createElement(m.type === 'video' ? 'video' : 'img');
      if (m.type === 'video') { el.muted = true; el.loop = true; el.playsInline = true; el.controls = true; el.poster = m.poster || ''; el.src = m.src; if (!still) el.autoplay = true; }
      else { el.alt = m.caption || ''; el.src = m.src; }
      stage.insertBefore(el, stage.firstChild); cap.textContent = m.caption || '';
      [].forEach.call(dlg.querySelectorAll('.wsm-thumbs button'), function (b) { b.classList.toggle('on', +b.getAttribute('data-i') === i); });
    }
    var start = Math.max(0, p.media.indexOf(p.card));
    show(start);
    [].forEach.call(dlg.querySelectorAll('.wsm-thumbs button'), function (b) { b.onclick = function () { show(+b.getAttribute('data-i')); }; });
    dlg.querySelector('.wsm-x').onclick = function () { dlg.close(); };
    [].forEach.call(dlg.querySelectorAll('.wsm-links a[href^="#"]'), function (a) { a.onclick = function () { dlg.close(); }; });
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
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
    fetch('assets/workshop/projects.json?v=2').then(function (r) { return r.json(); }).then(function (list) {
      P = list; P.forEach(function (p, i) { var c = card(p, i); box.appendChild(c); cards.push(c); });
      if (!still) { play(cards[0], true); tour(); }
    }).catch(function () { box.hidden = true; });
  }
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es, o) { if (es.some(function (e) { return e.isIntersecting; })) { o.disconnect(); start(); } }, { rootMargin: '300px' }).observe(box);
  else start();
})();
