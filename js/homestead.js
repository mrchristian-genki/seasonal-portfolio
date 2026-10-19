/* THE HOMESTEAD (the Lake Home, field/drafts/homestead.md): below the lake, every part of the site is a place on a
   hillside, painted by Christian (assets/homestead: each place by day, by night, and both in snow, all four lined up).
   - A place follows the lake: snow in winter, its windows lit in night mode, each change a slow cross-fade (CLAUDE.md:
     lights ease on and off, nothing snaps). Only the picture a place needs now is loaded; the others when they're needed.
   - Each place is a door: a section of this page (its tab), Play's Notes of that kind, or a page of its own. Hover or
     focus lifts it a little and warms its glow; its name sits on a small plate under it.
   - The grounds are drawn here: grass that follows the season, the path, the stream down from the lake and the pond the
     labs stand in. On a phone the places come down the hill one or two at a time.
   - Small things move: the Kinetic Garden's rotors turn, a butterfly drifts across, bubbles rise in A.L.T.A.'s tubes,
     and somewhere a firefly glows (a new spot each season). With reduced motion they hold still. */
(function () {
  'use strict';
  var root = document.getElementById('homestead');
  if (!root) return;
  var A = 'assets/homestead/', VER = '?v=1';
  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // x, y: where its base sits (the middle of its bottom edge) on the hill, 1600 x 1500 on a wide screen and
  // 400 x 2760 on a phone (mx, my); w, mw: how wide it is there. go: where its door leads (see open()).
  var PLACES = [
    { id: 'tubes', name: "A.L.T.A.'s tubes", line: 'Her way in and out of the lake', x: 135, y: 400, w: 150, mx: 70, my: 230, mw: 95, go: { href: 'play/' } },
    { id: 'labs', name: 'The Automaton Labs', line: 'Science, tech and AI', x: 450, y: 430, w: 440, mx: 255, my: 230, mw: 270, go: { tags: ['science', 'tech', 'ai'] } },
    { id: 'alta', name: "A.L.T.A.'s station", line: 'The lake guardian\'s booth', x: 780, y: 400, w: 170, mx: 95, my: 450, mw: 140, go: { href: 'play/' } },
    { id: 'tower', name: "GlazyArray's tower", line: 'Mini-Cast, on the air', x: 1130, y: 330, w: 170, mx: 305, my: 450, mw: 130, go: { tags: ['mini-cast'] } },
    { id: 'observatory', name: 'The Observatory', line: 'The Tumble: back to 1990', x: 1420, y: 370, w: 230, mx: 140, my: 708, mw: 190, go: { href: 'web/' } },
    { id: 'workshop', name: 'The Workshop', line: 'Builds, light jars, projects', x: 330, y: 700, w: 340, mx: 200, my: 945, mw: 300, go: { view: 'workshop' } },
    { id: 'studio', name: 'The Studio', line: 'Members only: the back room', x: 700, y: 690, w: 270, mx: 105, my: 1141, mw: 180, go: { href: 'studio/' } },
    { id: 'house', name: 'The House', line: 'Websites since 1997', x: 1030, y: 700, w: 320, mx: 300, my: 1141, mw: 190, go: { view: 'signal' } },
    { id: 'doghouse', name: "Marley's house", line: 'Knock first', x: 1225, y: 735, w: 95, mx: 320, my: 708, mw: 90, go: { tags: ['with-marley'] } },
    { id: 'library', name: 'The Library', line: 'The coloring books', x: 1390, y: 720, w: 175, mx: 95, my: 1366, mw: 110, go: { view: 'studio' } },
    { id: 'newsstand', name: 'The Newsstand', line: 'The magazines', x: 170, y: 1000, w: 175, mx: 290, my: 1366, mw: 130, go: { href: 'magazine/' } },
    { id: 'barn', name: 'The Screening Barn', line: 'Videos, photos, Daydreams', x: 470, y: 1010, w: 330, mx: 200, my: 1606, mw: 300, go: { view: 'lab' } },
    { id: 'depot', name: 'The Parts Depot', line: 'The parts catalog', x: 860, y: 1000, w: 300, mx: 200, my: 1848, mw: 290, go: { href: 'catalog/' } },
    { id: 'kinetic', name: 'The Kinetic Garden', line: 'Digital art', x: 1210, y: 1010, w: 240, mx: 125, my: 2043, mw: 200, go: { tags: ['digital-art'] } },
    { id: 'starlee', name: "Starlee's dock", line: 'Where she charges', x: 1470, y: 1020, w: 200, mx: 320, my: 2043, mw: 150, go: { href: 'play/' } },
    { id: 'bikepark', name: 'The Bike Park', line: 'Rides', x: 330, y: 1320, w: 420, mx: 200, my: 2272, mw: 340, go: { tags: ['ride'] } },
    { id: 'trailhead', name: 'The Trailhead', line: 'Hikes and foraging walks', x: 800, y: 1310, w: 400, mx: 200, my: 2512, mw: 330, go: { tags: ['hike'] } },
    { id: 'climbing', name: 'The Climbing Wall', line: 'Adventures', x: 1180, y: 1320, w: 300, mx: 115, my: 2696, mw: 210, go: { tags: ['adventure'] } },
    { id: 'tree', name: 'The Useless Tree', line: 'A bench in the shade', x: 1470, y: 1330, w: 250, mx: 315, my: 2696, mw: 170, go: { view: 'lab' } }
  ];
  // the Kinetic Garden's rotors, each turning on its own stem beside it (x, y: its middle)
  var ROTORS = [
    { i: 0, x: 1370, y: 880, w: 46, mx: 250, my: 1880, mw: 34, s: 34 },
    { i: 1, x: 1055, y: 905, w: 42, mx: 28, my: 1905, mw: 30, s: -46 },
    { i: 0, x: 1335, y: 955, w: 30, mx: 375, my: 1900, mw: 24, s: 52 }
  ];

  // ── the state the pictures follow: winter brings the snow versions, night mode the lit ones ──
  var H = document.documentElement;
  function want() {
    var snow = H.dataset.season === 'winter', night = H.classList.contains('night-page');
    return (night ? 'night' : 'day') + (snow ? 'snow' : '');
  }

  // ── build ──
  var stage = document.createElement('div'); stage.className = 'hs-stage';
  stage.innerHTML = ground();
  var places = PLACES.map(function (p) {
    var a = document.createElement('a');
    a.className = 'hs-place hs-' + p.id;
    a.href = p.go.href || ('?' + (p.go.view ? { studio: 'books', signal: 'web', workshop: 'workshop', lab: 'lab' }[p.go.view] : 'lab+' + p.go.tags[0]));
    a.style.cssText = vars(p);
    a.setAttribute('aria-label', p.name + ': ' + p.line);
    a.innerHTML = '<span class="hs-art" aria-hidden="true"></span><span class="hs-name">' + p.name + '<small>' + p.line + '</small></span>';
    a.addEventListener('click', function (ev) { if (open(p, ev)) ev.preventDefault(); });
    stage.appendChild(a);
    return { p: p, el: a, art: a.firstChild, imgs: {}, want: null, cur: null };
  });
  ROTORS.forEach(function (r) {
    var s = document.createElement('span');
    s.className = 'hs-rotor'; s.setAttribute('aria-hidden', 'true');
    s.style.cssText = vars(r) + '--spin:' + Math.abs(r.s) + 's;--dir:' + (r.s < 0 ? 'reverse' : 'normal');
    s.innerHTML = '<i class="hs-stem"></i><b class="hs-rotor-art"></b>';
    stage.appendChild(s);
    places.push({ p: { id: 'rotor' + r.i }, art: s.lastChild, imgs: {}, want: null, cur: null, rotor: true });
  });
  stage.insertAdjacentHTML('beforeend',
    '<span class="hs-bubbles" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>' +
    '<span class="hs-butterfly" aria-hidden="true"><b></b></span>' +
    '<button type="button" class="hs-firefly" aria-label="A firefly"></button>');
  root.appendChild(stage);

  function vars(p) {
    return '--x:' + p.x + ';--y:' + p.y + ';--w:' + p.w + ';--mx:' + p.mx + ';--my:' + p.my + ';--mw:' + p.mw + ';z-index:' + Math.round(p.y) + ';';
  }

  // ── the pictures: bring in the one wanted, fade it in over the one showing, then let the old one go ──
  function show(pl, v) {
    if (pl.want === v) return;
    pl.want = v;
    var img = pl.imgs[v];
    if (!img) {
      img = pl.imgs[v] = new Image();
      img.alt = ''; img.decoding = 'async';
      img.src = A + pl.p.id + '-' + (pl.rotor ? v.replace('snow', '') : v) + '.webp' + VER;
    }
    var ready = function () {
      if (pl.want !== v || pl.cur === img) return;
      var old = pl.cur; pl.cur = img;
      pl.art.appendChild(img);                                   // on top of the one showing
      if (!old || calm) { img.classList.add('now', 'on'); if (old) old.classList.remove('on'); return; }
      img.classList.remove('now'); void img.offsetWidth; img.classList.add('on');
      setTimeout(function () { if (pl.cur === img) old.classList.remove('on'); }, 2200);   // it fades out under the new one
    };
    // decoded before it's shown, so a picture never appears half drawn
    var decoded = function () { (img.decode ? img.decode() : Promise.resolve()).then(ready, ready); };
    if (img.complete && img.naturalWidth) decoded(); else img.addEventListener('load', decoded, { once: true });
  }
  var lazy = 'IntersectionObserver' in window;
  var seen = !lazy;
  function update() { if (!seen) return; var v = want(); places.forEach(function (pl) { show(pl, v); }); }
  if (lazy) new IntersectionObserver(function (e) { if (e[0].isIntersecting && !seen) { seen = true; update(); } }, { rootMargin: '600px 0px' }).observe(root);
  new MutationObserver(update).observe(H, { attributes: true, attributeFilter: ['class', 'data-season'] });
  update();

  // ── doors: a section of this page eases into view; Play's Notes open filtered to the place's kinds ──
  function open(p, ev) {
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button) return false;
    if (p.go.href) return false;
    var view = p.go.view || 'lab', tab = document.querySelector('.tab[data-view="' + view + '"]');
    if (!tab) return false;
    if (tab.getAttribute('aria-selected') !== 'true') tab.click();
    if (p.go.tags) filter(p.go.tags);
    var about = document.getElementById('about');
    if (about && window.easeScroll) setTimeout(function () { easeScroll.to(about); }, 550);
    return true;
  }
  // Play loads when its tab opens; once it's ready, the address takes the tag and Play reads it from there (play-inline.js
  // follows the address on popstate). Of a place's kinds, the one most Notes carry is used (Play shows Notes with every
  // chosen tag, so one is enough); with none, the Field Notes simply open.
  var hub = null;
  function counts() { return hub || (hub = fetch('play/hub.json').then(function (r) { return r.json(); }).then(function (h) {
    var c = {}; (h.episodes || []).forEach(function (e) { (e.tags || []).forEach(function (t) { c[t] = (c[t] || 0) + 1; }); }); return c;
  }).catch(function () { return {}; })); }
  function filter(tags) {
    counts().then(function (c) {
      var use = tags.filter(function (t) { return c[t]; }).sort(function (a, b) { return c[b] - c[a]; }).slice(0, 1);
      (function wait(n) {
        if (!window.__playWords || !document.querySelector('#about .pi-in')) {
          if (n < 60) setTimeout(function () { wait(n + 1); }, 250); return;
        }
        try { history.replaceState(null, '', location.pathname + '?' + ['lab', 'notes'].concat(use).join('+') + location.hash); } catch (e) { return; }
        dispatchEvent(new PopStateEvent('popstate'));
      })(0);
    });
  }

  // ── the firefly: one glowing pixel, somewhere new each season; tap it and it drifts off to another spot ──
  var SPOTS = [[300, 560], [905, 820], [1290, 1180], [620, 1180], [1530, 560], [90, 1150]];
  var ff = stage.querySelector('.hs-firefly'), hop = 0;
  function place() {
    var s = { winter: 0, spring: 1, summer: 2, fall: 3 }[H.dataset.season] || 0, k = SPOTS[(s + hop) % SPOTS.length];
    ff.style.setProperty('--fx', k[0]); ff.style.setProperty('--fy', k[1]);
  }
  ff.addEventListener('click', function () { hop++; ff.classList.add('away'); setTimeout(function () { place(); ff.classList.remove('away'); }, 1600); });
  new MutationObserver(place).observe(H, { attributes: true, attributeFilter: ['data-season'] });
  place();

  // ── the grounds ──
  function ground() {
    var wide = '<svg class="hs-ground hs-wide" viewBox="0 0 1600 1500" preserveAspectRatio="none" aria-hidden="true">' +
      '<defs><linearGradient id="hsG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="g1"/><stop offset="1" class="g2"/></linearGradient></defs>' +
      '<rect width="1600" height="1500" fill="url(#hsG)"/>' +
      '<path class="hill" d="M0 560 C300 500 520 610 820 560 S1350 470 1600 540 L1600 1500 L0 1500Z"/>' +
      '<path class="hill h2" d="M0 880 C260 840 600 930 900 880 S1380 820 1600 870 L1600 1500 L0 1500Z"/>' +
      '<path class="hill h3" d="M0 1190 C340 1150 640 1230 980 1190 S1420 1140 1600 1180 L1600 1500 L0 1500Z"/>' +
      '<path class="stream" d="M160 -10 C150 90 230 150 260 230 S300 330 330 370"/>' +
      '<ellipse class="pond" cx="450" cy="420" rx="300" ry="62"/><ellipse class="pond shine" cx="420" cy="408" rx="180" ry="18"/>' +
      '<path class="path" d="M800 0 C820 120 760 200 800 300 S1020 420 1000 560 S640 640 640 760 S900 860 860 960 S420 1040 480 1140 S880 1220 800 1330 S760 1440 820 1500"/>' +
      '</svg>';
    var narrow = '<svg class="hs-ground hs-narrow" viewBox="0 0 400 2760" preserveAspectRatio="none" aria-hidden="true">' +
      '<defs><linearGradient id="hsGm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="g1"/><stop offset="1" class="g2"/></linearGradient></defs>' +
      '<rect width="400" height="2760" fill="url(#hsGm)"/>' +
      '<path class="hill" d="M0 760 C120 730 260 790 400 750 L400 2760 L0 2760Z"/>' +
      '<path class="hill h2" d="M0 1660 C140 1630 260 1690 400 1650 L400 2760 L0 2760Z"/>'+
      '<path class="hill h3" d="M0 2330 C140 2300 260 2360 400 2320 L400 2760 L0 2760Z"/>' +
      '<path class="stream" d="M60 -10 C50 60 90 120 120 200 S160 240 190 255"/>' +
      '<ellipse class="pond" cx="255" cy="250" rx="185" ry="34"/>' +
      '<path class="path" d="M200 0 C220 120 150 300 200 480 S330 640 240 760 S60 900 200 1020 S330 1180 200 1260 S60 1420 190 1500 S340 1720 210 1900 S80 2100 200 2160 S330 2400 200 2560 S120 2700 200 2760"/>' +
      '</svg>';
    return wide + narrow;
  }
})();
