/* FOOTER: two chipmunks playing on the rocks, the trail log, and the way out.
   The rocks and plants are the lake scene's own (SceneComponents builders, so they take the same
   season tints) and the chipmunks are the scene's rigged origami puppets (Creatures.build).
   Seasons and day/night follow the page (html[data-season], html.night-page):
     spring/summer  chipmunks chase each other from rock to rock; butterflies
     fall           the same, with leaves drifting down
     winter         chipmunks hibernate (they really do): a burrow, drifting z's, falling snow
     night          they're asleep too (chipmunks are daytime animals); fireflies, a few stars
   Everything waits until the footer is near the screen, and the play loop pauses when it's off it. */
(function () {
  'use strict';
  var foot = document.getElementById('siteFoot');
  if (!foot) return;
  var stage = foot.querySelector('.ft-stage'), scene = foot.querySelector('.ft-scene'), fx = foot.querySelector('.ft-fx');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var html = document.documentElement, built = false, onScreen = false, kids = [], perches = [], sceneParts = [];
  function season() { return html.dataset.season || 'spring'; }
  function night() { return html.classList.contains('night-page'); }
  function awake() { return season() !== 'winter' && !night(); }
  function rand(a, b) { return a + Math.random() * (b - a); }

  // ── The trail log: real numbers from the site's own data, rolling up when first seen ──
  var YEAR = new Date().getFullYear();
  function roll(el, to) {
    if (reduce) { el.textContent = to.toLocaleString(); return; }
    var t0 = performance.now(), dur = 1400;
    (function step(now) {
      var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(to * e).toLocaleString();
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  function fillLog() {
    var set = function (k, v) { var el = foot.querySelector('[data-log="' + k + '"]'); if (el && v != null) roll(el, v); };
    set('web', YEAR - 1997); set('flying', YEAR - 2016);
    fetch('play/hub.json').then(function (r) { return r.json(); }).then(function (h) {
      var t = h.totals || {}; set('miles', t.miles); set('feet', t.feet); set('daydreams', t.daydreams);
    }).catch(function () {});
  }

  // ── The scene: rocks and plants from the lake, placed along a bank ──
  // [src, left %, width %, flipped, isRock]
  var PIECES = [
    ['assets/fg-plant-fern.svg', 4, 6.5, false, false],
    ['assets/boulder-grass-0_0.svg', 12, 14, false, true],
    ['assets/fg-plant-yellow-flower-stem.svg', 31, 4.5, false, false],
    ['assets/boulder-grass-1_1.svg', 45, 13, false, true],
    ['assets/fg-plant-agave.svg', 61, 6.5, true, false],
    ['assets/boulder-grass-0_0.svg', 73, 10.5, true, true],
    ['assets/fg-plant-reeds.svg', 88, 8, false, false],
  ];
  function buildScene() {
    var SC = window.SceneComponents;
    PIECES.forEach(function (p) {
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'ft-piece' + (p[4] ? ' ft-rock' : ' ft-plant'));
      svg.style.left = p[1] + '%'; svg.style.width = p[2] + '%';
      scene.appendChild(svg);
      try { (p[4] ? SC.buildBoulderGrass : SC.buildForegroundPlant)(svg, p[0], season()); } catch (e) { svg.remove(); return; }
      if (p[3]) svg.style.transform = 'scaleX(-1)';
      var vb = (svg.getAttribute('viewBox') || '0 0 1 1').split(/\s+/).map(Number);
      svg.style.aspectRatio = vb[2] + ' / ' + vb[3];
      sceneParts.push(svg);
    });
  }
  // The real top of a rock: sample columns across its middle, find where each first meets the
  // rock's fill, and take the highest flat-ish spot. Mapped to the page by hand (viewBox, meet,
  // bottom-aligned, mirrored when flipped) so CSS transforms can't throw it off.
  function rockTop(svg) {
    var rock = svg._rock, paths = rock ? rock.querySelectorAll('path') : [];
    if (!paths.length || !paths[0].isPointInFill) return null;
    var bb = rock.getBBox(), vb = svg.viewBox.baseVal, a = svg.getBoundingClientRect();
    var k = Math.min(a.width / vb.width, a.height / vb.height), ox = (a.width - vb.width * k) / 2, oy = a.height - vb.height * k;
    var flip = /scaleX\(-1\)/.test(svg.style.transform), best = null;
    for (var f = 0.3; f <= 0.71; f += 0.05) {
      var x = bb.x + bb.width * f, y;
      for (y = bb.y; y < bb.y + bb.height; y += bb.height / 120) {
        var pt = new DOMPoint(x, y), hit = false;
        for (var i = 0; i < paths.length && !hit; i++) hit = paths[i].isPointInFill(pt);
        if (hit) break;
      }
      if (!best || y < best.y) best = { x: x, y: y };
    }
    var sx = ox + (best.x - vb.x) * k;
    return { x: flip ? a.right - sx : a.left + sx, y: a.top + oy + (best.y - vb.y) * k + 3, l: a.left, r: a.right };
  }
  // Where a chipmunk can sit: the top of each rock (measured from the art) and spots on the grass.
  function measure() {
    var sr = stage.getBoundingClientRect(); perches = [];
    scene.querySelectorAll('.ft-rock').forEach(function (svg, i) {
      var top = rockTop(svg);
      if (top) perches.push({ id: 'r' + i, x: top.x - sr.left, y: sr.bottom - top.y, rock: true, l: top.l - sr.left, r: top.r - sr.left });
    });
    [0.33, 0.39, 0.64, 0.69, 0.95].forEach(function (f, i) { perches.push({ id: 'g' + i, x: sr.width * f, y: sr.height * 0.17, rock: false }); });
  }

  // ── The chipmunks ──
  function makeKid(i) {
    var C = window.Creatures, c = C.build('chipmunk', { season: season() === 'winter' ? 'fall' : season(), night: false, behavior: 'alert', phase: i * 1.7 });
    var el = document.createElement('div'); el.className = 'ft-kid';
    var vb = c.viewBox, h = Math.max(34, stage.clientWidth * 0.045);
    el.style.width = (h * vb[2] / vb[3]) + 'px'; el.style.height = h + 'px';
    el.appendChild(c.svg); stage.appendChild(el);
    return { el: el, c: c, x: 0, y: 0, dir: 1, w: h * vb[2] / vb[3] };
  }
  function place(k, x, y) { k.x = x; k.y = y; k.el.style.transform = 'translate(' + (x - k.w / 2) + 'px,' + (-y) + 'px)'; }
  function face(k, dir) { k.dir = dir; k.c.svg.style.transform = dir < 0 ? 'scaleX(-1)' : ''; }
  // One hop along an arc; a long way on the grass is a run of small hops.
  function hop(k, x, y, ms, high) {
    return new Promise(function (done) {
      var x0 = k.x, y0 = k.y, t0 = performance.now();
      face(k, x < x0 ? -1 : 1);
      (function step(now) {
        var t = Math.min(1, (now - t0) / ms), e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        place(k, x0 + (x - x0) * e, y0 + (y - y0) * e + high * 4 * t * (1 - t));
        if (t < 1) requestAnimationFrame(step); else done();
      })(t0);
    });
  }
  function travel(k, to) {
    var steps = to.rock || Math.abs(to.x - k.x) < 60 ? 1 : Math.min(6, Math.ceil(Math.abs(to.x - k.x) / 70)), p = Promise.resolve();
    for (var i = 1; i <= steps; i++) (function (i) {
      p = p.then(function () {
        var last = i === steps, x = k.x + (to.x - k.x) / (steps - i + 1), y = last ? to.y : perches[perches.length - 1].y;
        return hop(k, x, y, last && to.rock ? 520 : 260, last && to.rock ? Math.max(40, Math.abs(to.y - k.y) * 0.5 + 30) : 14);
      });
    })(i);
    return p;
  }
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var looping = false;
  // The game: one chipmunk to a rock. The leader claims a rock (never the one the other is on); the
  // other runs to its foot and leaps for the top but falls short, while the one on top bounces and
  // squares up. Now and then the defender gives in and hops off the far side, and the challenger
  // takes the rock. On the grass they can meet nose to nose. Then they swap roles.
  function ground() { return perches.filter(function (p) { return !p.rock; })[0].y; }
  function byId(id) { return perches.filter(function (p) { return p.id === id; })[0]; }
  function play() {
    if (looping || reduce || !onScreen || !awake() || kids.length < 2) return;
    looping = true;
    var a = kids[0], b = kids[1];
    (function round() {
      if (!onScreen || !awake()) { looping = false; return; }
      measure();
      [a, b].forEach(function (k) { if (k.at) k.at = byId(k.at.id) || null; });
      var options = perches.filter(function (p) { return p !== a.at && !(b.at && b.at.rock && p === b.at); });
      var t = options[Math.floor(Math.random() * options.length)];
      a.at = t; a.c.setBehavior('alert'); b.c.setBehavior('alert');
      travel(a, t).then(function () { return wait(rand(150, 400)); }).then(function () {
        if (!t.rock) {
          // grass: land beside, sometimes square up and bounce
          var side = t.x > b.x ? -1 : 1, spot = { x: t.x + side * a.w * 1.15, y: t.y, rock: false };
          b.at = null;
          return travel(b, spot).then(function () {
            if (Math.random() < 0.5) return wait(0);
            face(a, b.x > a.x ? 1 : -1); face(b, a.x > b.x ? 1 : -1);
            return wait(400).then(function () { return Promise.all([hop(a, a.x, a.y, 220, 16), hop(b, b.x, b.y, 220, 12)]); })
              .then(function () { return Promise.all([hop(a, a.x, a.y, 220, 12), hop(b, b.x, b.y, 240, 18)]); });
          });
        }
        // rock: the challenger goes to the foot on its own side and tries for the top
        var fromRight = b.x > t.x, footX = fromRight ? t.r + b.w * 0.15 : t.l - b.w * 0.15, gy = ground();
        footX = Math.max(b.w / 2, Math.min(stage.clientWidth - b.w / 2, footX));
        b.at = null;
        var tries = 1 + Math.floor(Math.random() * 2), took = Math.random() < 0.4;
        return travel(b, { x: footX, y: gy, rock: false }).then(function () {
          var p = Promise.resolve();
          for (var i = 0; i < tries; i++) p = p.then(function () {
            face(b, fromRight ? -1 : 1); face(a, fromRight ? 1 : -1);
            // leap up the side, not quite to the top, and drop back to the foot; the defender bounces
            var reach = Math.max(24, (t.y - gy) * 0.75);
            return Promise.all([hop(b, footX + (fromRight ? -1 : 1) * b.w * 0.25, gy, 520, reach),
              wait(180).then(function () { return hop(a, a.x, a.y, 240, 14); })])
              .then(function () { return hop(b, footX, gy, 200, 6); }).then(function () { return wait(rand(250, 550)); });
          });
          if (!took) return p.then(function () { b.c.setBehavior('sniffUp'); });
          // the defender gives in: off the far side, and the challenger takes the rock
          return p.then(function () {
            var away = fromRight ? t.l - a.w * 0.4 : t.r + a.w * 0.4;
            away = Math.max(a.w / 2, Math.min(stage.clientWidth - a.w / 2, away));
            return hop(a, away, gy, 480, 34);
          }).then(function () {
            a.at = null;
            return hop(b, t.x, t.y, 520, Math.max(40, (t.y - gy) * 0.5 + 30));
          }).then(function () { b.at = t; face(b, fromRight ? -1 : 1); var x = a; a = b; b = x; });
        });
      }).then(function () {
        if (Math.random() < 0.5) { a.c.setBehavior('sniffUp'); }
        return wait(rand(1300, 2800));
      }).then(function () {
        if (Math.random() < 0.5) { var x = a; a = b; b = x; }   // swap who leads next
        setTimeout(round, rand(200, 800));
      });
    })();
  }

  // ── Season / night: who's awake, and what's in the air ──
  var mode = '';
  function particles(kind, n) {
    fx.innerHTML = '';
    if (reduce || !kind) return;
    for (var i = 0; i < n; i++) {
      var p = document.createElement('i'); p.className = 'ft-' + kind;
      p.style.left = rand(0, 100) + '%'; p.style.animationDelay = (-rand(0, 14)).toFixed(2) + 's';
      p.style.animationDuration = rand(kind === 'fly' ? 4 : 7, kind === 'fly' ? 8 : 13).toFixed(2) + 's';
      if (kind === 'fly' || kind === 'star') p.style.top = rand(kind === 'star' ? 4 : 20, kind === 'star' ? 40 : 80) + '%';
      if (kind === 'leaf') p.style.setProperty('--hue', String(Math.round(rand(10, 45))));
      fx.appendChild(p);
    }
  }
  function apply() {
    var s = season(), n = night(), m = s + (n ? '-n' : '');
    sceneParts.forEach(function (svg) { if (svg.setSeason) svg.setSeason(s); });
    foot.dataset.season = s; foot.classList.toggle('ft-isnight', n);
    var up = awake();
    foot.classList.toggle('ft-asleep', !up);
    kids.forEach(function (k) { k.c.setSeason && k.c.setSeason(s === 'winter' ? 'fall' : s); });
    if (m !== mode) {
      mode = m;
      if (n) { particles(s === 'winter' ? 'snow' : 'fly', s === 'winter' ? 26 : 12); }
      else particles(s === 'winter' ? 'snow' : s === 'fall' ? 'leaf' : 'fly-day', s === 'winter' ? 30 : s === 'fall' ? 12 : 3);
      if (n && s !== 'winter') for (var i = 0; i < 10; i++) { var st = document.createElement('i'); st.className = 'ft-star'; st.style.left = rand(2, 98) + '%'; st.style.top = rand(4, 40) + '%'; st.style.animationDelay = (-rand(0, 4)) + 's'; fx.appendChild(st); }
    }
    if (up) play();
  }

  function build() {
    if (built || !window.SceneComponents || !window.Creatures || !window.ORIGAMI_ART) return false;
    built = true;
    buildScene();
    setTimeout(function () {   // let the rocks lay out first, or their tops measure as ground level
      measure();
      kids = [makeKid(0), makeKid(1)];
      var r = perches.filter(function (p) { return p.rock; });
      place(kids[0], r[0].x, r[0].y); kids[0].at = r[0]; face(kids[0], 1);
      place(kids[1], r[0].x - kids[1].w * 0.9, perches[perches.length - 1].y); face(kids[1], 1);
      mode = ''; apply();
    }, 350);
    fillLog();
    var y = document.getElementById('ftYear'); if (y) y.textContent = YEAR;
    return true;
  }
  // The puppets load a moment after the page (wildlife's script chain); wait for them.
  function tryBuild() { if (!build()) setTimeout(tryBuild, 500); }

  new MutationObserver(function () { if (built) apply(); }).observe(html, { attributes: true, attributeFilter: ['class', 'data-season'] });
  addEventListener('resize', function () { if (!built) return; clearTimeout(tryBuild.r); tryBuild.r = setTimeout(function () {
    measure(); var h = Math.max(34, stage.clientWidth * 0.045);
    kids.forEach(function (k) { var vb = k.c.viewBox; k.w = h * vb[2] / vb[3]; k.el.style.width = k.w + 'px'; k.el.style.height = h + 'px'; var p = k.at || perches[0]; place(k, p.x, p.y); });
  }, 200); });
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) {
    onScreen = es[0].isIntersecting;
    if (onScreen) { if (!built) tryBuild(); else play(); }
  }, { rootMargin: '200px' }).observe(foot);
  else { onScreen = true; tryBuild(); }
})();
