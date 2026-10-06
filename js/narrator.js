/* THE NARRATOR: a little brass robot in each Listen bar (section.listen with an <audio>) that tells the episode.
   Its torso and hands are short video loops (assets/narrator/talk-*.mp4: green screen keyed onto the bar's colour),
   its head three cut-out layers on top: the head with the mouth open inside, the jaw, and the shut eyelids.
   - Playing: it rises so its head stands up out of the bar, the hands gesture (the loops in a shuffled order,
     each ending in the same rest pose so they cut together), and the jaw opens with the loudness of the voice,
     measured from the episode itself (Web Audio). The head nods a little with it.
   - Not talking (before play, paused, done): the gesture finishes, then the fingers tap on the desk
     (assets/narrator/idle.mp4), from when the bar comes into view.
   - Now and then it blinks. With reduced motion it stays still, and only the mouth moves. */
(function () {
  'use strict';
  var A = '/assets/narrator/', CLIPS = ['talk-1.mp4', 'talk-2.mp4', 'talk-3.mp4'], DROP = 0.0747;   // the jaw's drop, as a share of the head's height
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ctx = null;

  function build(bar) {
    var audio = bar.querySelector('audio');
    if (!audio || bar.querySelector('.nb')) return;
    bar.classList.add('has-nb');
    var nb = document.createElement('div'); nb.className = 'nb'; nb.setAttribute('aria-hidden', 'true');
    nb.innerHTML = '<div class="nb-rise"><div class="nb-head"><img class="nb-base" src="' + A + 'head-base.webp" alt=""><img class="nb-jaw" src="' + A + 'head-jaw.webp" alt="">' +
      '<img class="nb-lids" src="' + A + 'head-lids.webp" alt=""></div>' +
      '<video class="nb-body" muted playsinline preload="none" poster="' + A + 'rest.jpg"></video></div>';
    bar.insertBefore(nb, bar.firstChild);
    var body = nb.querySelector('.nb-body'), head = nb.querySelector('.nb-head'), jaw = nb.querySelector('.nb-jaw');
    var talking = false, order = [], an = null, buf = null, level = 0, raf = 0;

    // the hands: a shuffled round of the loops, a new round when it's used up; never the same one twice running
    function next() {
      if (!order.length) { order = CLIPS.slice().sort(function () { return Math.random() - 0.5; }); if (order[0] === body._last) order.push(order.shift()); }
      body._last = order.shift(); body.src = A + body._last; body.play().catch(function () {});
    }
    function idle() { body._last = null; body.src = A + 'idle.mp4'; body.play().catch(function () {}); }
    // every loop ends in the same rest pose, so the next one (a gesture while talking, else tapping) cuts in cleanly
    body.addEventListener('ended', function () { if (still) return; if (talking) next(); else idle(); });
    if (!still && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); if (body.paused && !talking) idle(); } });
      io.observe(nb);
    }

    // the mouth: the voice's loudness, smoothed, opens the jaw
    function listen() {
      if (an || !(window.AudioContext || window.webkitAudioContext)) return;
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        var src = ctx.createMediaElementSource(audio);
        an = ctx.createAnalyser(); an.fftSize = 1024; buf = new Uint8Array(an.fftSize);
        src.connect(an); an.connect(ctx.destination);
      } catch (e) { an = null; }
    }
    function tick() {
      var v = 0;
      if (an) { an.getByteTimeDomainData(buf); var s = 0; for (var i = 0; i < buf.length; i += 4) { var d = (buf[i] - 128) / 128; s += d * d; } v = Math.sqrt(s / (buf.length / 4)); v = Math.min(1, Math.max(0, (v - 0.015) / 0.12)); }
      else if (talking) v = 0.35 + 0.35 * Math.sin(performance.now() / 90) * Math.sin(performance.now() / 233);   // no Web Audio: a gentle chatter
      level += (v - level) * (v > level ? 0.6 : 0.25);                       // opens quickly, closes a little slower
      jaw.style.transform = 'translateY(' + (level * DROP * 100).toFixed(2) + '%)';
      if (!still) head.style.transform = 'rotate(' + (Math.sin(performance.now() / 700) * 1.5 * level).toFixed(2) + 'deg) translateY(' + (-level * 2).toFixed(2) + '%)';
      if (talking || level > 0.01) raf = requestAnimationFrame(tick); else { raf = 0; jaw.style.transform = ''; head.style.transform = ''; }
    }
    audio.addEventListener('play', function () {
      listen(); if (ctx && ctx.state === 'suspended') ctx.resume();
      talking = true; nb.classList.add('on');
      if (!still && (body.paused || body.ended || !body._last)) next();   // from tapping or rest, straight into a gesture
      if (!raf) raf = requestAnimationFrame(tick);
    });
    ['pause', 'ended'].forEach(function (t) { audio.addEventListener(t, function () { talking = false; }); });

    // a blink every few seconds
    (function blink() {
      setTimeout(function () {
        if (!nb.isConnected) return;
        nb.classList.add('blink'); setTimeout(function () { nb.classList.remove('blink'); }, 140);
        if (Math.random() < 0.2) setTimeout(function () { nb.classList.add('blink'); setTimeout(function () { nb.classList.remove('blink'); }, 120); }, 280);   // sometimes twice
        blink();
      }, 2500 + Math.random() * 4500);
    })();
  }

  function scan(root) { (root.querySelectorAll ? root : document).querySelectorAll('section.listen').forEach(build); }
  function start() {
    scan(document);
    // Notes opened on the homepage arrive later, in the story dialog
    new MutationObserver(function (ms) { ms.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) { if (n.matches && n.matches('section.listen')) build(n); else scan(n); } }); }); })
      .observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
