/* STUDIO SHELVES: three bits of open wood, each showing one prop at a time. The header's plank band to the
   right of the STUDIO panel (above the river), and the footer either side of the lamps. Every so often a
   prop leaves a shelf and another arrives (dropping in from the top in the header, sliding in from the side
   in the footer), picked at random from the ones not already out, so a page left open long enough shows the
   whole collection. Tap one to collect it and another takes its place.
   Works on the login page too. Marley (in the table layer) passes over all of them. */
(function () {
  'use strict';
  var HERO = document.querySelector('.st-hero'), FOOT = document.querySelector('.st-foot');
  if (!HERO || !FOOT) return;
  var A = 'table/a/';
  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // name: [width / height, how big it is in real life (1 = a mug)]
  var POOL = {
    mug: [1.21, 1], cone: [1.11, .9], carnelians: [1.15, .75], pins: [1.26, .8], resin: [1.33, 1],
    deer: [.59, 1], 'fox-sitting': [.71, 1.3], gloves: [1.02, 1.6], 'jar-off': [.92, 1.2],
    pencils: [1.02, 1.7], ruler: [2.87, 1.9], notebook: [1.38, 1.9], contact: [.75, 1.7], map: [1.3, 1.9], fox: [1.6, 1.8]
  };
  // (no tape: that image is a half roll made to peek in from an edge; no film canister: it carries a brand)
  var NAMES = Object.keys(POOL), out = {};

  function el(cls, parent) { var d = document.createElement('div'); d.className = cls; parent.appendChild(d); return d; }
  var shelves = [
    { box: el('shelf shelf-top', HERO), from: 'top' },
    { box: el('shelf shelf-left', FOOT), from: 'left' },
    { box: el('shelf shelf-right', FOOT), from: 'right' }
  ];

  // the header shelf: the wood between the STUDIO panel and the right edge (or the buttons), above the river
  function placeTop() {
    var s = shelves[0].box, h = HERO.getBoundingClientRect(), cs = getComputedStyle(HERO);
    var ry = parseFloat(cs.getPropertyValue('--rv-y')) || 0, rh = parseFloat(cs.getPropertyValue('--rv-h')) || h.height;
    var riverTop = ry + rh * ((0.355 - 0.20) / 0.54);          // where the stream starts in the footage
    var panel = document.querySelector('.st-label .st-dn'), nav = document.querySelector('.st-nav');
    var left = (panel ? panel.getBoundingClientRect().right - h.left : 0) + 14;
    // props may rest on the near bank of the river, so even a thin strip of wood gets a proper-sized prop
    var height = Math.min(Math.max(riverTop + 34, 84), 130);
    var n = nav && nav.getBoundingClientRect();                  // the nav tags, when they sit up top
    var right = (n && n.top - h.top < height ? n.left - h.left : h.width) - (h.width < 640 ? 30 : 14), width = right - left;
    s.hidden = height < 34 || width < 50;
    s.style.left = left + 'px'; s.style.width = width + 'px'; s.style.top = '0px'; s.style.height = height + 'px';
  }

  function pick(not) {
    var free = NAMES.filter(function (n) { return !out[n] && n !== not; });
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
  function bring(sh, not) {
    if (sh.box.hidden) return Promise.resolve();
    var name = pick(not); if (!name) return Promise.resolve();
    out[name] = true;
    var img = new Image(); img.alt = ''; img.className = 'shelf-prop'; img.src = A + name + '.webp'; img.draggable = false;
    img.addEventListener('click', function () { collect(sh, img); });
    return (img.decode ? img.decode().catch(function () {}) : Promise.resolve()).then(function () {
      var z = sizeFor(sh, name), b = sh.box.getBoundingClientRect(), rot = (Math.random() * 16 - 8).toFixed(1);
      // the header's props stay toward the STUDIO panel, clear of the screen edge; the footer's anywhere central
      var x = (b.width - z.w) * (sh.from === 'top' ? .1 + Math.random() * .4 : .25 + Math.random() * .5);
      img.style.width = z.w + 'px'; img.style.left = x + 'px'; img.style.top = ((b.height - z.h) / 2) + 'px';
      sh.box.appendChild(img); sh.prop = img; sh.name = name;
      if (sh.from === 'top') {                                  // dropped in from above, with a little settle
        var up = -((b.height + z.h) / 2 + 40);
        return anim(img, [{ transform: 'translateY(' + up + 'px) rotate(' + (rot * 2) + 'deg)' },
                          { transform: 'translateY(6px) rotate(' + rot + 'deg)', offset: .7 },
                          { transform: 'translateY(0) rotate(' + rot + 'deg)' }], 1100, 'cubic-bezier(.45,0,.6,1)');
      }
      var off = sh.from === 'left' ? -(x + z.w + 40) : (b.width - x + 40);
      return anim(img, [{ transform: 'translateX(' + off + 'px) rotate(' + (rot * 3) + 'deg)' }, { transform: 'translateX(0) rotate(' + rot + 'deg)' }], 1400, 'cubic-bezier(.2,.7,.25,1)');
    });
  }
  function take(sh) {
    var img = sh.prop; if (!img) return Promise.resolve();
    var b = sh.box.getBoundingClientRect(), r = img.getBoundingClientRect();
    var cur = getComputedStyle(img).transform, to;
    if (sh.from === 'top') to = 'translateY(' + -(r.bottom - b.top + 40) + 'px)';     // lifted back out the top
    else to = 'translateX(' + (sh.from === 'left' ? -(r.right - b.left + 40) : (b.right - r.left + 40)) + 'px)';
    return anim(img, [{ transform: cur === 'none' ? 'none' : cur }, { transform: to }], 1000, 'cubic-bezier(.5,0,.75,.4)')
      .then(function () { img.remove(); delete out[sh.name]; sh.prop = null; sh.name = null; });
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
      shelves.forEach(function (sh) { if (sh.prop) { var z = sizeFor(sh, sh.name), b = sh.box.getBoundingClientRect(); sh.prop.style.width = z.w + 'px'; sh.prop.style.left = Math.max(0, Math.min(parseFloat(sh.prop.style.left), b.width - z.w)) + 'px'; sh.prop.style.top = ((b.height - z.h) / 2) + 'px'; } });
    }, 200);
  });
  if (document.readyState === 'complete') setTimeout(start, 600); else addEventListener('load', function () { setTimeout(start, 600); });
})();
