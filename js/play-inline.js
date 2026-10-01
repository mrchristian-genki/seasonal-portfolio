/* PLAY, IN PLACE: the homepage's Play tab shows everything from play/hub.json right there, so nobody
   has to leave the lake: Field Notes episodes (play from the card), Daily Dose of Paradise (YouTube
   loads only when tapped), From Above and the Daydreams series, which open in a panel under the
   cards. Each thing still has its own page under play/ to share. Nothing loads until the Play tab
   is opened. */
(function () {
  'use strict';
  var box = document.getElementById('playInline');
  if (!box) return;
  var view = box.closest('.view'), loaded = false;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var AI = '<span class="pi-badge ai">Made with AI</span>', REAL = '<span class="pi-badge real">Real photographs</span>';

  function tile(g) {
    var inner = g.video
      ? '<video muted loop playsinline preload="none" poster="' + esc(g.poster) + '" width="' + g.w + '" height="' + g.h + '"><source src="' + esc(g.src) + '" type="video/mp4"></video><span class="pi-loop" aria-hidden="true">▶</span>'
      : '<img src="' + esc(g.src) + '" alt="' + esc(g.caption) + '" width="' + g.w + '" height="' + g.h + '" loading="lazy">';
    return '<figure class="pi-tile"><a href="' + esc(g.src) + '" data-pi-box' + (g.video ? ' data-video' : '') + '>' + inner + '</a>' +
      (g.caption ? '<figcaption>' + esc(g.caption) + '</figcaption>' : '') + '</figure>';
  }

  function render(h) {
    var out = '<nav class="pi-jump">' +
      (h.episodes.length ? '<a href="#pi-notes">Field Notes</a>' : '') + (h.daily ? '<a href="#pi-daily">Daily Dose of Paradise</a>' : '') +
      (h.above ? '<a href="#pi-above">From Above</a>' : '') + (h.daydreams ? '<a href="#pi-dd">Daydreams</a>' : '') + '</nav>';

    if (h.episodes.length) out += '<section id="pi-notes" class="pi-sec"><h3>' + esc(h.fieldNotes.title) + '</h3><p class="pi-sub">' + esc(h.fieldNotes.about) + '</p>' +
      h.episodes.map(function (e) {
        return '<article class="pi-ep">' + (e.cover ? '<img src="' + esc(e.cover.src) + '" alt="" width="' + e.cover.w + '" height="' + e.cover.h + '" loading="lazy">' : '') +
          '<div><p class="pi-kick">' + esc(e.kind) + ' · ' + esc(e.date) + (e.stats ? ' · ' + esc(e.stats) : '') + '</p><h4>' + esc(e.title) + '</h4><p>' + esc(e.summary) + '</p>' +
          (e.audio ? '<audio controls preload="none" src="' + esc(e.audio.src) + '"></audio>' : '') +
          '<p class="pi-more"><a href="' + esc(e.url) + '" data-pi-story>The story, the map and the photos →</a></p></div></article>';
      }).join('') + '<p class="pi-note">' + esc(h.fieldNotes.note) + '</p></section>';

    if (h.daily) out += '<section id="pi-daily" class="pi-sec"><h3>' + esc(h.daily.title) + '</h3><p class="pi-sub">' + esc(h.daily.about) + '</p><div class="pi-yt">' +
      h.daily.videos.map(function (v) {
        return '<figure><button type="button" class="pi-ytbtn" data-yt="' + esc(v.id) + '" aria-label="Play ' + esc(v.title) + '"><img src="https://i.ytimg.com/vi/' + esc(v.id) +
          '/hqdefault.jpg" alt="" loading="lazy" width="480" height="360"><span aria-hidden="true">▶</span></button><figcaption>' + esc(v.title) + '</figcaption></figure>';
      }).join('') + '</div><p class="pi-more"><a href="' + esc(h.daily.channel) + '" target="_blank" rel="noopener">All of them on YouTube →</a></p></section>';

    if (h.above) out += '<section id="pi-above" class="pi-sec"><h3>' + esc(h.above.title) + ' ' + REAL + '</h3><p class="pi-sub">' + esc(h.above.about) + '</p>' +
      '<div class="pi-grid" data-more="8">' + h.above.items.map(tile).join('') + '</div>' +
      (h.above.items.length > 8 ? '<p class="pi-more"><button type="button" class="pi-show">Show all ' + h.above.items.length + '</button></p>' : '') + '</section>';

    if (h.daydreams) out += '<section id="pi-dd" class="pi-sec"><h3>Daydreams ' + AI + '</h3><p class="pi-sub">Ideas that only exist as pictures, so far. ' + esc(h.daydreams.tools) + '</p>' +
      '<div class="pi-series">' + h.daydreams.series.map(function (s, i) {
        return '<button type="button" class="pi-serie" data-i="' + i + '" aria-expanded="false"><img src="' + esc(s.cover.poster || s.cover.src) + '" alt="" loading="lazy" width="' + s.cover.w + '" height="' + s.cover.h + '"><span><b>' + esc(s.title) + '</b><i>' + s.count + '</i></span></button>';
      }).join('') + '</div><div class="pi-panel" id="piPanel" hidden></div></section>';

    box.innerHTML = out;
    wire(h);
  }

  // Short clips loop only while on screen (never with reduced motion).
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var io = 'IntersectionObserver' in window && !reduce ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { var p = e.target.play(); if (p && p.catch) p.catch(function () {}); } else e.target.pause(); });
  }, { threshold: 0.35 }) : null;
  function watch(root) { if (io) root.querySelectorAll('video:not([controls])').forEach(function (v) { io.observe(v); }); }

  function openSeries(h, i) {
    var s = h.daydreams.series[i], panel = document.getElementById('piPanel'), n = h.daydreams.series.length;
    box.querySelectorAll('.pi-serie').forEach(function (b) { b.setAttribute('aria-expanded', String(+b.dataset.i === i)); b.classList.toggle('on', +b.dataset.i === i); });
    panel.innerHTML = '<div class="pi-panel-head"><h4>' + esc(s.title) + '</h4><button type="button" class="pi-close" aria-label="Close">×</button></div><p class="pi-sub">' + esc(s.about) + '</p>' +
      s.groups.map(function (g) {
        return (g.label ? '<h5>' + esc(g.label) + ' ' + (g.real ? REAL.replace('Real photographs', s.groups.length > 1 && g.label === 'The original' ? '1882 photograph' : 'Photographs') : AI) + '</h5>' : '') +
          '<div class="pi-grid">' + g.items.map(tile).join('') + '</div>';
      }).join('') +
      '<nav class="pi-pager"><button type="button" data-go="' + ((i - 1 + n) % n) + '">← ' + esc(h.daydreams.series[(i - 1 + n) % n].title) + '</button>' +
      '<a href="' + esc(s.url) + '">Page to share</a><button type="button" data-go="' + ((i + 1) % n) + '">' + esc(h.daydreams.series[(i + 1) % n].title) + ' →</button></nav>';
    panel.hidden = false; watch(panel);
    panel.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }

  function wire(h) {
    watch(box);
    box.addEventListener('click', function (ev) {
      var t = ev.target, b;
      if ((b = t.closest('.pi-jump a'))) { ev.preventDefault(); var to = document.querySelector(b.getAttribute('href')); if (to) to.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); return; }
      if ((b = t.closest('.pi-serie'))) { if (b.classList.contains('on')) { closePanel(); return; } openSeries(h, +b.dataset.i); return; }
      if ((b = t.closest('[data-go]'))) { openSeries(h, +b.dataset.go); return; }
      if (t.closest('.pi-close')) { closePanel(); return; }
      if ((b = t.closest('.pi-show'))) { b.closest('.pi-sec').querySelector('.pi-grid').removeAttribute('data-more'); b.parentNode.remove(); return; }
      if ((b = t.closest('[data-yt]'))) {
        var f = document.createElement('iframe');
        f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(b.dataset.yt) + '?autoplay=1&rel=0';
        f.allow = 'autoplay; encrypted-media; picture-in-picture'; f.allowFullscreen = true; f.title = b.getAttribute('aria-label');
        b.replaceWith(f); return;
      }
      if ((b = t.closest('[data-pi-story]'))) { ev.preventDefault(); story(b.getAttribute('href')); return; }
      if ((b = t.closest('[data-pi-box]'))) { ev.preventDefault(); lightbox(b); }
    });
    box.querySelectorAll('.pi-ytbtn img').forEach(function (im) { im.onerror = function () { im.onerror = null; im.src = im.src.replace('hqdefault', 'mqdefault'); }; });
  }
  function closePanel() {
    var panel = document.getElementById('piPanel'); panel.hidden = true; panel.innerHTML = '';
    box.querySelectorAll('.pi-serie').forEach(function (b) { b.classList.remove('on'); b.setAttribute('aria-expanded', 'false'); });
    document.getElementById('pi-dd').scrollIntoView({ block: 'start' });
  }

  // The full story (post, route map, photos) in a pop-up over the homepage. It reads the episode's
  // own page and shows its article, so the two never drift apart.
  var sdlg = null, assets = null;
  function need(tag, attrs) { return new Promise(function (ok) { var el = document.createElement(tag); for (var k in attrs) el[k] = attrs[k]; el.onload = el.onerror = ok; document.head.appendChild(el); }); }
  function mapAssets() {
    return assets || (assets = Promise.all([
      need('link', { rel: 'stylesheet', href: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css' }),
      window.L ? 0 : need('script', { src: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js' })
    ]).then(function () { return window.RouteView ? 0 : need('script', { src: 'js/route-view.js?v=1793280000' }); }));
  }
  function story(url) {
    if (!sdlg) {
      sdlg = document.createElement('dialog'); sdlg.className = 'pi-story';
      sdlg.innerHTML = '<div class="pi-story-bar"><a class="pi-story-link" href="#" target="_blank" rel="noopener">Open as a page</a><button type="button" class="pi-close" aria-label="Close">×</button></div><div class="pi-story-body"></div>';
      sdlg.querySelector('.pi-close').onclick = function () { sdlg.close(); };
      sdlg.addEventListener('click', function (e) { if (e.target === sdlg) sdlg.close(); });
      sdlg.addEventListener('close', function () { var a = sdlg.querySelector('audio'); if (a) a.pause(); if (window.RouteView) RouteView.clearMaps(); });
      sdlg.querySelector('.pi-story-body').addEventListener('click', function (e) { var a = e.target.closest('[data-lightbox]'); if (a) { e.preventDefault(); a.setAttribute('data-pi-box', ''); lightbox(a); } });
      document.body.appendChild(sdlg);
    }
    var body = sdlg.querySelector('.pi-story-body'), abs = new URL(url, location.href);
    sdlg.querySelector('.pi-story-link').href = abs.href;
    body.innerHTML = '<p class="pi-sub">Loading…</p>'; sdlg.showModal(); body.scrollTop = 0;
    fetch(abs.href).then(function (r) { return r.text(); }).then(function (html) {
      var art = new DOMParser().parseFromString(html, 'text/html').querySelector('main.article');
      if (!art) throw 0;
      art.querySelectorAll('.pager').forEach(function (n) { n.remove(); });
      [art].concat([].slice.call(art.querySelectorAll('[src],[href],[data-route]'))).forEach(function (n) {
        ['src', 'href', 'data-route'].forEach(function (k) { var v = n.getAttribute(k); if (v && !/^(https?:|#|data:|mailto:)/.test(v)) n.setAttribute(k, new URL(v, abs).href); });
      });
      body.innerHTML = ''; body.appendChild(document.importNode(art, true));
      var route = body.querySelector('[data-route]');
      if (route && body.querySelector('#map')) mapAssets().then(function () { return fetch(route.getAttribute('data-route')); }).then(function (r) { return r.json(); }).then(function (d) {
        var RV = window.RouteView; if (!RV) return;
        body.querySelector('#stats').innerHTML = RV.statTiles(d.stats, d.kind);
        var map = window.L ? RV.makeMap(body.querySelector('#map'), RV.routeLayers(d.line)) : null;
        RV.profileSVG(body.querySelector('#profile'), d.profile, RV.scrubber(map, d.line));
        if (map) setTimeout(function () { map.invalidateSize(); }, 60);
      }).catch(function () {});
    }).catch(function () { location.href = abs.href; });
  }

  var dlg = null;
  function lightbox(a) {
    if (!window.HTMLDialogElement) { window.open(a.href, '_blank'); return; }
    if (!dlg) {
      dlg = document.createElement('dialog'); dlg.className = 'pi-lightbox';
      dlg.innerHTML = '<img alt=""><video controls loop playsinline muted hidden></video><p></p><button type="button" aria-label="Close">×</button>';
      dlg.querySelector('button').onclick = function () { dlg.close(); };
      dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
      dlg.addEventListener('close', function () { var v = dlg.querySelector('video'); v.pause(); v.removeAttribute('src'); v.load(); });
      document.body.appendChild(dlg);
    }
    var vid = a.hasAttribute('data-video'), im = dlg.querySelector('img'), v = dlg.querySelector('video'), cap = a.parentNode.querySelector('figcaption');
    if (dlg.open) dlg.close();
    im.hidden = vid; v.hidden = !vid;
    if (vid) { v.src = a.getAttribute('href'); var p = v.play(); if (p && p.catch) p.catch(function () {}); } else { im.src = a.getAttribute('href'); im.alt = (a.querySelector('img') || {}).alt || ''; }
    dlg.querySelector('p').textContent = cap ? cap.textContent : '';
    dlg.showModal();
  }

  function load() {
    if (loaded) return; loaded = true;
    fetch(box.getAttribute('data-hub')).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(render)
      .catch(function () { loaded = false; box.innerHTML = '<p class="pi-sub"><a href="play/">Open Play</a></p>'; });
  }
  // Load the first time the Play tab is showing (it can also be the tab the page opens on).
  function check() { if (view && view.classList.contains('on')) load(); }
  if (view) new MutationObserver(check).observe(view, { attributes: true, attributeFilter: ['class'] });
  check();
})();
