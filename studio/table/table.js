/* STUDIO TABLE: props arrive on their own (rolled, slid, dropped), a hand takes them away, photos land
   as prints, Process Content develops them and lights the green lamp, Marley drops by. Positions are
   in table units: the table photo is 2000 x 1116. */
(function () {
  'use strict';
  var T = document.getElementById('table'), L = document.getElementById('layer');
  var W = 2000, H = 1116, calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var night = /[?&]night\b/.test(location.search);
  if (night) T.classList.add('night');

  // x, y = centre; w = width; rot in degrees; how = roll | slide | drop | gentle; from = the edge it comes in over
  var PROPS = [
    { id: 'panel', src: ['panel-off', 'panel-on'], x: 1700, y: 610, w: 112, rot: 0, how: 'drop', fixed: true },
    { id: 'contact', src: 'contact', x: 1765, y: 175, w: 360, rot: 7, how: 'slide', from: 'top' },
    { id: 'resin', src: 'resin', x: 215, y: 445, w: 175, rot: -8, how: 'slide', from: 'left' },
    { id: 'cone', src: 'cone', x: 1205, y: 330, w: 140, rot: 0, how: 'roll', from: 'top' },
    { id: 'jar', src: ['jar-off', 'jar-on'], x: 245, y: 655, w: 165, rot: 0, how: 'gentle', from: 'left' },
    { id: 'carnelians', src: 'carnelians', x: 525, y: 800, w: 125, rot: 12, how: 'drop' },
    { id: 'notebook', src: 'notebook', x: 340, y: 1010, w: 430, rot: -6, how: 'slide', from: 'bottom' },
    { id: 'map', src: 'map', x: 790, y: 1065, w: 440, rot: -3, how: 'slide', from: 'bottom' },
    { id: 'mug', src: 'mug', x: 1562, y: 812, w: 160, rot: 0, how: 'gentle', from: 'right' },
    { id: 'fox', src: 'fox', x: 1770, y: 1000, w: 300, rot: -7, how: 'slide', from: 'right' },
    { id: 'deer', src: 'deer', x: 150, y: 895, w: 95, rot: 20, how: 'drop' }
  ];
  var PHOTOS = ['01', '02', '03'].map(function (n) { return '../../play/media/2024-09-05-marlette/' + n + '.jpg'; });
  var els = {}, prints = [], busy = false;

  function px(u) { return u * T.clientWidth / W; }
  function place(el, p, w) {
    el.style.left = ((p.x - w / 2) / W * 100) + '%';
    el.style.top = ((p.y) / H * 100) + '%';
    el.style.width = (w / W * 100) + '%';
  }
  function img(src, cls) { var i = new Image(); i.src = 'a/' + src + '.webp'; i.alt = ''; i.decoding = 'async'; if (cls) i.className = cls; return i; }
  function wait(ms) { return new Promise(function (ok) { setTimeout(ok, calm ? 0 : ms); }); }
  function anim(el, frames, opt) {
    if (calm) { var last = frames[frames.length - 1]; Object.keys(last).forEach(function (k) { if (k !== 'offset' && k !== 'easing') el.style[k] = last[k]; }); return Promise.resolve(); }
    var a = el.animate(frames, Object.assign({ fill: 'forwards' }, opt));
    return a.finished.then(function () { a.commitStyles && a.commitStyles(); a.cancel(); });
  }
  // the resting transform: centred on its y, turned by rot
  function rest(p) { return 'translateY(-50%) rotate(' + p.rot + 'deg)'; }
  function offEdge(p) {
    var from = p.from || (p.x < W / 2 ? 'left' : 'right'), d = p.w + 260;
    return from === 'left' ? [-(p.x + d), 0] : from === 'right' ? [W - p.x + d, 0] : from === 'top' ? [0, -(p.y + d)] : [0, H - p.y + d];
  }

  function makeProp(p) {
    var el = document.createElement('div');
    el.className = 'prop ' + p.id + (Array.isArray(p.src) ? ' stack' : '');
    if (Array.isArray(p.src)) {
      el.appendChild(img(p.src[0], 'off')); el.appendChild(img(p.src[1], 'on'));
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
    if (p.how === 'drop') return anim(el, [
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

  // the hand reaches in from the right, takes the prop, and slides out with it
  function takeAway(el, p) {
    var paper = /contact|map|notebook|fox|print/.test(el.className);
    var hand = document.createElement('div'), hw = 380;
    hand.className = 'prop hand';
    hand.appendChild(img(paper ? 'hand-pinch' : 'hand-hold'));
    var fx = (p.x || 0) - 20;
    hand.style.left = (fx / W * 100) + '%';
    hand.style.top = (p.y / H * 100) + '%';
    hand.style.width = (hw / W * 100) + '%';
    L.appendChild(hand);
    var away = px(W - fx + 200), base = 'translateY(-50%)';
    hand.style.transform = 'translateX(' + away + 'px) ' + base;
    return anim(hand, [{ transform: 'translateX(' + away + 'px) ' + base }, { transform: base }], { duration: 1100, easing: 'cubic-bezier(.25,.7,.3,1)' })
      .then(function () { return wait(250); })
      .then(function () {
        var from = getComputedStyle(el).transform;
        return Promise.all([
          anim(hand, [{ transform: base }, { transform: 'translateX(' + away + 'px) ' + base }], { duration: 1150, easing: 'cubic-bezier(.5,0,.75,.4)' }),
          anim(el, [{ transform: from }, { transform: 'translateX(' + away + 'px) ' + from.replace('none', '') }], { duration: 1150, easing: 'cubic-bezier(.5,0,.75,.4)' })
        ]);
      })
      .then(function () { hand.remove(); el.remove(); });
  }

  // prints: your photos, pushed onto the table one by one
  function dropPrints() {
    var spots = [{ x: 720, y: 430, rot: -6 }, { x: 1010, y: 470, rot: 4 }, { x: 1290, y: 520, rot: -2 }];
    var chain = Promise.resolve();
    PHOTOS.forEach(function (src, i) {
      chain = chain.then(function () {
        var p = { id: 'print', x: spots[i].x, y: spots[i].y, w: 280, rot: spots[i].rot, how: 'slide', from: 'bottom' };
        var el = document.createElement('div'); el.className = 'prop print';
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
    var panel = els.panel; if (panel) panel.classList.remove('lit');
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
    return chain.then(function () { return wait(400); }).then(function () { if (panel) panel.classList.add('lit'); });
  }

  // Marley drops by over the top edge: leaning in by day, resting or asleep at night
  var marleyOut = false;
  function marley() {
    if (marleyOut) return Promise.resolve();
    marleyOut = true;
    var isNight = T.classList.contains('night');
    // (the resting pose comes back once its clean cut-out is in)
    var pose = isNight ? { src: 'marley-sleep', w: 560, ratio: 357 / 640, show: 1 }
      : { src: 'marley-look', w: 390, ratio: 635 / 640, show: .62 };
    var el = document.createElement('div'); el.className = 'prop marley';
    el.appendChild(img(pose.src));
    var h = pose.w * pose.ratio, x = 1330;
    el.style.left = ((x - pose.w / 2) / W * 100) + '%';
    el.style.top = ((-h * (1 - pose.show)) / H * 100) + '%';
    el.style.width = (pose.w / W * 100) + '%';
    L.appendChild(el);
    var up = 'translateY(' + px(-h * pose.show - 40) + 'px)';
    return anim(el, [{ transform: up }, { transform: 'none' }], { duration: 1600, easing: 'cubic-bezier(.2,.7,.3,1)' })
      .then(function () { // a sniff: a small lean in and back
        return anim(el, [{ transform: 'none' }, { transform: 'translateY(' + px(10) + 'px) rotate(-1deg)', offset: .3 }, { transform: 'translateY(' + px(4) + 'px)', offset: .55 }, { transform: 'none' }], { duration: 1800, delay: 2200, easing: 'ease-in-out' });
      })
      .then(function () { return wait(isNight ? 9000 : 6000); })
      .then(function () { return anim(el, [{ transform: 'none' }, { transform: up }], { duration: 1500, easing: 'cubic-bezier(.5,0,.7,.4)' }); })
      .then(function () { el.remove(); marleyOut = false; });
  }

  function setLamps() { if (els.jar) els.jar.classList.toggle('lit', T.classList.contains('night')); }

  function start() {
    L.innerHTML = ''; els = {}; prints = [];
    var chain = Promise.resolve();
    PROPS.forEach(function (p, i) {
      if (p.fixed || calm) { makeProp(p); return; }
      chain = chain.then(function () { arrive(p); return wait(i < 3 ? 420 : 340); });
    });
    return chain.then(function () { return wait(1600); }).then(setLamps);
  }

  var timer = null;
  function visits() { clearTimeout(timer); timer = setTimeout(function () { marley().then(visits); }, (calm ? 0 : 1) * (28000 + Math.random() * 22000)); }

  document.querySelector('.controls').addEventListener('click', function (e) {
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
    else if (act === 'take') {
      var pool = prints.filter(function (pr) { return pr.el.isConnected; }).map(function (pr) { return { el: pr.el, p: pr.p }; })
        .concat(PROPS.filter(function (p) { return !p.fixed && els[p.id] && els[p.id].isConnected; }).map(function (p) { return { el: els[p.id], p: p }; }));
      var pick = pool[Math.floor(Math.random() * pool.length)];
      job = pick ? takeAway(pick.el, pick.p) : Promise.resolve();
    }
    (job || Promise.resolve()).then(function () { busy = false; });
  });
  if (night) document.querySelector('[data-act=night]').textContent = 'Day';

  start().then(function () { return wait(1500); }).then(marley).then(visits);
})();
