/* THE NARRATOR: a little brass robot in each Listen bar (section.listen with an <audio>) that tells the episode.
   Its torso and hands are one video (assets/narrator/narrator.mp4, green screen keyed onto the bar's colour) in five
   8-second parts, every one starting and ending in the same rest pose: the fingers tapping, a storyteller's gesture
   and the same played backwards, drawing a shape in the air and that backwards. The robot moves only by jumping
   within this one file (switching files blanked the frame for a moment). Her head is cut-out layers on top:
   the head with the mouth open inside, the jaw (her chin plate, and the side plates that swing half as far), and
   the shut eyelids.
   - It sits at its desk from the start, its head standing up out of the bar. Playing: the jaw opens with the loudness of the voice (measured
     from the episode with Web Audio) and the head nods a little. The hands make a gesture, all of it, or part of it
     and back again (it jumps to the same frame in the backwards copy), so it never looks like the same 8 seconds.
   - When the voice stops it heads for the nearer rest pose, a little quicker, then the fingers tap on the desk.
   - Until someone first presses play, it drops cheeky hints between rounds of tapping (three more parts of the
     file): "psst, over there" pointing at the Play button, miming "boop, boop, press it" with a thumbs-up, and
     twiddling its thumbs with a little wave. The head turns toward the button, winks, and the antenna bulb glows
     in time with them.
   - Now and then it blinks. With reduced motion it stays still, and only the mouth moves. */
