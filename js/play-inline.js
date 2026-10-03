/* PLAY, IN PLACE: the homepage's Play tab shows everything from play/hub.json right there.
   Default view: every section, each limited (Field Notes 3, Daily Dose 4, From Above 8, Daydreams 8)
   with View all. A chip or View all isolates one section (the others fade away, the full set fades
   in). Anything clicked opens a modal: the episode story, a Daily Dose video with its date, a
   photo, a Daydreams series. The view and open item live in the address like the rest of the site
   (?spring+daydreams+fake-tahoe), and back/forward work. Nothing loads until the Play tab opens. */
(function () {
  'use strict';
  var box = document.getElementById('playInline');
  if (!box) return;
  var view = box.closest('.view'), loaded = false;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var AI = '<span class="pi-badge ai">Made with AI</span>', REAL = '<span class="pi-badge real">Real photographs</span>';


  // ── State: which view, and which item's modal is open. Mirrored in the address bar the same way as
  //    the rest of the site: ?spring+daydreams, ?spring+daydreams+fake-tahoe, ?notes, ?above…
  var SECTIONS = ['notes', 'dose', 'above', 'daydreams'];
  var LIMIT = { notes: 3, dose: 4, above: 8, daydreams: 8 };
  var H = null, state = { view: 'all', item: null };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FADE = reduce ? 0 : 260;

  function words() { return (decodeURIComponent(location.search.slice(1)).toLowerCase().split(/[+&,;\s]+/)).map(function (w) { return w.split('=')[0]; }).filter(Boolean); }
  function readURL() {
    var ws = words(), v = 'all', item = null;
    ws.forEach(function (w) { if (SECTIONS.indexOf(w) >= 0) v = w; });
    if (H) ws.forEach(function (w) {
      if (H.daydreams && H.daydreams.series.some(function (s) { return s.key === w; })) { item = w; if (v === 'all') v = 'daydreams'; }
      if (H.episodes.some(function (e) { return e.id === w; })) { item = w; if (v === 'all') v = 'notes'; }
    });
    return { view: v, item: item };
  }
  // Words for scene.js to keep, and our own writes to the address.
  window.__playWords = function () { var w = []; if (state.view !== 'all') w.push(state.view); if (state.item) w.push(state.item); return w; };
  function writeURL(push) {
    var keep = words().filter(function (w) { return SECTIONS.indexOf(w) < 0 && !isItem(w); });
    if (!keep.some(function (w) { return /^(spring|lab)$/.test(w); })) keep.unshift('spring');
    var q = keep.concat(window.__playWords()).join('+');
    try { history[push ? 'pushState' : 'replaceState']({ play: true }, '', location.pathname + (q ? '?' + q : '') + location.hash); } catch (e) {}
  }
  function isItem(w) { return !!H && (H.episodes.some(function (e) { return e.id === w; }) || (H.daydreams && H.daydreams.series.some(function (s) { return s.key === w; }))); }

  // ── Building blocks
  function tile(g) {
    var inner = g.video
      ? '<video muted loop playsinline preload="none" poster="' + esc(g.poster) + '" width="' + g.w + '" height="' + g.h + '"><source src="' + esc(g.src) + '" type="video/mp4"></video><span class="pi-loop" aria-hidden="true">▶</span>'
      : '<img src="' + esc(g.src) + '" alt="' + esc(g.caption) + '" width="' + g.w + '" height="' + g.h + '" loading="lazy">';
    return '<figure class="pi-tile pi-in"><a href="' + esc(g.src) + '" data-pi-box' + (g.video ? ' data-video' : '') + '>' + inner + '</a>' +
      (g.caption ? '<figcaption>' + esc(g.caption) + '</figcaption>' : '') + '</figure>';
  }
  function episode(e) {
    return '<article class="pi-ep pi-in">' + (e.cover ? '<img src="' + esc(e.cover.src) + '" alt="" width="' + e.cover.w + '" height="' + e.cover.h + '" loading="lazy">' : '') +
      '<div><p class="pi-kick">' + esc(e.kind) + ' · ' + esc(e.date) + (e.stats ? ' · ' + esc(e.stats) : '') + '</p><h4>' + esc(e.title) + '</h4><p>' + esc(e.summary) + '</p>' +
      (e.audio ? '<audio controls preload="none" src="' + esc(e.audio.src) + '"></audio>' : '') +
      '<p class="pi-more"><a href="' + esc(e.url) + '" data-pi-story="' + esc(e.id) + '">' + (e.stats ? 'The story, the map and the photos' : 'The story and the pictures') + ' →</a></p></div></article>';
  }
  function video(v, i) {
    return '<figure class="pi-in"><button type="button" class="pi-ytbtn" data-dose="' + i + '" aria-label="' + esc(v.title) + '"><img src="https://i.ytimg.com/vi/' + esc(v.id) +
      '/hqdefault.jpg" alt="" loading="lazy" width="480" height="360"><span aria-hidden="true">▶</span></button><figcaption>' + esc(v.title) + (v.date ? '<small>' + esc(v.date) + '</small>' : '') + '</figcaption></figure>';
  }
  function serie(s, i) {
    return '<button type="button" class="pi-serie pi-in" data-series="' + esc(s.key) + '"><img src="' + esc(s.cover.poster || s.cover.src) + '" alt="" loading="lazy" width="' + s.cover.w + '" height="' + s.cover.h + '"><span><b>' + esc(s.title) + '</b><i>' + s.count + '</i></span></button>';
  }
  function section(id, title, badge, sub, items, all, cls) {
    var n = all.length, lim = state.view === id ? n : LIMIT[id];
    return '<section class="pi-sec" data-sec="' + id + '"><h3>' + esc(title) + (badge || '') + '</h3><p class="pi-sub">' + sub + '</p>' +
      '<div class="' + cls + '">' + items(all.slice(0, lim)) + '</div>' +
      (state.view === 'all' && n > 0 ? '<p class="pi-more"><button type="button" data-pi-view="' + id + '">' + (n > lim ? 'View all ' + n + ' →' : 'Open ' + esc(title) + ' →') + '</button></p>'
        : state.view === id ? '<p class="pi-more"><button type="button" data-pi-view="all">← Back to everything in Play</button></p>' : '') + '</section>';
  }
  function sectionHTML(id) {
    var h = H;
    if (id === 'notes' && h.episodes.length) return section('notes', h.fieldNotes.title, '', esc(h.fieldNotes.about), function (a) { return a.map(episode).join(''); }, h.episodes, 'pi-eps') +
      '';
    if (id === 'dose' && h.daily) return section('dose', h.daily.title, '', esc(h.daily.about) + ' <a href="' + esc(h.daily.channel) + '" target="_blank" rel="noopener">On YouTube</a>', function (a) { return a.map(video).join(''); }, h.daily.videos, 'pi-yt');
    if (id === 'above' && h.above) return section('above', h.above.title, ' ' + REAL, esc(h.above.about), function (a) { return a.map(tile).join(''); }, h.above.items, 'pi-grid');
    if (id === 'daydreams' && h.daydreams) return section('daydreams', 'Daydreams', ' ' + AI, 'Ideas that only exist as pictures, so far. ' + esc(h.daydreams.tools), function (a) { return a.map(serie).join(''); }, h.daydreams.series, 'pi-series');
    return '';
  }
  var LABEL = { notes: 'Field Notes', dose: 'Daily Dose of Paradise', above: 'From Above', daydreams: 'Daydreams' };

  // ── Render: chips + the sections for this view, with a fade between views
  function render(first) {
    var chips = '<nav class="pi-jump" aria-label="Play sections"><button type="button" data-pi-view="all"' + (state.view === 'all' ? ' class="on" aria-current="true"' : '') + '>All</button>' +
      SECTIONS.filter(function (id) { return sectionHTML(id); }).map(function (id) { return '<button type="button" data-pi-view="' + id + '"' + (state.view === id ? ' class="on" aria-current="true"' : '') + '>' + LABEL[id] + '</button>'; }).join('') + '</nav>';
    var body = (state.view === 'all' ? SECTIONS : [state.view]).map(sectionHTML).join('') + '<p class="pi-note">' + esc(H.fieldNotes.note) + '</p>';
    var stage = box.querySelector('.pi-stage');
    function paint() {
      box.innerHTML = chips + '<div class="pi-stage">' + body + '</div>';
      var items = box.querySelectorAll('.pi-in');
      items.forEach(function (el, i) { el.style.animationDelay = Math.min(i, 16) * 35 + 'ms'; });
      box.querySelectorAll('.pi-ytbtn img').forEach(function (im) { im.onerror = function () { im.onerror = null; im.src = im.src.replace('hqdefault', 'mqdefault'); }; });
      watch(box);
    }
    if (first || !stage || !FADE) return paint();
    stage.classList.add('pi-out');
    setTimeout(function () {
      paint();
      var top = box.getBoundingClientRect().top;
      if (top < 0 || top > innerHeight * 0.6) box.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }, FADE);
  }
  function setView(v, push) {
    if (v === state.view) v = 'all';          // the active chip again goes back to everything
    state.view = v; state.item = null; render(); writeURL(push !== false);
  }

  // Short clips loop only while on screen (never with reduced motion).
  var io = 'IntersectionObserver' in window && !reduce ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { var p = e.target.play(); if (p && p.catch) p.catch(function () {}); } else e.target.pause(); });
  }, { threshold: 0.35 }) : null;
  function watch(root) { if (io) root.querySelectorAll('video:not([controls])').forEach(function (v) { io.observe(v); }); }

  // ── One modal for Daydreams series and Daily Dose videos
  var mdlg = null;
  function modal(html, onClose) {
    if (!mdlg) {
      mdlg = document.createElement('dialog'); mdlg.className = 'pi-story pi-modal';
      mdlg.innerHTML = '<div class="pi-story-bar"><span class="pi-modal-kick"></span><button type="button" class="pi-close" aria-label="Close">×</button></div><div class="pi-story-body"></div>';
      mdlg.querySelector('.pi-close').onclick = function () { mdlg.close(); };
      backdropClose(mdlg, function () { mdlg.close(); });
      mdlg.addEventListener('close', function () { var b = mdlg.querySelector('.pi-story-body'); b.innerHTML = ''; if (mdlg._onClose) mdlg._onClose(); });
      mdlg.querySelector('.pi-story-body').addEventListener('click', onModalClick);
      document.body.appendChild(mdlg);
    }
    mdlg._onClose = onClose || null;
    focusOut(mdlg, true);
    var b = mdlg.querySelector('.pi-story-body'); b.innerHTML = html; b.scrollTop = 0;
    if (!mdlg.open) mdlg.showModal();
    watch(b);
    return mdlg;
  }
  function openSeries(key) {
    var list = H.daydreams.series, i = list.findIndex(function (s) { return s.key === key; }); if (i < 0) return;
    var s = list[i], n = list.length, prev = list[(i - 1 + n) % n], next = list[(i + 1) % n];
    var html = '<p class="kicker"><span class="kind">Daydreams</span> · ' + (s.groups.length > 1 ? 'Real and imagined' : 'Made with AI') + '</p><h1>' + esc(s.title) + '</h1><p class="lede">' + esc(s.about) + '</p>' +
      s.groups.map(function (g) {
        return (g.label ? '<h5 class="pi-h5">' + esc(g.label) + ' ' + (g.real ? '<span class="pi-badge real">' + (g.label === 'The original' ? '1882 photograph' : 'Photographs') + '</span>' : AI) + '</h5>' : '') +
          '<div class="pi-grid">' + g.items.map(tile).join('') + '</div>';
      }).join('') +
      '<nav class="pi-pager"><button type="button" data-series="' + esc(prev.key) + '">← ' + esc(prev.title) + '</button><a href="' + esc(s.url) + '" target="_blank" rel="noopener">Page to share</a><button type="button" data-series="' + esc(next.key) + '">' + esc(next.title) + ' →</button></nav>';
    modal(html, function () { if (state.item === key || state.item && !mdlg.open) { state.item = null; writeURL(false); } });
    mdlg.querySelector('.pi-modal-kick').textContent = (i + 1) + ' of ' + n;
    state.item = key; writeURL(false);
  }
  function openDose(i) {
    var v = H.daily.videos[i];
    var html = '<p class="kicker"><span class="kind">Daily Dose of Paradise</span>' + (v.date ? ' · ' + esc(v.date) : '') + '</p><h1>' + esc(v.title) + '</h1>' +
      '<div class="pi-player"><iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(v.id) + '?autoplay=1&rel=0" title="' + esc(v.title) + '" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>' +
      (v.desc ? '<p class="lede">' + esc(v.desc).replace(/\n+/g, '<br>') + '</p>' : '') +
      '<nav class="pi-pager">' + (i > 0 ? '<button type="button" data-dose="' + (i - 1) + '">← Newer</button>' : '<span></span>') +
      '<a href="https://www.youtube.com/watch?v=' + encodeURIComponent(v.id) + '" target="_blank" rel="noopener">Watch on YouTube</a>' +
      (i < H.daily.videos.length - 1 ? '<button type="button" data-dose="' + (i + 1) + '">Older →</button>' : '<span></span>') + '</nav>';
    modal(html);
    mdlg.querySelector('.pi-modal-kick').textContent = 'Video ' + (i + 1) + ' of ' + H.daily.videos.length;
  }
  function onModalClick(ev) {
    var b = ev.target.closest('[data-series],[data-dose],[data-pi-box]');
    if (!b) return;
    if (b.hasAttribute('data-series')) openSeries(b.getAttribute('data-series'));
    else if (b.hasAttribute('data-dose')) openDose(+b.getAttribute('data-dose'));
    else { ev.preventDefault(); lightbox(b); }
  }
  function openEpisode(id, url) {
    story(url); state.item = id; writeURL(false);
    if (sdlg && !sdlg._piHooked) { sdlg._piHooked = true; sdlg.addEventListener('close', function () { if (H.episodes.some(function (e) { return e.id === state.item; })) { state.item = null; writeURL(false); } }); }
  }
  function openItem(item) {
    if (!item) return;
    var e = H.episodes.filter(function (x) { return x.id === item; })[0];
    if (e) openEpisode(e.id, e.url); else openSeries(item);
  }

  function wire() {
    box.addEventListener('click', function (ev) {
      var t = ev.target, b;
      if ((b = t.closest('[data-pi-view]'))) { setView(b.getAttribute('data-pi-view')); return; }
      if ((b = t.closest('[data-pi-story]'))) { ev.preventDefault(); openEpisode(b.getAttribute('data-pi-story'), b.getAttribute('href')); return; }
      if ((b = t.closest('[data-series],[data-dose],[data-pi-box]'))) { onModalClick(ev); }
    });
    addEventListener('popstate', function () {
      if (!view.classList.contains('on')) return;
      var s = readURL(); if (s.view !== state.view) { state.view = s.view; render(); }
      state.item = s.item;
      [mdlg, sdlg].forEach(function (d) { if (d && d.open && !s.item) d.close(); });
      if (s.item) openItem(s.item);
    });
  }

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
      backdropClose(sdlg, function () { sdlg.close(); });
      sdlg.addEventListener('close', function () { var a = sdlg.querySelector('audio'); if (a) a.pause(); if (window.RouteView) RouteView.clearMaps(); });
      sdlg.querySelector('.pi-story-body').addEventListener('click', function (e) { var a = e.target.closest('[data-lightbox]'); if (a) { e.preventDefault(); focusIn(sdlg, a); } });
      document.body.appendChild(sdlg);
    }
    var body = sdlg.querySelector('.pi-story-body'), abs = new URL(url, location.href);
    sdlg.querySelector('.pi-story-link').href = abs.href;
    body.innerHTML = '<p class="pi-sub">Loading…</p>'; sdlg.showModal(); body.scrollTop = 0;
    fetch(abs.href, { cache: 'no-cache' }).then(function (r) { return r.text(); }).then(function (html) {
      var art = new DOMParser().parseFromString(html, 'text/html').querySelector('main.article');
      if (!art) throw 0;
      art.querySelectorAll('.pager').forEach(function (n) { n.remove(); });
      [art].concat([].slice.call(art.querySelectorAll('[src],[href],[poster],[data-route]'))).forEach(function (n) {
        ['src', 'href', 'poster', 'data-route'].forEach(function (k) { var v = n.getAttribute(k); if (v && !/^(https?:|#|data:|mailto:)/.test(v)) n.setAttribute(k, new URL(v, abs).href); });
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
  // Media made big. One element per view, built fresh: an <img> for a photo, a playing <video>
  // for a clip, never both. Fades in and out.
  function media(a) {
    var src = a.getAttribute('href'), cap = a.parentNode.querySelector('figcaption'), alt = (a.querySelector('img') || {}).alt || '';
    var tv = a.querySelector('video'), ti = a.querySelector('img'), m = tv || ti;
    // The item's shape (from the tile), so photos and clips size the same way.
    var r = m && m.getAttribute('width') ? ' style="--r:' + (+m.getAttribute('width') / +m.getAttribute('height')).toFixed(4) + '"' : '';
    return (a.hasAttribute('data-video')
      ? '<video src="' + esc(src) + '"' + (tv ? ' poster="' + esc(tv.getAttribute('poster') || '') + '" width="' + tv.getAttribute('width') + '" height="' + tv.getAttribute('height') + '"' : '') + ' autoplay muted loop playsinline' + r + '></video>'
      : '<img src="' + esc(src) + '" alt="' + esc(alt) + '"' + r + '>') + (cap && cap.textContent ? '<p>' + esc(cap.textContent) + '</p>' : '');
  }
  var FADE_OUT = reduce ? 0 : 220;
  // Close a dialog on a backdrop click only when the press also started on the backdrop, so dragging
  // an audio slider and letting go outside it never closes anything.
  function backdropClose(d, close) {
    var down = null;
    d.addEventListener('pointerdown', function (e) { down = e.target; });
    d.addEventListener('click', function (e) { if (e.target === d && down === d) close(); down = null; });
  }
  function start(root) { var v = root.querySelector('video'); if (v) { v.muted = true; var p = v.play(); if (p && p.catch) p.catch(function () {}); } }

  // Inside a modal (a Daydreams series, a story): the card itself fills with the picture or clip.
  // A tap anywhere on it, × or Esc fades back to exactly where you were.
  function focusIn(d, a) {
    focusOut(d, true);
    var f = document.createElement('div'); f.className = 'pi-focus';
    f.innerHTML = media(a) + '<button type="button" class="pi-close pi-focus-x" aria-label="Back to the gallery">×</button>';
    f.addEventListener('click', function () { focusOut(d); });
    d.appendChild(f); d._focus = f; start(f);
    requestAnimationFrame(function () { f.classList.add('on'); });
    if (!d._focusHooked) {
      d._focusHooked = true;
      d.addEventListener('cancel', function (e) { if (d._focus) { e.preventDefault(); focusOut(d); } });
      d.addEventListener('close', function () { focusOut(d, true); });
    }
  }
  function focusOut(d, now) {
    var f = d && d._focus; if (!f) return;
    d._focus = null; var v = f.querySelector('video'); if (v) v.pause();
    f.classList.remove('on');
    setTimeout(function () { f.remove(); }, now ? 0 : FADE_OUT);
  }

  // On the page (From Above): a simple viewer with just the one picture or clip.
  var dlg = null;
  function lightbox(a) {
    if (!window.HTMLDialogElement) { window.open(a.href, '_blank'); return; }
    var inModal = a.closest('dialog');
    if (inModal) { focusIn(inModal, a); return; }
    if (!dlg) {
      dlg = document.createElement('dialog'); dlg.className = 'pi-lightbox';
      dlg.addEventListener('click', function () { lbClose(); });
      dlg.addEventListener('cancel', function (e) { e.preventDefault(); lbClose(); });
      document.body.appendChild(dlg);
    }
    dlg.innerHTML = '<div class="pi-lb-in">' + media(a) + '</div><button type="button" class="pi-close" aria-label="Close">×</button>';
    dlg.classList.remove('out');
    if (!dlg.open) dlg.showModal();
    start(dlg);
  }
  function lbClose() {
    if (!dlg || !dlg.open) return;
    var v = dlg.querySelector('video'); if (v) v.pause();
    dlg.classList.add('out');
    setTimeout(function () { dlg.close(); dlg.classList.remove('out'); dlg.innerHTML = ''; }, FADE_OUT);
  }

  function load() {
    if (loaded) return; loaded = true;
    fetch(box.getAttribute('data-hub'), { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (h) {
      H = h; var s = readURL(); state.view = s.view;
      render(true); wire();
      if (s.item) openItem(s.item);
    }).catch(function () { loaded = false; box.innerHTML = '<p class="pi-sub"><a href="play/">Open Play</a></p>'; });
  }
  // Load the first time the Play tab is showing (it can also be the tab the page opens on).
  function check() { if (view && view.classList.contains('on')) load(); }
  if (view) new MutationObserver(check).observe(view, { attributes: true, attributeFilter: ['class'] });
  check();
})();
