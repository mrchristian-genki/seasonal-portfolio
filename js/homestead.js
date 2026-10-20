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
  // The village sits in Christian's curio cabinet (Oct 20: assets/homestead/cabinet-wide, and cabinet-phone with its
  // niches above and below; his renders, their middles stretched), sliding underneath its opening. The name is on the
  // cabinet's readout.
  var win = document.createElement('div'); win.className = 'hs-window';
  win.innerHTML = '<div class="hs-view"></div><picture class="hs-frame" aria-hidden="true">' +
    '<source media="(max-width: 719px)" srcset="' + A + 'cabinet-phone.webp?v=1"><img src="' + A + 'cabinet-wide.webp?v=2" alt=""></picture>' +
    '<span class="hs-plaque" aria-hidden="true">Lake Home<small></small></span>';
  win.firstChild.appendChild(stage);
  root.appendChild(win);

  // ── the cabinet's niches: each holds a few places, its lamp lit while one of them is pointed at or picked. nx, ny: the
  // niche's top left corner on the wide cabinet (2320 x 1116); on the phone's (1116 x 2200) the first six are the row
  // above the opening, the rest the row below. Each niche's object (Christian's renders, cut out: assets/homestead/
  // niche-<its first place>) stands on its shelf. ──
  var NICHES = [
    { nx: 95, ny: 160, name: "A.L.T.A.", ids: ['tubes', 'alta'] },
    { nx: 292, ny: 160, name: 'Labs', ids: ['labs'] },
    { nx: 95, ny: 395, name: 'Tower', ids: ['tower'] },
    { nx: 95, ny: 628, name: 'Observatory', ids: ['observatory'] },
    { nx: 292, ny: 628, name: 'Workshop', ids: ['workshop', 'studio'] },
    { nx: 95, ny: 850, name: 'Marley', ids: ['doghouse', 'starlee'] },
    { nx: 1885, ny: 160, name: 'House', ids: ['house'] },
    { nx: 2085, ny: 160, name: 'Library', ids: ['library'] },
    { nx: 2085, ny: 395, name: 'Newsstand', ids: ['newsstand'] },
    { nx: 1885, ny: 628, name: 'Barn', ids: ['barn'] },
    { nx: 2085, ny: 628, name: 'Parts & Garden', ids: ['depot', 'kinetic'] },
    { nx: 2085, ny: 850, name: 'Outdoors', ids: ['bikepark', 'trailhead', 'climbing', 'tree'] }
  ];
  // each cabinet's lit parts that wake while the village is in use (x, y, w, h on that cabinet), and its tubes' glass
  // for the bubbles
  var PARTS = {
    wide: { glow: [[476, 222, 96, 306], [476, 636, 96, 314], [1756, 222, 96, 306], [1756, 636, 96, 314], [950, 990, 442, 78]],
      tube: [[504, 285, 40, 225], [504, 690, 40, 245], [1784, 285, 40, 225], [1784, 690, 40, 245]] },
    phone: { glow: [[64, 684, 100, 228], [64, 1288, 100, 258], [954, 684, 100, 228], [954, 1288, 100, 258], [380, 1652, 390, 74]],
      tube: [[93, 700, 44, 195], [93, 1304, 44, 226], [983, 700, 44, 195], [983, 1304, 44, 226]] }
  };
  Object.keys(PARTS).forEach(function (k) {
    function at(g) { return ' hs-for-' + k + '" aria-hidden="true" style="--x:' + g[0] + ';--y:' + g[1] + ';--w:' + g[2] + ';--h:' + g[3] + '">'; }
    PARTS[k].glow.forEach(function (g) { win.insertAdjacentHTML('beforeend', '<span class="hs-glow' + at(g) + '</span>'); });
    PARTS[k].tube.forEach(function (g) { win.insertAdjacentHTML('beforeend', '<span class="hs-tube' + at(g) + '<i></i><i></i><i></i><i></i></span>'); });
  });
  var plaque = win.querySelector('.hs-plaque'), said = '', ROW = [85, 250, 413, 578, 743, 900];
  NICHES.forEach(function (n, i) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'hs-niche';
    b.style.cssText = '--nx:' + n.nx + ';--ny:' + n.ny + ';--px:' + ROW[i % 6] + ';--py:' + (i < 6 ? 178 : 1858);
    b.setAttribute('aria-label', n.ids.map(function (id) { return byId(id).name; }).join(', ') + ': show in the village');
    b.innerHTML = '<img class="hs-obj" src="' + A + 'niche-' + n.ids[0] + '.webp?v=1" alt="" loading="lazy" decoding="async">' +
      '<span aria-hidden="true">' + n.name + '</span>';
    b.addEventListener('mouseenter', function () { point(n); });
    b.addEventListener('mouseleave', function () { unpoint(); });
    b.addEventListener('focus', function () { point(n); });
    b.addEventListener('blur', function () { unpoint(); });
    // a click flies to its place; again, to the next of its places
    b.addEventListener('click', function () {
      var i = zoomed ? n.ids.indexOf(zoomed.id) : -1, pl = plOf(n.ids[(i + 1) % n.ids.length]);
      if (pl) zoom(pl.p, pl.el);
    });
    n.el = b; win.appendChild(b);
  });
  // pointing at a niche: its places glow and the readout names them; held a moment, the view eases over to its place
  // if it's out of sight (Christian, Oct 20). It stays there when the pointer leaves.
  var peekT = 0;
  function point(n) {
    glow(n.ids); readout(byId(n.ids[0]), n);
    clearTimeout(peekT); peekT = setTimeout(function () { peek(n); }, 600);
  }
  function unpoint() { clearTimeout(peekT); glow(null); readout(zoomed); }
  function peek(n) {
    if (zoomed || drag) return;
    var pl = plOf(n.ids[0]); if (!pl || !pl.el) return;
    var vr = view.getBoundingClientRect(), r = pl.el.getBoundingClientRect();
    if (r.left >= vr.left && r.right <= vr.right && r.top >= vr.top && r.bottom <= vr.bottom) return;   // already in sight
    stopFollow();
    var W = stage.offsetWidth, Hh = stage.offsetHeight, b = box(pl.el);
    setZ(-(b.x + b.w / 2 - W / 2), -(b.y + b.h / 2 - Hh / 2), 1);
  }
  function byId(id) { for (var i = 0; i < PLACES.length; i++) if (PLACES[i].id === id) return PLACES[i]; }
  function nicheOf(id) { for (var i = 0; i < NICHES.length; i++) if (NICHES[i].ids.indexOf(id) > -1) return NICHES[i]; }
  function lamps(ids) {
    if (!(ids && ids.length) && zoomed) ids = [zoomed.id];               // nothing pointed at: the picked place keeps its lamp
    NICHES.forEach(function (n) { n.el.classList.toggle('on', !!ids && ids.some(function (id) { return n.ids.indexOf(id) > -1; })); });
    win.classList.toggle('live', !!(ids && ids.length) || !!zoomed);
  }
  // the readout: "Lake Home", or a place and its line; a new name fades out, then in
  function readout(p, n) {
    var many = n && n.ids.length > 1;   // a niche of several places: its name, and theirs underneath
    var t = p ? (many ? n.name : p.name) : 'Lake Home';
    var sub = p ? (many ? n.ids.map(function (id) { return byId(id).name.replace(/^The /, ''); }).join(' · ') : p.line) : '';
    if (t + sub === said) return;
    said = t + sub;
    plaque.classList.add('out');
    setTimeout(function () {
      if (said !== t + sub) return;
      plaque.firstChild.nodeValue = t; plaque.lastChild.textContent = sub;
      plaque.classList.remove('out');
    }, calm ? 0 : 600);
  }
  // pointing at a place lights its niche and names it on the readout
  stage.addEventListener('mouseover', function (ev) {
    var a = ev.target.closest('.hs-place'); if (!a) return;
    var pl = places.filter(function (q) { return q.el === a; })[0]; if (!pl) return;
    lamps(zoomed ? [zoomed.id, pl.p.id] : [pl.p.id]); readout(pl.p);
  });
  stage.addEventListener('mouseout', function (ev) {
    var a = ev.target.closest('.hs-place'); if (!a || a.contains(ev.relatedTarget)) return;
    lamps(zoomed ? [zoomed.id] : null); readout(zoomed);
  });

  // ── zooming in, like a map (Christian, Oct 19: "less is more; let the user explore the zoomed in scene"): a click on a
  // place eases the view in on it, and a small bubble by it says what it is, with one way in. Zoomed in, the village can
  // be dragged to look around, the places nearby wear small labels, and some have things to find: the real magazines on
  // the newsstand's rack, what's showing at the barn. A click on the ground, the bubble's ×, or Esc eases back out. ──
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
    zoomed = p; say(p, el); lamps([p.id]); readout(p); stopFollow();
  }
  function unzoom(back) {
    if (!zoomed) return;
    zoomed = null; win.classList.remove('zoomed'); win.removeAttribute('data-z'); hush();
    setZ(0, 0, 1);
    places.forEach(function (pl) { if (pl.el) pl.el.classList.remove('picked'); });
    lamps(null); readout(null); stopFollow();
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
    if (ev.button || ev.target.closest('.hs-spot, .hs-show')) return;
    if (!zoomed && (ev.pointerType === 'touch' || (stage.offsetWidth <= view.clientWidth + 2 && stage.offsetHeight <= view.clientHeight + 2))) return;   // a finger scrolls the page; or nothing to slide to
    stopFollow();
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
  view.addEventListener('pointerenter', function () { stopFollow(); });
  view.addEventListener('pointermove', function () { stopFollow(); });
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

  // ── finding a place: the niches (above) light it and fly to it; the legend that did this under the frame went once
  // every niche had its object (Christian, Oct 20) ──
  function plOf(id) { for (var i = 0; i < places.length; i++) if (places[i].p.id === id) return places[i]; }
  function glow(ids) { if (typeof ids === 'string') ids = [ids]; places.forEach(function (pl) { if (pl.el) pl.el.classList.toggle('lit', !!ids && ids.indexOf(pl.p.id) > -1); }); lamps(ids); }

  // ── following the butterfly (Christian, Oct 20): while nobody is using the village and it's on screen, the view drifts
  // slowly after her as she wanders the hill, a few seconds behind and only partway, like a camera keeping an eye on
  // her. Pointing at the village, dragging it or picking a place stops it at once; ten quiet seconds later it eases
  // back in. On a phone the view follows her up and down; with reduced motion it holds still. ──
  var fly = stage.querySelector('.hs-butterfly'), followT = 0, quietT = 0, onScreen = false;
  function follow() {
    if (calm || zoomed || drag || !onScreen || document.hidden) return;
    var W = stage.offsetWidth, Hh = stage.offsetHeight, k = W / stage.getBoundingClientRect().width, sr = stage.getBoundingClientRect(), r = fly.getBoundingClientRect();
    var bx = (r.left + r.width / 2 - sr.left) * k, by = (r.top + r.height / 2 - sr.top) * k;
    win.classList.add('drift');
    setZ(-(bx - W / 2) * .8, -(by - Hh / 2) * .8, 1);
  }
  function stopFollow() {
    clearInterval(followT); followT = 0; clearTimeout(quietT);
    if (win.classList.contains('drift')) {   // hold the view where it is now, mid-drift
      var m = getComputedStyle(stage).transform, sr = stage.getBoundingClientRect(), vr = view.getBoundingClientRect();
      win.classList.remove('drift');
      if (!zoomed && m && m !== 'none') setZ((sr.left + sr.width / 2) - (vr.left + vr.width / 2), (sr.top + sr.height / 2) - (vr.top + vr.height / 2), 1);
    }
    if (!calm) quietT = setTimeout(startFollow, 10000);
  }
  function startFollow() { if (followT || calm) return; follow(); followT = setInterval(follow, 4000); }
  if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { onScreen = e[0].isIntersecting; if (onScreen) startFollow(); }, { threshold: .4 }).observe(view);

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
        // the season, night, lake and weather stay (js/carry.js)
        var look = window.__look ? window.__look() : [];
        try { history.replaceState(null, '', location.pathname + '?' + ['lab', 'notes'].concat(use, look).join('+') + location.hash); } catch (e) { return; }
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
