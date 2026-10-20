/* PLAY pages (Field Notes): the route map and elevation profile (from play/data/<id>.json, drawn by the shared
   js/route-view.js), the miles/km switch, and a photo lightbox. The pages read fine without it. */
(function () {
  'use strict';
  var RV = window.RouteView, main = document.querySelector('[data-route]'), ub = document.getElementById('units');

  // Daily Dose of Paradise: swap a thumbnail for the YouTube player only when it's tapped.
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('[data-yt]');
    if (!b) return;
    var f = document.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(b.getAttribute('data-yt')) + '?autoplay=1&rel=0';
    f.allow = 'autoplay; encrypted-media; picture-in-picture'; f.allowFullscreen = true; f.title = b.getAttribute('aria-label') || 'YouTube video';
    b.replaceWith(f);
  });

  // Short clips loop silently, but only while on screen (and not at all with reduced motion).
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var clips = document.querySelectorAll('video[data-autoplay]');
  if (clips.length && 'IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.preload = 'auto'; var p = e.target.play(); if (p && p.catch) p.catch(function () {}); } else e.target.pause(); });
    }, { threshold: 0.35 });
    clips.forEach(function (v) { io.observe(v); });
  }

  // Field Notes, 9 to a page, like the homepage's Play tab, with its toolbar (Christian, Oct 20: the filters and the grid
  // were missing here): grid or list, newest or oldest, and the tags with how many notes carry each (a note shows when it
  // has every tag picked). The page, the layout, the order and the tags are in the address (?grid+ride+p2), each change
  // fades the notes out and in, and when the top of the notes is out of sight the page glides back up to it. Without
  // script every note is there, as before.
  var PER = 9, cardBox = document.querySelector('#field-notes .cards');
  if (cardBox && cardBox.children.length) (function () {
    var all = [].slice.call(cardBox.children), sec = document.getElementById('field-notes');
    var NAMES = { 'lake-tahoe': 'Lake Tahoe', 'mini-cast': 'Mini-Cast', 'with-marley': 'With Marley', 'with-helena': 'With Helena', 'ai': 'AI' };
    var name = function (t) { return NAMES[t] || (/^\d{4}$/.test(t) ? t : t.replace(/^with-/, 'with ').replace(/-/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); })); };
    var tagsOf = function (c) { return (c.getAttribute('data-tags') || '').split(' ').filter(Boolean); };
    var count = {}; all.forEach(function (c) { tagsOf(c).forEach(function (t) { count[t] = (count[t] || 0) + 1; }); });
    var tagList = Object.keys(count).sort(function (a, b) { var ya = /^\d{4}$/.test(a), yb = /^\d{4}$/.test(b); if (ya !== yb) return ya ? 1 : -1; if (ya) return b.localeCompare(a); return count[b] - count[a] || a.localeCompare(b); });
    var st = { page: 1, layout: 'list', order: 'new', tags: [] };
    var tools = document.createElement('div'); tools.className = 'ntools';
    var nav = document.createElement('nav'); nav.className = 'npager'; nav.setAttribute('aria-label', 'Pages of Field Notes');
    cardBox.before(tools); cardBox.after(nav);
    var words = function () { return decodeURIComponent(location.search.slice(1)).toLowerCase().split(/[+&,;\s]+/).filter(Boolean); };
    var read = function () {
      var w = words(), m;
      st.layout = w.indexOf('grid') >= 0 ? 'grid' : 'list'; st.order = w.indexOf('oldest') >= 0 ? 'old' : 'new';
      st.tags = w.filter(function (x) { return count[x]; });
      m = w.filter(function (x) { return /^p\d+$/.test(x); })[0]; st.page = m ? +m.slice(1) : 1;
    };
    var write = function (push) {
      var w = [].concat(st.layout === 'grid' ? ['grid'] : [], st.order === 'old' ? ['oldest'] : [], st.tags, st.page > 1 ? ['p' + st.page] : []);
      try { history[push ? 'pushState' : 'replaceState'](null, '', location.pathname + (w.length ? '?' + w.join('+') : '') + location.hash); } catch (e) {}
    };
    var list = function () {
      var l = all.filter(function (c) { var t = tagsOf(c); return st.tags.every(function (x) { return t.indexOf(x) >= 0; }); });
      return st.order === 'old' ? l.reverse() : l;
    };
    var seg = function (k, v, label) { return '<button type="button" data-' + k + '="' + v + '" aria-pressed="' + (st[k] === v) + '">' + label + '</button>'; };
    var draw = function () {
      var l = list(), pages = Math.max(1, Math.ceil(l.length / PER)); st.page = Math.min(st.page, pages);
      var from = (st.page - 1) * PER, shown = l.slice(from, from + PER);
      all.forEach(function (c) { c.hidden = shown.indexOf(c) < 0; });
      shown.forEach(function (c) { cardBox.appendChild(c); });                       // in the order asked for
      cardBox.classList.toggle('grid', st.layout === 'grid');
      tools.innerHTML = '<div class="nt-row"><span class="nt-seg" role="group" aria-label="Layout">' + seg('layout', 'grid', 'Grid') + seg('layout', 'list', 'List') + '</span>' +
        '<span class="nt-seg" role="group" aria-label="Order">' + seg('order', 'new', 'Newest') + seg('order', 'old', 'Oldest') + '</span>' +
        '<span class="nt-count">' + (l.length > PER ? (from + 1) + '–' + (from + shown.length) + ' of ' + l.length : l.length) + (l.length < all.length ? ' (' + all.length + ' in all)' : ' notes') + '</span></div>' +
        '<div class="nt-tags" role="group" aria-label="Tags">' + (st.tags.length ? '<button type="button" class="nt-clear" data-tag="">All</button>' : '') +
        tagList.map(function (t) { var on = st.tags.indexOf(t) >= 0; return '<button type="button" data-tag="' + t + '" aria-pressed="' + on + '"' + (on ? ' class="on"' : '') + '>' + name(t) + ' <i>' + count[t] + '</i></button>'; }).join('') + '</div>' +
        (l.length ? '' : '<p class="nt-none">Nothing has all of those tags. <button type="button" class="nt-clear" data-tag="">Clear the tags</button></p>');
      var b = function (p, label, cls) { return '<button type="button" data-page="' + p + '"' + (cls ? ' class="' + cls + '"' : '') + (p === st.page && !cls ? ' aria-current="page"' : '') + '>' + label + '</button>'; };
      var out = [], last = 0;
      for (var p = 1; p <= pages; p++) {
        if (p !== 1 && p !== pages && Math.abs(p - st.page) > 1) continue;
        if (last && p - last > 1) out.push('<span class="gap">…</span>');
        out.push(b(p, p)); last = p;
      }
      nav.hidden = pages < 2;
      nav.innerHTML = (st.page > 1 ? b(st.page - 1, '← Previous', 'step') : '<span class="step"></span>') + '<span class="pages">' + out.join('') + '</span>' +
        (st.page < pages ? b(st.page + 1, 'Next →', 'step') : '<span class="step"></span>');
    };
    var change = function (fn, glide) {
      fn(); write(true);
      if (reduce) { draw(); return; }
      cardBox.classList.add('fading');
      setTimeout(function () {
        draw(); cardBox.classList.remove('fading');
        if (glide && sec.getBoundingClientRect().top < 0 && window.easeScroll) easeScroll.to(sec);
      }, 500);
    };
    nav.addEventListener('click', function (e) { var t = e.target.closest('[data-page]'); if (t) change(function () { st.page = +t.getAttribute('data-page'); }, true); });
    tools.addEventListener('click', function (e) {
      var t = e.target.closest('button'); if (!t) return;
      if (t.hasAttribute('data-layout')) change(function () { st.layout = t.getAttribute('data-layout'); });
      else if (t.hasAttribute('data-order')) change(function () { st.order = t.getAttribute('data-order'); st.page = 1; });
      else if (t.hasAttribute('data-tag')) change(function () {
        var g = t.getAttribute('data-tag'), at = st.tags.indexOf(g);
        if (!g) st.tags = []; else if (at >= 0) st.tags.splice(at, 1); else st.tags.push(g);
        st.page = 1;
      });
    });
    addEventListener('popstate', function () { read(); draw(); });
    read(); draw();
  })();

  // Share (a magazine, the newsstand): the phone's own share sheet, else the link copied, the button saying so a while
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('[data-share-url]');
    if (!b) return;
    var url = b.getAttribute('data-share-url'), t = b.getAttribute('data-share-title'), x = b.getAttribute('data-share-text');
    if (navigator.share) { navigator.share({ title: t, text: x, url: url }).catch(function () {}); return; }
    var said = function (w) { var o = b.getAttribute('data-was') || b.textContent; b.setAttribute('data-was', o); b.textContent = w; b.classList.add('ok');
      clearTimeout(b._t); b._t = setTimeout(function () { b.textContent = o; b.classList.remove('ok'); }, 2400); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(function () { said('Link copied'); }, function () { prompt('Copy this link:', url); });
    else prompt('Copy this link:', url);
  });

  // Lightbox for any photo (or clip) link: swipe (or ← →) to the next or previous one on the page, each change a
  // short cross-fade (../js/motion.js swipeNav and lbList); no arrows on it (Christian, Oct 19: they covered the pictures)
  var box = null, list = [], at = -1;
  function fill(a) {
    var img = a.querySelector('img'), cap = a.parentNode.querySelector('figcaption'), bi = box.querySelector('img'), bv = box.querySelector('video');
    var isVid = a.hasAttribute('data-video');
    bi.hidden = isVid; bv.hidden = !isVid;
    if (isVid) { bv.src = a.getAttribute('href'); bv.muted = true; var p = bv.play(); if (p && p.catch) p.catch(function () {}); }
    else { bv.pause(); bv.removeAttribute('src'); bi.src = a.getAttribute('href'); bi.alt = img ? img.alt : ''; }
    box.querySelector('p').textContent = (cap ? cap.textContent : '') + (list.length > 1 ? (cap && cap.textContent ? '  ·  ' : '') + (at + 1) + ' of ' + list.length : '');
  }
  function step(d) {
    var to = at + d; if (!box || !box.open || to < 0 || to >= list.length) return false;
    at = to; var inner = box.querySelector('.lb-in');
    if (reduce) { fill(list[at]); return; }
    clearTimeout(box._t); inner.style.setProperty('--dx', (d > 0 ? -24 : 24) + 'px'); inner.classList.add('lb-swap');
    box._t = setTimeout(function () { fill(list[at]); inner.style.setProperty('--dx', (d > 0 ? 24 : -24) + 'px'); void inner.offsetWidth; inner.classList.remove('lb-swap'); }, 300);
  }
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('[data-lightbox]');
    if (!a || !window.HTMLDialogElement) return;
    ev.preventDefault();
    if (!box) {
      box = document.createElement('dialog'); box.className = 'lightbox';
      if (window.softDialog) softDialog(box, 450);   // ../js/motion.js: it fades out as it closes
      box.innerHTML = '<div class="lb-in"><img alt=""><video controls loop playsinline hidden></video><p></p></div><button type="button" class="lb-x" aria-label="Close">&times;</button>';
      box.querySelector('.lb-x').onclick = function () { box.close(); };
      box.addEventListener('click', function (e) { if (e.target === box) box.close(); });
      box.addEventListener('close', function () { var v = box.querySelector('video'); v.pause(); v.removeAttribute('src'); v.load(); });
      if (window.swipeNav) swipeNav(box, step);
      document.body.appendChild(box);
    }
    list = window.lbList ? lbList(a) : [a]; at = list.indexOf(a);
    fill(a);
    box.showModal();
  });

  if (!main || !RV) return;
  fetch(main.getAttribute('data-route')).then(function (r) { return r.json(); }).then(function (d) {
    function draw() {
      RV.clearMaps();
      document.getElementById('stats').innerHTML = RV.statTiles(d.stats, d.kind);
      var mapEl = document.getElementById('map'), map = null;
      if (window.L) { mapEl.innerHTML = ''; map = RV.makeMap(mapEl, RV.routeLayers(d.line)); }
      var at = RV.scrubber(map, d.line), pf = document.getElementById('profile');
      if (RV.dashboard) RV.dashboard(document.getElementById('dash'), d, { show: d.show, onAt: at });
      var inDash = document.querySelector('#dash .dprof');
      pf.hidden = !!inDash; if (!inDash) RV.profileSVG(pf, d.profile, at);
      if (ub) { ub.hidden = false; ub.textContent = RV.units() === 'imperial' ? 'mi · ft' : 'km · m'; }
    }
    draw();
    if (ub) ub.onclick = function () { RV.setUnits(RV.units() === 'imperial' ? 'metric' : 'imperial'); draw(); };
  }).catch(function () { /* the stats in the page stay as written */ });
})();
