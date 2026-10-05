/* STUDIO SHELVES: open wood showing one prop at a time: the header's plank band to the right of the STUDIO
   panel (above the river). (The footer had two, either side of its valves, until it became the pipe; the
   code still takes side shelves, sliding in from the left or right, should a platform over the pipe come
   along.) Every so often a prop leaves a shelf and another arrives (dropping in from the top), picked at random from the ones not already out, so a page left open long enough shows the
   whole collection. A hand brings each one in and takes it away. Tap one to collect it and another takes
   its place.
   Works on the login page too. Marley (in the table layer) passes over all of them. */
(function () {
  'use strict';
  var HERO = document.querySelector('.st-hero'), FOOT = document.querySelector('.st-foot');
  if (!HERO || !FOOT) return;
  var A = 'table/a/';
  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // name: [width / height, how big it is in real life (1 = a mug; it sets the height, so a long thin vial is
  // below zero)]
  var POOL = {
    mug: [1.21, 1], cone: [1.11, .9], carnelians: [1.15, .75], resin: [1.33, 1],
    deer: [.59, 1], 'fox-sitting': [.71, 1.3], gloves: [1.02, 1.6], 'jar-off': [.92, 1.2],
    pencils: [1.02, 1.7], notebook: [1.38, 1.9], contact: [.75, 1.7], map: [1.3, 1.9], fox: [1.6, 1.8],
    compass: [2.04, 1.15], vial: [3.54, -.6], 'firefly-jar': [1.76, 1.15], projector: [1, .9]
  };
  // (no tape: that image is a half roll made to peek in from an edge; no film canister: it carries a brand;
  // no pins: tacks lying on a shelf looked odd; no ruler: too long for these strips)
  // where the hand holds a prop, if not its middle (as fractions of the image): the mug by its handle
  var GRIP = { mug: [.9, .5] };
  // props that light up at night: their night picture fades in with a glow of its colour on the wood. They
  // keep to the footer's side shelves, where the light shows (the header's night shade would cover it)
  var LAMP = { 'jar-off': ['jar-on', 'amber'], compass: ['compass-night', 'radium'], vial: ['vial-night', 'green'],
    'firefly-jar': ['firefly-jar-night', 'firefly'], projector: ['projector-night', 'holo'] };
  // the projector's holograms, from our other work: Marley and the paper animals (the origami cast, drawn
  // with every nested part, heads included) and the squid from the Parts Catalog. By night one floats over the lens; a tap on it flickers to the next
  var HOLO = ['marley', 'squid', 'fox', 'owl', 'hare', 'buck'];
  function hologram(box) {
    var beam = document.createElement('span'); beam.className = 'beam';
    var holo = document.createElement('div'); holo.className = 'holo';
    var fig = new Image(); fig.alt = ''; fig.draggable = false;
    var scan = document.createElement('span'); scan.className = 'scan';
    holo.appendChild(fig); holo.appendChild(scan); box.appendChild(beam); box.appendChild(holo);
    var at = Math.floor(Math.random() * HOLO.length);
    function show(i) {
      at = (i + HOLO.length) % HOLO.length;
      var u = A + 'holo-' + HOLO[at] + '.webp';
      fig.src = u; scan.style.webkitMaskImage = scan.style.maskImage = 'url(' + u + ')';
      holo.setAttribute('data-figure', HOLO[at]);
    }
    show(at);
    holo.addEventListener('click', function (e) {
      e.stopPropagation();
      if (holo.classList.contains('glitch')) return;
      holo.classList.add('glitch');
      setTimeout(function () { show(at + 1); }, 220);
      setTimeout(function () { holo.classList.remove('glitch'); }, 480);
    });
  }
  var NAMES = Object.keys(POOL), out = {};

  function el(cls, parent) { var d = document.createElement('div'); d.className = cls; parent.appendChild(d); return d; }
  var shelves = [
    { box: el('shelf shelf-top', HERO), from: 'top' }
  ];

  // the header shelf: the wood between the STUDIO panel and the right edge (or the buttons), above the river
  function placeTop() {
    var s = shelves[0].box, h = HERO.getBoundingClientRect(), cs = getComputedStyle(HERO);
    var ry = parseFloat(cs.getPropertyValue('--rv-y')) || 0, rh = parseFloat(cs.getPropertyValue('--rv-h')) || h.height;
    var riverTop = ry + rh * ((0.355 - 0.20) / 0.54);          // where the stream starts in the footage
    var panel = document.querySelector('.st-label .st-dn'), nav = document.querySelector('.st-nav');
    var left = (panel ? panel.getBoundingClientRect().right - h.left : 0) + 14;
    // the wood only: a prop never comes down onto the rocks, where the valves sit
    var height = Math.min(riverTop - 2, 130);
    var n = nav && nav.getBoundingClientRect();                  // the nav tags, when they sit up top
    var right = (n && n.top - h.top < height ? n.left - h.left : h.width) - (h.width < 640 ? 30 : 14);
    // and short of the valves, where they sit up in this band (on a phone): the shelf stays empty if that
    // leaves too little room
    [].forEach.call(HERO.querySelectorAll('.valve'), function (v) {
      var r = v.getBoundingClientRect();
      if (r.top - h.top < height && r.right - h.left > left) right = Math.min(right, r.left - h.left - 12);
    });
    var width = right - left;
    s.hidden = height < 40 || width < 80;
    s.style.left = left + 'px'; s.style.width = width + 'px'; s.style.top = '0px'; s.style.height = height + 'px';
  }

  function pick(not, sh) {
    var free = NAMES.filter(function (n) { return !out[n] && n !== not && !(LAMP[n] && sh.from === 'top'); });
    return free[Math.floor(Math.random() * free.length)];
  }
  function anim(node, frames, ms, ease) {
    if (calm || !node.animate) { var l = frames[frames.length - 1]; for (var k in l) node.style[k] = l[k]; return Promise.resolve(); }
    var a = node.animate(frames, { duration: ms, easing: ease, fill: 'forwards' });
    return a.finished.then(function () { for (var k in frames[frames.length - 1]) node.style[k] = frames[frames.length - 1][k]; a.cancel(); });
  }
  // size a prop to fit its shelf, in proportion to its real size
  function sizeFor(sh, name) {
    var b = sh.box.getBoundingClientRect(), p = POOL[name];
    var k = sh.from === 'top' && HERO.clientWidth < 640 ? .58 : .78;    // a phone's header strip is small
    var h = Math.min(b.height * k * Math.min(1, .55 + p[1] * .28), b.width * .9 / p[0]);
    return { w: h * p[0], h: h };
  }
  // the hand (the old table's pinch) reaches in from the edge nearest the prop, pinching it at its middle;
  // its sleeve runs on past the edge of the header or footer, so the end of the arm is never seen
  var HW = 560 / 219;                                   // hand-pinch.webp: width / height
  function ways(sh, cx, cy) {
    var b = sh.box.getBoundingClientRect(), wrap = (sh.from === 'top' ? HERO : FOOT).getBoundingClientRect();
    var px = b.left + cx, py = b.top + cy;
    // the header's bottom is the brass rail, and the footer's top meets the page, so those are never used
    var w = { left: px - wrap.left, right: wrap.right - px };
    if (sh.from === 'top') w.top = py - wrap.top; else w.bottom = wrap.bottom - py;
    return w;
  }
  function nearest(w) { return Object.keys(w).sort(function (m, n) { return w[m] - w[n]; })[0]; }
  // where the hand takes hold: the prop's middle, or its grip (the mug's handle) turned with the prop
  function holdAt(name, x, y, z, rot) {
    var g = GRIP[name], cx = x + z.w / 2, cy = y + z.h / 2;
    if (!g) return [cx, cy];
    var a = rot * Math.PI / 180, dx = (g[0] - .5) * z.w, dy = (g[1] - .5) * z.h;
    return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)];
  }
  function makeHand(sh, cx, cy, z, side) {
    var w = ways(sh, cx, cy); side = side || nearest(w);
    var edge = w[side];
    var hh = Math.max(26, Math.min(z.h * .7, 90)), hw = hh * HW, len = Math.max(hw, edge + 60);
    var hand = document.createElement('div'); hand.className = 'shelf-hand';
    hand.style.left = (cx - hw * .05) + 'px'; hand.style.top = (cy - hh * .6) + 'px';
    hand.style.width = len + 'px'; hand.style.height = hh + 'px';
    hand.style.transformOrigin = (hw * .05) + 'px 60%';
    var pic = new Image(); pic.alt = ''; pic.className = 'palm'; pic.src = A + 'hand-pinch.webp'; pic.style.width = hw + 'px';
    var sleeve = document.createElement('span'); sleeve.className = 'sleeve';
    hand.appendChild(pic); hand.appendChild(sleeve); sh.box.appendChild(hand);
    var turn = { right: '', left: 'scaleX(-1)', top: 'rotate(-90deg)', bottom: 'rotate(90deg)' }[side];
    var out = edge + (side === 'top' || side === 'bottom' ? z.h : z.w) / 2 + 30;
    var d = { right: [out, 0], left: [-out, 0], top: [0, -out], bottom: [0, out] }[side];
    var move = 'translate(' + d[0] + 'px,' + d[1] + 'px)';
    return { el: hand, at: 'translate(0,0) ' + turn, gone: move + ' ' + turn, move: move };
  }
  var IN = 'cubic-bezier(.25,.7,.3,1)', OUT = 'cubic-bezier(.5,0,.75,.4)';
  function pause(ms) { return new Promise(function (ok) { setTimeout(ok, calm ? 0 : ms); }); }

  // bring: a hand carries a new prop in, sets it down and leaves
  function bring(sh, not) {
    if (sh.box.hidden) return Promise.resolve();
    var name = pick(not, sh); if (!name) return Promise.resolve();
    out[name] = true;
    var pic = new Image(); pic.alt = ''; pic.src = A + name + '.webp'; pic.draggable = false;
    var img = pic;                                           // the prop itself: the picture, or a lamp's stack
    if (LAMP[name]) {
      img = document.createElement('div'); img.className = 'lamp glow-' + LAMP[name][1];
      var lit = new Image(); lit.alt = ''; lit.className = 'lit'; lit.src = A + LAMP[name][0] + '.webp'; lit.draggable = false;
      var glow = document.createElement('span'); glow.className = 'glow';
      img.appendChild(glow); img.appendChild(pic); img.appendChild(lit);
      if (name === 'projector') hologram(img);
    }
    img.classList.add('shelf-prop');
    img.addEventListener('click', function () { collect(sh, img); });
    return (pic.decode ? pic.decode().catch(function () {}) : Promise.resolve()).then(function () {
      var z = sizeFor(sh, name), b = sh.box.getBoundingClientRect(), rot = (Math.random() * 16 - 8).toFixed(1);
      // props keep close to an edge, for the hand: the header's just under its top (toward the STUDIO panel,
      // so clear of the screen's edge), the footer's near the outer edge of their side
      var f = Math.random() * .12, x = (b.width - z.w) * (sh.from === 'top' ? .1 + Math.random() * .4 : sh.from === 'left' ? f : 1 - f);
      var y = sh.from === 'top' ? 4 + Math.random() * 8 : (b.height - z.h) / 2;      // the header's tuck up to its top
      img.style.width = z.w + 'px'; img.style.left = x + 'px'; img.style.top = y + 'px';
      // a prop with a grip is turned so the grip faces the edge the hand comes from
      var side = nearest(ways(sh, x + z.w / 2, y + z.h / 2));
      if (GRIP[name]) rot = ({ right: 0, bottom: 90, left: 180, top: -90 }[side] + (Math.random() * 16 - 8)).toFixed(1);
      var at = holdAt(name, x, y, z, rot), r = 'rotate(' + rot + 'deg)', h = makeHand(sh, at[0], at[1], z, side);
      sh.rot = +rot; sh.side = side;
      img.style.transform = h.move + ' ' + r; h.el.style.transform = h.gone;
      sh.box.insertBefore(img, h.el); sh.prop = img; sh.name = name;
      return Promise.all([
        anim(h.el, [{ transform: h.gone }, { transform: h.at }], 1300, IN),
        anim(img, [{ transform: h.move + ' ' + r }, { transform: 'translate(0,0) ' + r }], 1300, IN)
      ]).then(function () { return pause(300); })
        .then(function () { return anim(h.el, [{ transform: h.at }, { transform: h.gone }], 1000, OUT); })
        .then(function () { h.el.remove(); });
    });
  }
  // take: a hand reaches in, pinches the prop and pulls it back out
  function take(sh) {
    var img = sh.prop; if (!img) return Promise.resolve();
    var name = sh.name;
    var z = { w: img.offsetWidth, h: img.offsetHeight };
    var at = holdAt(name, parseFloat(img.style.left), parseFloat(img.style.top), z, sh.rot || 0);
    var h = makeHand(sh, at[0], at[1], z, GRIP[name] ? sh.side : null);
    var from = getComputedStyle(img).transform; from = from === 'none' ? '' : from;
    h.el.style.transform = h.gone;
    return anim(h.el, [{ transform: h.gone }, { transform: h.at }], 1100, IN)
      .then(function () { return pause(250); })
      .then(function () {
        return Promise.all([
          anim(h.el, [{ transform: h.at }, { transform: h.gone }], 1150, OUT),
          anim(img, [{ transform: 'translate(0,0) ' + from }, { transform: h.move + ' ' + from }], 1150, OUT)
        ]);
      })
      .then(function () { h.el.remove(); img.remove(); delete out[name]; sh.prop = null; sh.name = null; });
  }

  // tap or click a prop to collect it: it hops up and vanishes, and a different one slides in
  function collect(sh, img) {
    if (sh.busy || sh.prop !== img) return;
    sh.busy = true;
    var was = sh.name, cur = getComputedStyle(img).transform; cur = cur === 'none' ? '' : cur + ' ';
    anim(img, [{ transform: cur + 'translateY(0) scale(1)', opacity: 1 },
               { transform: cur + 'translateY(-18%) scale(1.18)', opacity: 1, offset: .35 },
               { transform: cur + 'translateY(-30%) scale(.2)', opacity: 0 }], 650, 'cubic-bezier(.3,.6,.4,1)')
      .then(function () { img.remove(); delete out[was]; sh.prop = null; sh.name = null; return new Promise(function (ok) { setTimeout(ok, 350); }); })
      .then(function () { return bring(sh, was); })
      .then(function () { sh.busy = false; }, function () { sh.busy = false; });
  }

  // one shelf changes at a time, every 12 to 25 seconds; nothing moves while the tab is hidden
  var turn = 0;
  function swap() {
    if (document.hidden) return schedule();
    var sh = shelves[turn++ % shelves.length];
    if (sh.box.hidden || sh.busy) return schedule();
    sh.busy = true;
    var was = sh.name, done = function () { sh.busy = false; schedule(); };
    take(sh).then(function () { return new Promise(function (ok) { setTimeout(ok, 500); }); }).then(function () { return bring(sh, was); })
      .then(done, done);
  }
  function schedule() { if (!calm) setTimeout(swap, 12000 + Math.random() * 13000); }

  function start() {
    placeTop();
    var chain = Promise.resolve();
    shelves.forEach(function (sh, i) { chain = chain.then(function () { return new Promise(function (ok) { setTimeout(ok, i ? 600 : 1200); }); }).then(function () { sh.busy = true; return bring(sh); }).then(function () { sh.busy = false; }); });
    chain.then(schedule);
  }
  var resizing = null;
  addEventListener('resize', function () {
    clearTimeout(resizing);
    resizing = setTimeout(function () {
      placeTop();
      shelves.forEach(function (sh) { if (sh.prop) { var z = sizeFor(sh, sh.name), b = sh.box.getBoundingClientRect(); sh.prop.style.width = z.w + 'px'; sh.prop.style.left = Math.max(0, Math.min(parseFloat(sh.prop.style.left), b.width - z.w)) + 'px'; if (sh.from !== 'top') sh.prop.style.top = ((b.height - z.h) / 2) + 'px'; } });
    }, 200);
  });
  if (document.readyState === 'complete') setTimeout(start, 600); else addEventListener('load', function () { setTimeout(start, 600); });
})();
