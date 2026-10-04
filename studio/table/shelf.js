/* STUDIO SHELVES: three bits of open wood, each showing one prop at a time. The header's plank band to the
   right of the STUDIO panel (above the river), and the footer either side of the lamps. Every so often a
   prop slides out of a shelf and another one slides in, picked at random from the ones not already out, so
   a page left open long enough shows the whole collection. Works on the login page too. */
(function () {
  'use strict';
  var HERO = document.querySelector('.st-hero'), FOOT = document.querySelector('.st-foot');
  if (!HERO || !FOOT) return;
  var A = 'table/a/';
  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // name: [width / height, how big it is in real life (1 = a mug)]
  var POOL = {
    mug: [1.21, 1], cone: [1.11, .9], carnelians: [1.15, .75], pins: [1.26, .8], resin: [1.33, 1], canister: [1.08, .9],
    tape: [.74, 1.15], deer: [.59, 1], 'fox-sitting': [.71, 1.3], gloves: [1.02, 1.6], 'jar-off': [.92, 1.2],
    pencils: [1.02, 1.7], ruler: [2.87, 1.9], notebook: [1.38, 1.9], contact: [.75, 1.7], map: [1.3, 1.9], fox: [1.6, 1.8]
  };
  var NAMES = Object.keys(POOL), out = {};

  function el(cls, parent) { var d = document.createElement('div'); d.className = cls; parent.appendChild(d); return d; }
  var shelves = [
    { box: el('shelf shelf-top', HERO), from: 'right' },
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
    var right = (nav ? nav.getBoundingClientRect().left - h.left : h.width) - 14;
    // props may rest on the near bank of the river, so even a thin strip of wood gets a proper-sized prop
    var height = Math.min(Math.max(riverTop + 34, 84), 130), width = right - left;
    s.hidden = height < 34 || width < 50;
    s.style.left = left + 'px'; s.style.width = width + 'px'; s.style.top = '0px'; s.style.height = height + 'px';
  }

  function pick() {
    var free = NAMES.filter(function (n) { return !out[n]; });
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
    var h = Math.min(b.height * .78 * Math.min(1, .55 + p[1] * .28), b.width * .9 / p[0]);
    return { w: h * p[0], h: h };
  }
  function bring(sh) {
    if (sh.box.hidden) return Promise.resolve();
    var name = pick(); if (!name) return Promise.resolve();
    out[name] = true;
    var img = new Image(); img.alt = ''; img.className = 'shelf-prop'; img.src = A + name + '.webp';
    return (img.decode ? img.decode().catch(function () {}) : Promise.resolve()).then(function () {
      var z = sizeFor(sh, name), b = sh.box.getBoundingClientRect(), rot = (Math.random() * 16 - 8).toFixed(1);
      var x = (b.width - z.w) * (.25 + Math.random() * .5);
      img.style.width = z.w + 'px'; img.style.left = x + 'px'; img.style.top = ((b.height - z.h) / 2) + 'px';
      sh.box.appendChild(img); sh.prop = img; sh.name = name;
      var off = sh.from === 'left' ? -(x + z.w + 40) : (b.width - x + 40);
      return anim(img, [{ transform: 'translateX(' + off + 'px) rotate(' + (rot * 3) + 'deg)' }, { transform: 'translateX(0) rotate(' + rot + 'deg)' }], 1400, 'cubic-bezier(.2,.7,.25,1)');
    });
  }
  function take(sh) {
    var img = sh.prop; if (!img) return Promise.resolve();
    var b = sh.box.getBoundingClientRect(), r = img.getBoundingClientRect();
    var off = sh.from === 'left' ? -(r.right - b.left + 40) : (b.right - r.left + 40);
    var cur = getComputedStyle(img).transform;
    return anim(img, [{ transform: cur === 'none' ? 'none' : cur }, { transform: 'translateX(' + off + 'px)' }], 1100, 'cubic-bezier(.5,0,.75,.4)')
      .then(function () { img.remove(); delete out[sh.name]; sh.prop = null; sh.name = null; });
  }

  // one shelf changes at a time, every 12 to 25 seconds; nothing moves while the tab is hidden
  var turn = 0;
  function swap() {
    if (document.hidden) return schedule();
    var sh = shelves[turn++ % shelves.length];
    (sh.box.hidden ? Promise.resolve() : take(sh).then(function () { return new Promise(function (ok) { setTimeout(ok, 500); }); }).then(function () { return bring(sh); }))
      .then(schedule, schedule);
  }
  function schedule() { if (!calm) setTimeout(swap, 12000 + Math.random() * 13000); }

  function start() {
    placeTop();
    var chain = Promise.resolve();
    shelves.forEach(function (sh, i) { chain = chain.then(function () { return new Promise(function (ok) { setTimeout(ok, i ? 600 : 1200); }); }).then(function () { return bring(sh); }); });
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