(function () {
  'use strict';
  var A = '/assets/narrator/', V = '?v=6', DROP = 0.054;   // the chin plate's drop, as a share of the head's height (the side plates go half as far)
  var D = 193 / 24, IDLE = 0, GESTURES = [{ f: 1, r: 2 }, { f: 3, r: 4 }];   // the parts of narrator.mp4: forward and backwards copies
  // the hints, parts 5 to 7, with what the head does when (seconds into the part): look toward Play, wink, the bulb glows
  var HINTS = [
    { p: 5, cues: [[1.2, 5.6, 'look'], [2.3, 3.1, 'wink']] },                          // psst, over there
    { p: 6, cues: [[2.0, 6.3, 'look'], [2.8, 4.4, 'glow'], [5.0, 6.0, 'glow']] },      // boop, boop, and a thumbs-up
    { p: 7, cues: [[3.2, 5.8, 'look'], [3.8, 5.2, 'glow']] }];                          // thumbs twiddled, a little wave
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ctx = null;

  function build(bar) {
    var audio = bar.querySelector('audio');
    if (!audio || bar.querySelector('.nb')) return;
    bar.classList.add('has-nb');
    var nb = document.createElement('div'); nb.className = 'nb'; nb.setAttribute('aria-hidden', 'true');
    nb.innerHTML = '<div class="nb-rise"><div class="nb-head"><img class="nb-base" src="' + A + 'head-base.webp' + V + '" alt=""><img class="nb-jaw-s" src="' + A + 'head-jaw-sides.webp' + V + '" alt=""><img class="nb-jaw" src="' + A + 'head-jaw.webp' + V + '" alt="">' +
      '<img class="nb-lids" src="' + A + 'head-lids.webp' + V + '" alt=""><i class="nb-bulb"></i></div>' +
      '<video class="nb-body" muted playsinline preload="none" poster="' + A + 'rest.jpg' + V + '"></video></div>';
    bar.insertBefore(nb, bar.firstChild);
    var body = nb.querySelector('.nb-body'), head = nb.querySelector('.nb-head'), jaw = nb.querySelector('.nb-jaw'), jawS = nb.querySelector('.nb-jaw-s');
    var talking = false, an = null, buf = null, level = 0, raf = 0, plan = null, lastG = -1;
    var played = false, taps = 0, wait = 1, lastH = -1, hint = null;   // hints only until the first play, after a round or two of tapping
    body.src = A + 'narrator.mp4' + V;

    // the hands: a plan is a stretch of the video to play to, and what to do when it gets there
    function go(at, end, then, rate) { body.playbackRate = rate || 1; if (Math.abs(body.currentTime - at) > 0.06) body.currentTime = at; plan = { end: end, then: then }; body.play().catch(function () {}); drive(); }
    function idle() {
      if (talking) return gesture();
      if (!played && taps >= wait) {
        taps = 0; wait = 1 + Math.floor(Math.random() * 2);
        var k = (lastH + 1 + Math.floor(Math.random() * (HINTS.length - 1))) % HINTS.length; lastH = k; hint = HINTS[k];
        return go(hint.p * D, hint.p * D + D, function () { endHint(); idle(); });
      }
      taps++; go(IDLE * D, IDLE * D + D, idle);
    }
    function endHint() { hint = null; nb.classList.remove('look', 'wink', 'glow'); }
    function cues() {   // the head's part in a hint, by the playhead
      if (!hint) return;
      var t = body.currentTime - hint.p * D, on = {};
      hint.cues.forEach(function (c) { if (t >= c[0] && t < c[1]) on[c[2]] = true; });
      ['look', 'wink', 'glow'].forEach(function (c) { nb.classList.toggle(c, !!on[c]); });
    }
    body.addEventListener('ended', function () { if (plan) { var t = plan.then; plan = null; t(); } });   // the last part runs to the end of the file
    function gesture() {
      var k = lastG < 0 ? Math.floor(Math.random() * GESTURES.length) : (lastG + 1) % GESTURES.length, g = GESTURES[k], r = Math.random(); lastG = k;   // never the same gesture twice running
      var after = function () { talking ? gesture() : idle(); };
      if (r < 0.45) go(g.f * D, g.f * D + D, after);                                       // the whole gesture
      else if (r < 0.85) {                                                                  // part of it, and back
        var p = D * (0.3 + Math.random() * 0.45);
        go(g.f * D, g.f * D + p, function () { go(g.r * D + (D - p), g.r * D + D, after); });
      } else go(g.r * D, g.r * D + D, after);                                               // the whole of it, backwards
    }
    // the voice stopped: to the nearer rest pose, the end of this part or (by the backwards copy) its start
    function settle() {
      var t = body.currentTime, part = Math.floor((t + 0.02) / D), local = Math.max(0, t - part * D);   // a hair of margin: a jump lands right on a part's first frame
      if (part === IDLE || part >= HINTS[0].p || !plan) return;
      var g = GESTURES.filter(function (x) { return x.f === part || x.r === part; })[0]; if (!g) return;
      var other = part === g.f ? g.r : g.f;
      if (local < D / 2) go(other * D + (D - local), other * D + D, idle, 1.35); else go(part * D + local, part * D + D, idle, 1.35);
    }
    var driving = false;
    function drive() {   // checks the playhead every frame: rAF, so it doesn't overrun into the next part
      if (driving) return; driving = true;
      (function step() {
        if (!nb.isConnected) { driving = false; return; }
        cues();
        if (plan && body.currentTime >= plan.end - 0.05) { var t = plan.then; plan = null; t(); }
        if (!body.paused) requestAnimationFrame(step); else driving = false;
      })();
    }
    if (!still && 'IntersectionObserver' in window) {   // starts tapping when it comes into view
      var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); body.preload = 'auto'; if (!talking && !plan) idle(); } });
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
      jawS.style.transform = 'translateY(' + (level * DROP * 55).toFixed(2) + '%)';
      if (!still) head.style.transform = 'rotate(' + (Math.sin(performance.now() / 700) * 1.5 * level).toFixed(2) + 'deg) translateY(' + (-level * 2).toFixed(2) + '%)';
      if (talking || level > 0.01) raf = requestAnimationFrame(tick); else { raf = 0; jaw.style.transform = ''; jawS.style.transform = ''; head.style.transform = ''; }
    }
    audio.addEventListener('play', function () {
      listen(); if (ctx && ctx.state === 'suspended') ctx.resume();
      talking = true; nb.classList.add('on');
      played = true;
      if (!still) { var part = Math.floor((body.currentTime + 0.02) / D); if (hint) endHint(); if (!plan || part === IDLE || part >= HINTS[0].p) gesture(); }   // from tapping, a hint or rest, straight into a gesture
      if (!raf) raf = requestAnimationFrame(tick);
    });
    ['pause', 'ended'].forEach(function (t) { audio.addEventListener(t, function () { talking = false; if (!still) settle(); }); });

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
