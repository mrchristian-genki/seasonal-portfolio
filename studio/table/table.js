/* STUDIO TABLE: props arrive on their own (rolled, slid, dropped), a hand takes them away, photos land
   as prints, Process Content develops them and lights the green lamp, Marley drops by. Positions are
   in table units: the table photo is 2000 x 1116. */
(function () {
  'use strict';
  var T = document.getElementById('table'), L = document.getElementById('layer');
  if (!T || !L) return;
  var W = 2000, H = 1116, calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var BASE = T.getAttribute('data-base') || '', HEADER = T.getAttribute('data-set') === 'header';
  var hour = new Date().getHours();
  var night = /[?&]night\b/.test(location.search) || (HEADER && (hour >= 19 || hour < 6));
  // a choice made on the switch wins over the clock
  try { var pick = localStorage.getItem('st-night'); if (HEADER && pick !== null) night = pick === '1'; } catch (e) {}
  // the header plays the arrivals once per visit; after that the table is simply set
  var settle = false;
  if (night) T.classList.add('night');

  // x, y = centre; w = width; rot in degrees; how = roll | slide | drop | gentle; from = the edge it comes in over
  var PROPS = [
    { id: 'pencils', src: 'pencils', x: 279, y: 223, w: 444, rot: 0, how: 'slide', from: 'left' },
    { id: 'ruler', src: 'ruler', x: 819, y: 97, w: 557, rot: 0, how: 'slide', from: 'top' },
    { id: 'tape', src: 'tape', x: 1902, y: 459, w: 191, rot: 0, how: 'roll', from: 'right' },
    { id: 'canister', src: 'canister', x: 1881, y: 681, w: 154, rot: 0, how: 'roll', from: 'right' },
    { id: 'mat', src: 'mat', x: 1641, y: 980, w: 717, rot: 0, how: 'slide', from: 'right' },
    { id: 'pins', src: 'pins', x: 1118, y: 1039, w: 152, rot: 0, how: 'drop' },
    { id: 'panel', src: ['panel-off', 'panel-day', 'panel-night'], x: 1700, y: 610, w: 112, rot: 0, how: 'slide' },
    { id: 'contact', src: 'contact', x: 1800, y: 175, w: 330, rot: 7, how: 'slide', from: 'top' },
    { id: 'resin', src: 'resin', x: 215, y: 445, w: 175, rot: -8, how: 'slide', from: 'left' },
    { id: 'cone', src: 'cone', x: 1205, y: 330, w: 140, rot: 0, how: 'roll', from: 'top' },
    { id: 'jar', src: ['jar-off', 'jar-on'], x: 245, y: 655, w: 165, rot: 0, how: 'gentle', from: 'left' },
    { id: 'carnelians', src: 'carnelians', x: 745, y: 835, w: 125, rot: 12, how: 'drop' },
    { id: 'gloves', src: 'gloves', x: 600, y: 590, w: 360, rot: -9, how: 'slide', from: 'left' },
    { id: 'notebook', src: 'notebook', x: 340, y: 1010, w: 430, rot: -6, how: 'slide', from: 'bottom' },
    { id: 'map', src: 'map', x: 790, y: 1065, w: 440, rot: -3, how: 'slide', from: 'bottom' },
    { id: 'mug', src: 'mug', x: 1562, y: 812, w: 160, rot: 0, how: 'gentle', from: 'right' },
    { id: 'fox', src: 'fox', x: 1700, y: 1010, w: 400, rot: -5, how: 'slide', from: 'right' },
    { id: 'foxsit', src: 'fox-sitting', x: 1330, y: 640, w: 230, rot: 8, how: 'slide', from: 'right' },
    { id: 'deer', src: 'deer', x: 150, y: 895, w: 95, rot: 20, how: 'drop' }
  ];
  // the header is the river table now (river.js): the STUDIO plate on the left, the day/night dial and switch
  // under the buttons on the right, and Marley drops by; the props live on the full table
  if (HEADER) PROPS = [];
  var PHOTOS = ['01', '02', '03'].map(function (n) { return '../../play/media/2024-09-05-marlette/' + n + '.jpg'; });
  var els = {}, prints = [], busy = false;

  function px(u) { return u * T.clientWidth / W; }
  function place(el, p, w) {
    el.style.left = ((p.x - w / 2) / W * 100) + '%';
    el.style.top = ((p.y) / H * 100) + '%';
    el.style.width = (w / W * 100) + '%';
  }
  function img(src, cls) { var i = new Image(); i.src = BASE + 'a/' + src + '.webp'; i.alt = ''; i.decoding = 'async'; if (cls) i.className = cls; return i; }
  function wait(ms) { return new Promise(function (ok) { setTimeout(ok, calm ? 0 : ms); }); }
  function anim(el, frames, opt) {
    if (calm) { var last = frames[frames.length - 1]; Object.keys(last).forEach(function (k) { if (k !== 'offset' && k !== 'easing') el.style[k] = last[k]; }); return Promise.resolve(); }
    var a = el.animate(frames, Object.assign({ fill: 'forwards' }, opt));
    return a.finished.then(function () { a.commitStyles && a.commitStyles(); a.cancel(); });
  }
  // the resting transform: centred on its y, turned by rot
  function rest(p) { return 'translateY(-50%) rotate(' + p.rot + 'deg)'; }
  function offEdge(p) {
    var from = p.from || [['left', p.x], ['right', W - p.x], ['top', p.y], ['bottom', H - p.y]].sort(function (a, b) { return a[1] - b[1]; })[0][0];
    var d = p.w + 260;
    return from === 'left' ? [-(p.x + d), 0] : from === 'right' ? [W - p.x + d, 0] : from === 'top' ? [0, -(p.y + d)] : [0, H - p.y + d];
  }

  function makeProp(p) {
    var el = document.createElement('div');
    el.className = 'prop p-' + p.id + (Array.isArray(p.src) ? ' stack' : '');
    if (Array.isArray(p.src)) {
      el.appendChild(img(p.src[0], 'off')); el.appendChild(img(p.src[1], 'on'));
      if (p.src[2]) el.appendChild(img(p.src[2], 'on2'));
      var g = document.createElement('span'); g.className = 'glow'; el.appendChild(g);
      if (p.id === 'jar') el.classList.add('glows');
    } else el.appendChild(img(p.src));
    place(el, p, p.w);
    el.style.transform = rest(p);
    L.appendChild(el); els[p.id] = el;
    return el;
  }

  function arrive(p) {
    var el = makeProp(p), r = rest(p);
    if (p.how === 'drop') p = Object.assign({}, p, { how: 'slide' });
    if (false) return anim(el, [
      { transform: r + ' scale(1.35)', opacity: 0 },
      { transform: r + ' scale(.96)', opacity: 1, offset: .7 },
      { transform: r + ' scale(1)', opacity: 1 }], { duration: 650, easing: 'cubic-bezier(.5,0,.75,0)' });
    var o = offEdge(p), dx = px(o[0]), dy = px(o[1]);
    if (p.how === 'roll') return anim(el, [
      { transform: 'translate(' + dx + 'px,' + dy + 'px) ' + r + ' rotate(-540deg)' },
      { transform: 'translate(' + (-dx * .03) + 'px,' + (-dy * .03) + 'px) ' + r + ' rotate(8deg)', offset: .82 },
      { transform: 'translate(' + (dx * .008) + 'px,' + (dy * .008) + 'px) ' + r + ' rotate(-3deg)', offset: .92 },
      { transform: r }], { duration: 1500, easing: 'cubic-bezier(.15,.6,.3,1)' });
    var turn = p.how === 'gentle' ? 0 : (p.rot > 0 ? -9 : 9);
    return anim(el, [
      { transform: 'translate(' + dx + 'px,' + dy + 'px) ' + r + ' rotate(' + turn + 'deg)' },
      { transform: r }], { duration: p.how === 'gentle' ? 1500 : 1100, easing: 'cubic-bezier(.2,.7,.25,1)' });
  }

  // the hand reaches in from the edge nearest the item, its sleeve running off that edge so the end of
  // the arm is never seen, takes the item and slides back out the same way
  function makeHand(p, paper) {
    var art = 'hand-pinch', ratio = 219 / 560, hw = 380, hh = hw * ratio;
    var edges = [['right', W - p.x], ['left', p.x], ['top', p.y], ['bottom', H - p.y]].sort(function (a, b) { return a[1] - b[1]; });
    var edge = edges[0][0], len = Math.max(hw, edges[0][1] + 140);   // fingertips to beyond the edge
    var turn = { right: '', left: 'scaleX(-1)', top: 'rotate(-90deg)', bottom: 'rotate(90deg)' }[edge];
    var hand = document.createElement('div');
    hand.className = 'prop hand';
    hand.style.left = (p.x / W * 100) + '%';
    hand.style.top = ((p.y - hh / 2) / H * 100) + '%';
    hand.style.width = (len / W * 100) + '%';
    hand.style.height = (hh / H * 100) + '%';
    hand.style.transformOrigin = '0 50%';
    var pic = img(art, 'palm'); pic.style.width = (hw / len * 100) + '%';
    var sleeve = document.createElement('span'); sleeve.className = 'sleeve';
    sleeve.style.backgroundImage = 'url(' + BASE + 'a/' + art + '-sleeve.webp)';
    hand.appendChild(pic); hand.appendChild(sleeve);
    L.appendChild(hand);
    var out = px(len + 60), dir = { right: [1, 0], left: [-1, 0], top: [0, -1], bottom: [0, 1] }[edge];
    return { el: hand, at: turn + ' translateX(0)', gone: turn + ' translateX(' + out + 'px)', move: 'translate(' + dir[0] * out + 'px,' + dir[1] * out + 'px) ' };
  }
  var PAPER = /./;   // the pinch reads as picking anything up; the closed hold looked like a fist

  // take: the hand comes from the edge nearest the item, its sleeve running off that edge so the end of
  // the arm is never seen, takes the item and slides back out the same way
  function takeAway(el, p) {
    var h = makeHand(p, PAPER.test(el.className)), IN = 'cubic-bezier(.25,.7,.3,1)', OUT = 'cubic-bezier(.5,0,.75,.4)';
    h.el.style.transform = h.gone;
    return anim(h.el, [{ transform: h.gone }, { transform: h.at }], { duration: 1100, easing: IN })
      .then(function () { return wait(250); })
      .then(function () {
        var from = getComputedStyle(el).transform; from = from === 'none' ? '' : from;
        return Promise.all([
          anim(h.el, [{ transform: h.at }, { transform: h.gone }], { duration: 1150, easing: OUT }),
          anim(el, [{ transform: 'translate(0,0) ' + from }, { transform: h.move + from }], { duration: 1150, easing: OUT })
        ]);
      })
      .then(function () { h.el.remove(); el.remove(); });
  }

  // hand in: the hand carries a missing item in from the nearest edge, sets it down and leaves
  function handIn(p) {
    var el = makeProp(p), h = makeHand(p, PAPER.test(el.className)), r = rest(p);
    h.el.style.transform = h.gone; el.style.transform = h.move + r;
    return Promise.all([
      anim(h.el, [{ transform: h.gone }, { transform: h.at }], { duration: 1300, easing: 'cubic-bezier(.25,.7,.3,1)' }),
      anim(el, [{ transform: h.move + r }, { transform: 'translate(0,0) ' + r }], { duration: 1300, easing: 'cubic-bezier(.25,.7,.3,1)' })
    ]).then(function () { return wait(300); })
      .then(function () { return anim(h.el, [{ transform: h.at }, { transform: h.gone }], { duration: 1000, easing: 'cubic-bezier(.5,0,.75,.4)' }); })
      .then(function () { h.el.remove(); });
  }

  // prints: your photos, pushed onto the table one by one
  function dropPrints() {
    var spots = [{ x: 720, y: 430, rot: -6 }, { x: 1010, y: 470, rot: 4 }, { x: 1290, y: 520, rot: -2 }];
    var chain = Promise.resolve();
    PHOTOS.forEach(function (src, i) {
      chain = chain.then(function () {
        var p = { id: 'print', x: spots[i].x, y: spots[i].y, w: 280, rot: spots[i].rot, how: 'slide', from: 'bottom' };
        var el = document.createElement('div'); el.className = 'prop p-print';
        var photo = new Image(); photo.className = 'photo'; photo.alt = ''; photo.src = src;
        el.appendChild(img('print', 'paper')); el.appendChild(photo); el.appendChild(img('print', 'sheen'));
        el.classList.add('undeveloped'); photo.style.opacity = '.08';
        place(el, p, p.w); el.style.transform = rest(p); L.appendChild(el);
        prints.push({ el: el, p: p, photo: photo });
        var o = offEdge(p);
        return anim(el, [{ transform: 'translate(0,' + px(o[1]) + 'px) ' + rest(p) + ' rotate(10deg)' }, { transform: rest(p) }], { duration: 1050, easing: 'cubic-bezier(.2,.7,.25,1)' });
      }).then(function () { return wait(180); });
    });
    return chain;
  }

  // Process Content: the prints develop like film in a tray, then the green lamp lights
  function process() {
    if (!prints.length) return dropPrints().then(process);
    var panel = els.panel;
    var chain = Promise.resolve();
    prints.forEach(function (pr) {
      chain = chain.then(function () {
        if (!pr.photo.isConnected) return;
        if (calm) { pr.photo.style.opacity = 1; pr.photo.style.filter = 'none'; return; }
        return anim(pr.photo, [
          { opacity: .08, filter: 'sepia(.9) contrast(.4) brightness(1.4)' },
          { opacity: .7, filter: 'sepia(.5) contrast(.8) brightness(1.15)', offset: .6 },
          { opacity: 1, filter: 'sepia(0) contrast(1) brightness(1)' }], { duration: 2600, easing: 'ease-in-out' });
      });
    });
    return chain.then(function () { return wait(400); }).then(function () { if (panel && !calm) anim(panel, [{ filter: 'brightness(1)' }, { filter: 'brightness(1.5)' }, { filter: 'brightness(1)' }], { duration: 900, iterations: 2 }); });
  }

  // Marley drops by over the top edge: leaning in by day, resting or asleep at night
  var marleyOut = false;
  function marley() {
    if (marleyOut) return Promise.resolve();
    marleyOut = true;
    var isNight = T.classList.contains('night');
    // (the resting pose comes back once its clean cut-out is in)
    var k = 1.55;   // real scale against the ruler (12 in = 557 units): her head and ears are about 600 wide
    // in the header, just her snout pokes over the top edge, day or night
    // the header is a pipeline seen from further back, so she's smaller there: a snout peeking over the edge
    var pose = HEADER ? { src: 'marley-look', w: 390 * .62, ratio: 635 / 640, show: .26 }
      : isNight ? { src: 'marley-sleep', w: 560 * k, ratio: 357 / 640, show: 1 }
      : { src: 'marley-look', w: 390 * k, ratio: 635 / 640, show: .62 };
    var el = document.createElement('div'); el.className = 'prop marley';
    el.appendChild(img(pose.src));
    var h = pose.w * pose.ratio;
    el.style.top = ((-h * (1 - pose.show)) / H * 100) + '%';
    el.style.width = (pose.w / W * 100) + '%';
    L.appendChild(el);
    // her usual spot, or the nearest one that keeps clear of the logo and the lamps
    var spots = HEADER ? [1345, 1150, 950, 760].sort(function () { return Math.random() - .5; }) : [1345];
    var spot = spots.filter(function (x) {
      el.style.left = ((x - pose.w / 2) / W * 100) + '%'; return !touchesKeep(el);
    })[0];
    if (spot == null) { el.remove(); marleyOut = false; return Promise.resolve(); }
    el.style.left = ((spot - pose.w / 2) / W * 100) + '%';
    var up = 'translateY(' + px(-h * pose.show - 40) + 'px)';
    return anim(el, [{ transform: up }, { transform: 'none' }], { duration: 1600, easing: 'cubic-bezier(.2,.7,.3,1)' })
      .then(function () { // a sniff: a small lean in and back
        var d = HEADER ? 4 : 10;
        return anim(el, [{ transform: 'none' }, { transform: 'translateY(' + px(d) + 'px) rotate(-1deg)', offset: .3 }, { transform: 'translateY(' + px(d * .4) + 'px)', offset: .55 }, { transform: 'none' }], { duration: 1800, delay: 1600, easing: 'ease-in-out' });
      })
      .then(function () { return wait(HEADER ? 3500 : isNight ? 9000 : 6000); })
      .then(function () { return anim(el, [{ transform: 'none' }, { transform: up }], { duration: 1500, easing: 'cubic-bezier(.5,0,.7,.4)' }); })
      .then(function () { el.remove(); marleyOut = false; });
  }

  function setLamps() { if (els.jar) els.jar.classList.toggle('lit', T.classList.contains('night')); }

  // The desk's two mounted pieces, one at each end of the header: the logo and label on the left (like a
  // mug), and the day/night lamps under the Play and Log out buttons on the right. They stay put at every
  // screen width; every other prop (and Marley) keeps a margin clear of them, and is left off if it can't.
  var LABEL = document.querySelector('.st-label'), NAV = document.querySelector('.st-nav'), DN = [].slice.call(document.querySelectorAll('.st-dn'));
  var GAP = 24;
  function pinned() { return PROPS.filter(function (p) { return p.pin === 'nav'; }); }
  // where a pinned prop rests on screen, worked out from its spot (it may still be sliding in)
  function pinnedRect(p) {
    var t = T.getBoundingClientRect(), k = t.width / W, w = p.w * k, h = w * (p.ar || 1);
    var x = t.left + (p.x - p.w / 2) * k, y = t.top + p.y * k - h / 2;
    return { left: x, top: y, right: x + w, bottom: y + h };
  }
  function keepRects() {
    var out = [];
    if (LABEL) out.push(LABEL.getBoundingClientRect());
    DN.forEach(function (d) { out.push(d.getBoundingClientRect()); });
    if (NAV) {
      var n = NAV.getBoundingClientRect(), r = { left: n.left, top: n.top, right: n.right, bottom: n.bottom };
      pinned().forEach(function (p) {
        var q = pinnedRect(p);
        r = { left: Math.min(r.left, q.left), top: Math.min(r.top, q.top), right: Math.max(r.right, q.right), bottom: Math.max(r.bottom, q.bottom) };
      });
      out.push(r);
    }
    return out;
  }
  function touchesKeep(el) {
    var b = el.getBoundingClientRect();
    return keepRects().some(function (a) {
      return !(b.right < a.left - GAP || b.left > a.right + GAP || b.bottom < a.top - GAP || b.top > a.bottom + GAP);
    });
  }
  // a prop with more than one spot takes the first that's clear (its usual one first)
  function fits(p) {
    if (p.pin || (!LABEL && !NAV)) return Promise.resolve(true);
    var el = makeProp(p); el.style.visibility = 'hidden';
    var pics = [].slice.call(el.querySelectorAll('img'));
    return Promise.all(pics.map(function (i) { return i.decode ? i.decode().catch(function () {}) : null; }))
      .then(function () {
        var ok = (p.spots || [[p.x, p.y]]).some(function (sp) {
          p.x = sp[0]; p.y = sp[1]; place(el, p, p.w); return !touchesKeep(el);
        });
        el.remove(); delete els[p.id]; return ok;
      });
  }

  // the day/night lamps sit just under the Play and Log out buttons at every screen width
  function pin() {
    if (!NAV) return;
    var t = T.getBoundingClientRect(), n = NAV.getBoundingClientRect();
    if (!t.width || !n.width) return;
    pinned().forEach(function (p) {
      var u = W / t.width;
      p.x = Math.round((n.left + n.width / 2 - t.left) * u);
      p.y = Math.round((n.bottom - t.top) * u + 14 + p.w * 0.48);
      if (els[p.id]) place(els[p.id], p, p.w);
    });
  }

  // when the window changes size, props that now crowd the mounted pieces lift away, and ones that fit
  // again come back
  var settled = false, sizeTimer = null;
  function reflow() {
    if (!settled) return;
    pin();
    PROPS.forEach(function (p) {
      if (p.pin) return;
      var el = els[p.id];
      if (el && el.isConnected && !p.off) {
        if (!touchesKeep(el)) return;
        p.off = true; delete els[p.id];
        anim(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 450 }).then(function () {
          el.remove();
          return fits(p).then(function (ok) { if (ok && p.off) { p.off = false; arrive(p); } });
        });
      } else if (p.off) {
        fits(p).then(function (ok) { if (ok && p.off) { p.off = false; arrive(p); } });
      }
    });
  }
  window.addEventListener('resize', function () { clearTimeout(sizeTimer); sizeTimer = setTimeout(reflow, 250); });

  function start() {
    L.innerHTML = ''; els = {}; prints = []; settled = false; pin();
    var chain = Promise.resolve();
    PROPS.forEach(function (p, i) {
      chain = chain.then(function () { return fits(p); }).then(function (ok) { p.off = !ok; });
    });
    PROPS.forEach(function (p, i) {
      chain = chain.then(function () {
        if (p.off) return;
        if (p.fixed || calm || settle) { makeProp(p); return; }
        arrive(p); return wait(340);
      });
    });
    return chain.then(function () { return wait(1600); }).then(function () { settled = true; setLamps(); });
  }

  var timer = null;
  // no visits over a phone's header, which is kept clear
  var phone = HEADER && window.matchMedia && matchMedia('(max-width:640px)').matches;
  function visits() { clearTimeout(timer); if (calm || phone) return;
    timer = setTimeout(function () { marley().then(visits); }, HEADER ? 60000 + Math.random() * 60000 : 28000 + Math.random() * 22000); }

  window.StudioTable = { process: process, drop: dropPrints, marley: marley, tick: function () { return tick(); },
    night: function (on) { T.classList.toggle('night', on); setLamps(); } };
  var C = document.querySelector('.controls');
  if (C) C.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || busy) return;
    var act = b.getAttribute('data-act'), job;
    if (act === 'night') {
      var n = T.classList.toggle('night'); b.textContent = n ? 'Day' : 'Night'; setLamps(); return;
    }
    busy = true;
    if (act === 'drop') job = dropPrints();
    else if (act === 'process') job = process();
    else if (act === 'marley') job = marley();
    else if (act === 'reset') job = start();
    else if (act === 'handin') {
      var gone = PROPS.filter(function (p) { return !p.fixed && !p.off && !(els[p.id] && els[p.id].isConnected); });
      var back = gone[Math.floor(Math.random() * gone.length)];
      if (back) back.away = false;
      job = back ? handIn(back) : Promise.resolve();
    }
    else if (act === 'take') {
      var pool = prints.filter(function (pr) { return pr.el.isConnected; }).map(function (pr) { return { el: pr.el, p: pr.p }; })
        .concat(PROPS.filter(function (p) { return !p.fixed && els[p.id] && els[p.id].isConnected; }).map(function (p) { return { el: els[p.id], p: p }; }));
      var pick = pool[Math.floor(Math.random() * pool.length)];
      if (pick && pick.p.id !== 'print') pick.p.away = true;
      job = pick ? takeAway(pick.el, pick.p) : Promise.resolve();
    }
    (job || Promise.resolve()).then(function () { busy = false; });
  });
  if (night && C) C.querySelector('[data-act=night]').textContent = 'Day';

  // A lived-in desk: every few minutes something small happens. The hand tidies one thing away, brings
  // back something it took, or an item gets nudged. The mounted pieces (logo, lamps) never move, and
  // nothing lands near them.
  var idleTimer = null;
  function onDesk(p) { return !p.pin && !p.off && els[p.id] && els[p.id].isConnected; }
  function tick() {
    if (busy || marleyOut || document.hidden || !settled) return Promise.resolve();
    var here = PROPS.filter(onDesk);
    var away = PROPS.filter(function (p) { return p.away && !p.pin && !p.off; });
    var r = Math.random(), job;
    if (away.length && (away.length >= 2 || r < .35)) {
      var back = away[Math.floor(Math.random() * away.length)];
      job = fits(back).then(function (ok) { if (!ok) return; back.away = false; return handIn(back); });
    } else if (here.length > 4 && r < .7) {
      var go = here[Math.floor(Math.random() * here.length)];
      go.away = true; job = takeAway(els[go.id], go);
    } else if (here.length) {
      var n = here[Math.floor(Math.random() * here.length)], el = els[n.id], from = rest(n);
      n.rot = Math.max(-14, Math.min(14, n.rot + (Math.random() < .5 ? -1 : 1) * (2 + Math.random() * 4)));
      var dx = (Math.random() - .5) * 30, dy = (Math.random() - .5) * 20, was = { x: n.x, y: n.y };
      n.x += dx; n.y += dy; place(el, n, n.w);
      if (touchesKeep(el)) { n.x = was.x; n.y = was.y; place(el, n, n.w); }
      var dxp = px(n.x - was.x), dyp = px(n.y - was.y);
      job = anim(el, [{ transform: 'translate(' + (-dxp) + 'px,' + (-dyp) + 'px) ' + from }, { transform: rest(n) }], { duration: 900, easing: 'cubic-bezier(.3,.6,.3,1)' });
    }
    busy = true;
    return (job || Promise.resolve()).then(function () { busy = false; }, function () { busy = false; });
  }
  function idle() { clearTimeout(idleTimer); if (calm) return; idleTimer = setTimeout(function () { tick().then(idle); }, 150000 + Math.random() * 150000); }

  start().then(function () { return calm || phone ? null : wait(settle ? 4000 : 1500).then(marley); }).then(function () { visits(); idle(); });
})();
