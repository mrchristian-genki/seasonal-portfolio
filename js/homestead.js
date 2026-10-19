/* THE HOMESTEAD (the Lake Home, field/drafts/homestead.md): below the lake, every part of the site is a place on a
   hillside, painted by Christian (assets/homestead: each place by day, by night, and both in snow, all four lined up).
   - A place follows the lake: snow in winter, its windows lit in night mode, each change a slow cross-fade (CLAUDE.md:
     lights ease on and off, nothing snaps). Only the picture a place needs now is loaded; the others when they're needed.
   - Each place is a door: a section of this page (its tab), Play's Notes of that kind, or a page of its own. Hover or
     focus lifts it a little and warms its glow; its name sits on a small plate under it.
   - The ground is Christian's painted hill, every season by day and by night, cross-fading like the places: a wide
     painting for wide screens and a tall one for phones, each place standing where he painted it on both.
   - Small things move: the Kinetic Garden's rotors turn, a butterfly drifts across, bubbles rise in A.L.T.A.'s tubes,
     and somewhere a firefly glows (a new spot each season). With reduced motion they hold still. */
(function () {
  'use strict';
  var root = document.getElementById('homestead');
  if (!root) return;
  var A = 'assets/homestead/', VER = '?v=1';
  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // x, y, w: its top left corner and width on Christian's wide painting of the hill (2000 x 1116, assets/homestead/ground-*);
  // mx, my, mw the same on his tall painting for phones (1116 x 2000, phone-ground-*); z, mz: its base, for stacking.
  // Each was found by matching the place's cut-out against his painting with the buildings in. go: where its door leads.
  var PLACES = [
    { id: 'tubes', name: "A.L.T.A.'s tubes", line: 'Her way in and out of the lake', x: 50, y: 51, w: 140, z: 313, mx: 18, my: 119, mw: 138, mz: 377, go: { href: 'play/' } },
    { id: 'labs', name: 'The Automaton Labs', line: 'Science, tech and AI', x: 296, y: 159, w: 418, z: 368, mx: 196, my: 237, mw: 406, mz: 440, go: { tags: ['science', 'tech', 'ai'] } },
    { id: 'alta', name: "A.L.T.A.'s station", line: 'The lake guardian\'s booth', x: 746, y: 82, w: 156, z: 272, mx: 536, my: 105, mw: 154, mz: 293, go: { href: 'play/' } },
    { id: 'tower', name: "GlazyArray's tower", line: 'Mini-Cast, on the air', x: 1263, y: 62, w: 161, z: 239, mx: 692, my: 164, mw: 160, mz: 340, go: { tags: ['mini-cast'] } },
    { id: 'observatory', name: 'The Observatory', line: 'The Tumble: back to 1990', x: 1615, y: 24, w: 220, z: 259, mx: 866, my: 217, mw: 214, mz: 446, go: { href: 'web/' } },
    { id: 'workshop', name: 'The Workshop', line: 'Builds, light jars, projects', x: 382, y: 366, w: 292, z: 553, mx: 140, my: 560, mw: 292, mz: 747, go: { view: 'workshop' } },
    { id: 'studio', name: 'The Studio', line: 'Members only: the back room', x: 828, y: 319, w: 220, z: 502, mx: 414, my: 622, mw: 232, mz: 815, go: { href: 'studio/' } },
    { id: 'house', name: 'The House', line: 'Websites since 1997', x: 1155, y: 351, w: 276, z: 544, mx: 616, my: 721, mw: 304, mz: 934, go: { view: 'signal' } },
    { id: 'doghouse', name: "Marley's house", line: 'Knock first', x: 1398, y: 483, w: 84, z: 561, mx: 879, my: 870, mw: 94, mz: 957, go: { tags: ['with-marley'] } },
    { id: 'library', name: 'The Library', line: 'The coloring books', x: 1512, y: 295, w: 159, z: 549, mx: 924, my: 614, mw: 178, mz: 898, go: { view: 'studio' } },
    { id: 'newsstand', name: 'The Newsstand', line: 'The magazines', x: 262, y: 520, w: 156, z: 715, mx: 73, my: 741, mw: 178, mz: 964, go: { href: 'magazine/' } },
    { id: 'barn', name: 'The Screening Barn', line: 'Videos, photos, Daydreams', x: 522, y: 569, w: 300, z: 772, mx: 152, my: 1054, mw: 310, mz: 1264, go: { view: 'lab' } },
    { id: 'depot', name: 'The Parts Depot', line: 'The parts catalog', x: 1060, y: 594, w: 260, z: 771, mx: 595, my: 1150, mw: 280, mz: 1341, go: { href: 'catalog/' } },
    { id: 'kinetic', name: 'The Kinetic Garden', line: 'Digital art', x: 1402, y: 603, w: 220, z: 781, mx: 878, my: 963, mw: 238, mz: 1155, go: { tags: ['digital-art'] } },
    { id: 'starlee', name: "Starlee's dock", line: 'Where she charges', x: 1783, y: 631, w: 214, z: 758, mx: 940, my: 1232, mw: 149, mz: 1320, go: { href: 'play/' } },
    { id: 'bikepark', name: 'The Bike Park', line: 'Rides', x: 298, y: 820, w: 411, z: 1033, mx: 62, my: 1568, mw: 411, mz: 1781, go: { tags: ['ride'] } },
    { id: 'trailhead', name: 'The Trailhead', line: 'Hikes and foraging walks', x: 885, y: 792, w: 348, z: 997, mx: 460, my: 1389, mw: 319, mz: 1577, go: { tags: ['hike'] } },
    { id: 'climbing', name: 'The Climbing Wall', line: 'Adventures', x: 1273, y: 824, w: 292, z: 1016, mx: 764, my: 1410, mw: 292, mz: 1602, go: { tags: ['adventure'] } },
    { id: 'tree', name: 'The Useless Tree', line: 'A bench in the shade', x: 1593, y: 804, w: 407, z: 1031, mx: 727, my: 1651, mw: 373, mz: 1859, go: { view: 'lab' } }
  ];
  // the Kinetic Garden's rotors, each turning on its own stem beside it (x, y: its middle)
  var ROTORS = [
    { i: 0, x: 1652, y: 640, w: 52, mx: 1080, my: 1010, mw: 44, s: 34 },
    { i: 1, x: 1388, y: 660, w: 46, mx: 860, my: 1035, mw: 38, s: -46 },
    { i: 0, x: 1668, y: 712, w: 34, mx: 1094, my: 1075, mw: 30, s: 52 }
  ];

  // ── the state the pictures follow: winter brings the snow versions, night mode the lit ones ──
  var H = document.documentElement;
  function want() {
    var snow = H.dataset.season === 'winter', night = H.classList.contains('night-page');
    return (night ? 'night' : 'day') + (snow ? 'snow' : '');
  }

  // ── build ──
  var stage = document.createElement('div'); stage.className = 'hs-stage';
  stage.innerHTML = '<div class="hs-paint" aria-hidden="true"></div>';
  var wideMQ = window.matchMedia ? matchMedia('(min-width: 720px)') : { matches: true };
  // the ground has a version for every season, by day and by night (summer's are plain ground-day/-night, winter's the snow)
  var paint = { p: { id: 'ground' }, art: stage.firstChild, imgs: {}, want: null, cur: null, file: function (k) {
    var phone = k.charAt(0) === 'p'; k = k.slice(2);
    if (phone) return 'phone-ground-' + k;                   // the tall painting: every season named in full
    var m = k.split('-'), FILE = { summer: '', winter: 'snow' };
    return 'ground-' + (m[0] in FILE ? m[1] + FILE[m[0]] : m[0] + '-' + m[1]);
  } };
  function groundKey() { return (H.dataset.season || 'summer') + '-' + (H.classList.contains('night-page') ? 'night' : 'day'); }
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
  // The village sits in a window (Christian's frames, Oct 19: assets/homestead/frame-wide and frame-phone): the frame on
  // top, the village in its opening, cropped a little to fit; the name on the frame's brass plaque.
  var win = document.createElement('div'); win.className = 'hs-window';
  win.innerHTML = '<div class="hs-view"></div><picture class="hs-frame" aria-hidden="true">' +
    '<source media="(max-width: 719px)" srcset="' + A + 'frame-phone.webp' + VER + '"><img src="' + A + 'frame-wide.webp' + VER + '" alt=""></picture>' +
    '<span class="hs-plaque" aria-hidden="true">Lake Home</span>';
  win.firstChild.appendChild(stage);
  root.appendChild(win);

  function vars(p) {
    return '--x:' + p.x + ';--y:' + p.y + ';--w:' + p.w + ';--mx:' + p.mx + ';--my:' + p.my + ';--mw:' + p.mw + ';z-index:' + Math.round(p.z || p.y) + ';--mz:' + Math.round(p.mz || p.z || p.y) + ';';
  }

  // ── the pictures: bring in the one wanted, fade it in over the one showing, then let the old one go ──
  function show(pl, v) {
    if (pl.want === v) return;
    pl.want = v;
    var img = pl.imgs[v];
    if (!img) {
      img = pl.imgs[v] = new Image();
      img.alt = ''; img.decoding = 'async';
      img.src = A + (pl.file ? pl.file(v) : pl.p.id + '-' + (pl.rotor ? v.replace('snow', '') : v)) + '.webp' + VER;
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
  function update() { if (!seen) return; var v = want(); places.forEach(function (pl) { show(pl, v); }); show(paint, (wideMQ.matches ? 'w:' : 'p:') + groundKey()); }
  if (wideMQ.addEventListener) wideMQ.addEventListener('change', update);
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
  var SPOTS = [[230, 470], [1010, 600], [1650, 880], [790, 880], [1960, 520], [150, 1060]];   // on the wide painting; a phone maps them across
  var ff = stage.querySelector('.hs-firefly'), hop = 0;
  function place() {
    var s = { winter: 0, spring: 1, summer: 2, fall: 3 }[H.dataset.season] || 0, k = SPOTS[(s + hop) % SPOTS.length];
    ff.style.setProperty('--fx', k[0]); ff.style.setProperty('--fy', k[1]);
  }
  ff.addEventListener('click', function () { hop++; ff.classList.add('away'); setTimeout(function () { place(); ff.classList.remove('away'); }, 1600); });
  new MutationObserver(place).observe(H, { attributes: true, attributeFilter: ['data-season'] });
  place();

})();
