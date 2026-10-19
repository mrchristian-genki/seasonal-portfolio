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
    { id: 'library', name: 'The Library', line: 'The coloring books', x: 1512, y: 295, w: 159, z: 549, mx: 924, my: 614, mw: 178, mz: 898, go: { href: 'coloring-books/' } },
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
  // A few words about each place for its card when the village zooms in on it (the site's own copy, nothing new)
  var ABOUT = {
    tubes: "A.L.T.A.'s way in and out of the lake: glass tubes rising out of the grass.",
    labs: 'Glass-and-brass sheds on the dock, with a lighthouse at the end: the Notes on science, tech and AI.',
    alta: "The lake guardian's booth by the water, where her own Notes live.",
    tower: "GlazyArray's radio mast: the Mini-Cast episodes, and her narration.",
    observatory: 'The Tumble: a fall from today back to the first browser in 1990.',
    workshop: 'The ProPre Engine runs the whole publishing pipeline, from prompt to print-ready cover. This page is a workshop project too.',
    studio: 'The back room where Notes are written and published. Members only; the light show is for everyone.',
    house: 'Websites since 1997, professionally since 1999: front-end developer, digital director, head of experience design.',
    doghouse: "Marley's own house, and the Notes she's in.",
    library: 'An independent imprint of adult coloring books, from Color in a Cup to hikes, kitchens, wine and the American West.',
    newsstand: 'The Field Notes as made-up magazines: real stories, each dressed as a feature.',
    barn: 'Videos, photos and the Daydreams.',
    depot: 'The Parts Catalog: every part kept because it is going to become something.',
    kinetic: 'Sculptures that turn in the wind: the digital art.',
    starlee: "Starlee's charging dock, where she rests between walks.",
    bikepark: 'Not here to break records. Just not to break anything: the rides.',
    trailhead: 'Where the walks start: the hikes and the foraging walks.',
    climbing: 'The wall to practise on: the adventures.',
    tree: 'The useless tree nobody cut down, grown huge, with a bench in its shade.'
  };
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
    a.addEventListener('click', function (ev) { if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button) return; ev.preventDefault(); zoom(p, a); });
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
    '<source media="(max-width: 719px)" srcset="' + A + 'frame-phone.webp?v=2"><img src="' + A + 'frame-wide.webp?v=2" alt=""></picture>' +
    '<span class="hs-plaque" aria-hidden="true">Lake Home</span>';
  win.firstChild.appendChild(stage);
  root.appendChild(win);

  // ── zooming in, like a map (Christian, Oct 19: "less is more; let the user explore the zoomed in scene"): a click on a
  // place eases the view in on it, and a small bubble by it says what it is, with one way in. Zoomed in, the village can
  // be dragged to look around, the places nearby wear small labels, and some have things to find: the real magazines on
  // the newsstand's rack, what's showing at the barn. A click on the ground, the bubble's ×, or Esc eases back out.
  // Under the frame, a legend: hover a name and its place glows; click it and the view flies there. ──
  var view = win.firstChild, bubble = document.createElement('div'), zoomed = null, lastFocus = null;
  var Z = { x: 0, y: 0, s: 1 };
  bubble.className = 'hs-bubble'; bubble.setAttribute('role', 'dialog'); bubble.hidden = true;
  win.appendChild(bubble);
  function setZ(x, y, sc) {
    var vw = view.clientWidth, vh = view.clientHeight, W = stage.offsetWidth, Hh = stage.offsetHeight;
    var mx = Math.max(0, (sc * W - vw) / 2), my = Math.max(0, (sc * Hh - vh) / 2);          // never past the painting's edges
    Z.x = Math.max(-mx, Math.min(mx, x)); Z.y = Math.max(-my, Math.min(my, y)); Z.s = sc;
    stage.style.setProperty('--zx', Z.x.toFixed(1) + 'px'); stage.style.setProperty('--zy', Z.y.toFixed(1) + 'px'); stage.style.setProperty('--zs', sc.toFixed(3));
  }
  function box(el) {   // a place's box in the stage's own (unzoomed) pixels
    var W = stage.offsetWidth, k = W / stage.getBoundingClientRect().width, r = el.getBoundingClientRect(), sr = stage.getBoundingClientRect();
    return { x: (r.left - sr.left) * k, y: (r.top - sr.top) * k, w: r.width * k, h: r.height * k };
  }
  function zoom(p, el) {
    var vw = view.clientWidth, vh = view.clientHeight, W = stage.offsetWidth, Hh = stage.offsetHeight, b = box(el);
    var sc = Math.min(3.4, Math.max(2.2, Math.min(vw / b.w * .5, vh / b.h * .62)));
    setZ(-sc * (b.x + b.w / 2 - W / 2), -sc * (b.y + b.h / 2 - Hh / 2) + vh * .14, sc);   // a little low, so the bubble fits above
    win.classList.add('zoomed'); win.setAttribute('data-z', p.id);
    places.forEach(function (pl) { if (pl.el) pl.el.classList.toggle('picked', pl.p === p); });
    if (!zoomed) lastFocus = el;
    zoomed = p; say(p, el);
  }
  function unzoom(back) {
    if (!zoomed) return;
    zoomed = null; win.classList.remove('zoomed'); win.removeAttribute('data-z'); hush();
    setZ(0, 0, 1);
    places.forEach(function (pl) { if (pl.el) pl.el.classList.remove('picked'); });
    if (back !== false && lastFocus) lastFocus.focus({ preventScroll: true });
  }
  function hush() { bubble.classList.remove('in'); setTimeout(function () { if (!bubble.classList.contains('in')) bubble.hidden = true; }, 600); }
  // the bubble: just above the place once the view has flown there (below it when there's no room above)
  function say(p, el) {
    var here = !p.go.href;
    bubble.innerHTML = '<button type="button" class="hs-x" aria-label="Back to the whole village">×</button><b>' + p.name + '</b><span>' + (ABOUT[p.id] || p.line) + '</span>' +
      '<span class="hs-n"></span>' + (p.id === 'barn' ? showing() : '') + '<button type="button" class="hs-go">' + (here ? 'Show it below ↓' : 'Go in →') + '</button>';
    bubble.setAttribute('aria-label', p.name); bubble.classList.remove('in');
    bubble.querySelector('.hs-go').addEventListener('click', function () { var q = zoomed; unzoom(false); if (q) setTimeout(function () { open(q); }, calm ? 0 : 450); });
    bubble.querySelector('.hs-x').addEventListener('click', function () { unzoom(); });
    if (p.go.tags) counts().then(function (c) {
      var t = p.go.tags.filter(function (x) { return c[x]; }).sort(function (a, b) { return c[b] - c[a]; })[0];
      if (t && zoomed === p) bubble.querySelector('.hs-n').textContent = c[t] + (c[t] === 1 ? ' Note' : ' Notes');
    });
    setTimeout(function () { if (zoomed === p) pin(el); }, calm ? 0 : 1650);
  }
  function pin(el) {   // (not 'place': the firefly has one)
    var vr = view.getBoundingClientRect(), wr = win.getBoundingClientRect(), r = el.getBoundingClientRect();
    bubble.hidden = false;
    // above the place if there's room; otherwise beside it, on the side with more room (never over it)
    var bw = bubble.offsetWidth, bh = bubble.offsetHeight, L = vr.left - wr.left, T = vr.top - wr.top, R = vr.right - wr.left, B = vr.bottom - wr.top;
    var px = r.left - wr.left, py = r.top - wr.top, pw = r.width, ph = r.height, side = 'top', x, y;
    if (py - bh - 14 >= T + 6) { x = px + pw / 2; y = py - bh - 12; }
    else {
      side = (px - L) > (R - px - pw) ? 'left' : 'right';
      x = side === 'left' ? px - 14 - bw / 2 : px + pw + 14 + bw / 2;
      y = Math.max(T + 6, Math.min(B - bh - 6, py + ph * .35 - bh / 2));
    }
    x = Math.max(L + bw / 2 + 8, Math.min(R - bw / 2 - 8, x));
    bubble.style.left = x + 'px'; bubble.style.top = Math.max(T + 6, y) + 'px';
    bubble.setAttribute('data-side', side);
    requestAnimationFrame(function () { bubble.classList.add('in'); });
  }
  // looking around: drag the zoomed village (mouse, pen or a finger); a drag never counts as a click
  var drag = null, dragged = false;
  view.addEventListener('pointerdown', function (ev) {
    if (!zoomed || ev.button || ev.target.closest('.hs-spot, .hs-show')) return;
    drag = { x: ev.clientX, y: ev.clientY, zx: Z.x, zy: Z.y, id: ev.pointerId }; dragged = false;
  });
  view.addEventListener('pointermove', function (ev) {
    if (!drag || ev.pointerId !== drag.id) return;
    var dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
    if (!dragged && Math.abs(dx) + Math.abs(dy) < 6) return;
    if (!dragged) { dragged = true; win.classList.add('dragging'); hush(); try { view.setPointerCapture(ev.pointerId); } catch (e) {} }
    setZ(drag.zx + dx, drag.zy + dy, Z.s);
  });
  function endDrag() { if (!drag) return; drag = null; win.classList.remove('dragging'); setTimeout(function () { dragged = false; }, 0); }
  view.addEventListener('pointerup', endDrag); view.addEventListener('pointercancel', endDrag);
  view.addEventListener('click', function (ev) { if (dragged) { ev.preventDefault(); ev.stopPropagation(); } }, true);
  stage.addEventListener('click', function (ev) { if (zoomed && !ev.target.closest('.hs-place, .hs-spot, .hs-show')) unzoom(); });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && zoomed) unzoom(); });

  // ── things to find, zoomed in (positions are shares of the place's own picture) ──
  // The newsstand's rack: its four blank covers carry the four real magazines (Play's own rack, play/hub.json), each
  // opening its magazine. The barn: its round window lights up, "Now showing", and lists the Daydreams.
  var SPOTS = {
    newsstand: { w: 570, h: 716, at: [[296, 474, 62, 72], [366, 472, 62, 70], [298, 556, 62, 74], [370, 556, 64, 72]] },
    barn: { w: 920, h: 625, show: [557, 95, 160, 160] }
  };
  var DAY = [];
  function showing() {   // what's on at the barn: the Daydreams, a marquee in its bubble
    return DAY.length ? '<span class="hs-marquee"><i>Now showing</i>' + DAY.map(function (x) { return '<a href="' + x.url + '">' + x.title + '</a>'; }).join('') + '</span>' : '';
  }
  function spots() {
    var hubP = fetch('play/hub.json').then(function (r) { return r.json(); }).catch(function () { return {}; });
    places.forEach(function (pl) {
      var d = SPOTS[pl.p.id]; if (!d) return;
      var layer = document.createElement('div');
      layer.className = 'hs-spots hs-spots-' + pl.p.id; layer.style.cssText = vars(pl.p) + 'aspect-ratio:' + d.w + '/' + d.h + ';z-index:3000';
      stage.appendChild(layer);
      function pos(a) { return 'left:' + (a[0] / d.w * 100) + '%;top:' + (a[1] / d.h * 100) + '%;width:' + (a[2] / d.w * 100) + '%;height:' + (a[3] / d.h * 100) + '%'; }
      if (d.at) hubP.then(function (h) {
        var tmp = document.createElement('div'); tmp.innerHTML = (h.magazines && h.magazines.rack) || '';
        [].slice.call(tmp.querySelectorAll('a.zn-stand-item')).slice(0, d.at.length).forEach(function (m, i) {
          var img = m.querySelector('.mag-img img'), mast = m.querySelector('.mag-mast');
          var a = document.createElement('a'); a.className = 'hs-spot hs-cover'; a.href = m.getAttribute('href'); a.style.cssText = pos(d.at[i]);
          a.setAttribute('aria-label', (mast ? mast.textContent.replace(/\s+/g, ' ').trim() : 'A magazine') + ', on the newsstand');
          a.innerHTML = img ? '<img src="' + img.getAttribute('src') + '" alt="" loading="lazy">' : '';
          a.title = mast ? mast.textContent.replace(/\s+/g, ' ').trim() : '';
          layer.appendChild(a);
        });
      });
      if (d.show) hubP.then(function (h) {
        DAY = ((h.daydreams && h.daydreams.series) || []).slice(0, 5);
        var a = document.createElement('a'); a.className = 'hs-spot hs-show-btn'; a.href = '?lab+daydreams'; a.style.cssText = pos(d.show);
        a.setAttribute('aria-label', 'Now showing at the barn: the Daydreams'); a.innerHTML = '<span>Now showing</span>';
        layer.appendChild(a);
      });
    });
  }
  spots();

  // ── the legend, under the frame: every place by name; hover or focus a name and its place glows, click it to fly there ──
  var legend = document.createElement('nav'); legend.className = 'hs-legend'; legend.setAttribute('aria-label', 'Places in the village');
  legend.innerHTML = PLACES.map(function (p) { return '<button type="button" data-place="' + p.id + '">' + p.name.replace(/^The /, '') + '</button>'; }).join('');
  root.appendChild(legend);
  function plOf(id) { for (var i = 0; i < places.length; i++) if (places[i].p.id === id) return places[i]; }
  legend.addEventListener('mouseover', function (ev) { var b = ev.target.closest('[data-place]'); glow(b && b.getAttribute('data-place')); });
  legend.addEventListener('mouseleave', function () { glow(null); });
  legend.addEventListener('focusin', function (ev) { var b = ev.target.closest('[data-place]'); glow(b && b.getAttribute('data-place')); });
  legend.addEventListener('focusout', function () { glow(null); });
  legend.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-place]'); if (!b) return; var pl = plOf(b.getAttribute('data-place')); if (!pl) return;
    var r = win.getBoundingClientRect();
    if ((r.top < 0 || r.bottom > innerHeight) && window.easeScroll) easeScroll.to(win, function () { zoom(pl.p, pl.el); }); else zoom(pl.p, pl.el);
  });
  function glow(id) { places.forEach(function (pl) { if (pl.el) pl.el.classList.toggle('lit', pl.p.id === id); }); }

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
  function open(p) {
    if (p.go.href) { location.href = p.go.href; return true; }
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
