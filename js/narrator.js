/* THE NARRATOR, GlazyArray: a little brass robot in each Listen bar (section.listen with an <audio>) that tells the episode.
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
  var A = '/assets/narrator/', V = '?v=20', DROP = 0.0448;   // the chin plate's drop, as a share of the head layer's height (the side plates go half as far)
  var D = 193 / 24, IDLE = 0, GESTURES = [{ f: 1, r: 2 }, { f: 3, r: 4 }];   // the parts of narrator.mp4: forward and backwards copies
  // the hints, parts 5 to 7, with what the head does when (seconds into the part): look toward Play, wink, the bulb glows
  var HINTS = [
    { p: 5, cues: [[1.2, 5.6, 'look'], [2.3, 3.1, 'wink']] },                          // psst, over there
    { p: 6, cues: [[2.0, 6.3, 'look'], [2.8, 4.4, 'glow'], [5.0, 6.0, 'glow']] },      // boop, boop, and a thumbs-up
    { p: 7, cues: [[3.2, 5.8, 'look'], [3.8, 5.2, 'glow']] }];                          // thumbs twiddled, a little wave
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // HER LOOKS (assets/narrator/looks.json): new hair and accessories over the same face, jaw, eyes and neck, so only
  // the head's base layer changes (made in the Workshop's Style Array). She wears the holiday look that's coming up
  // next (a look with "from"/"to", month-day: it's hers from the day after the holiday before it ends, through its own
  // last day), unless the Note has its own look (data-look on its Listen bar). A click on her head moves her on to the
  // next look in her wardrobe (the Note's, the holiday's, her curls, the hair styles, then the other holidays),
  // cross-faded with a little shake: just for fun, on that bar, for as long as the page is open (Christian, Oct 6,
  // 2026: the Notes' own looks are the theme, so a click is never kept or carried to other pages). ?look-name or
  // ?look=name in a link previews any look on a page whose Note has none of its own; look-curls her own. "bulb": false for a look whose hat or bow
  // covers the antenna (its glow stays off).
  var LOOKRX = /(^|[?&+,;\s])look[-=]([a-z0-9-]+)/i;
  function urlLook() { var m = LOOKRX.exec(decodeURIComponent(location.search)); return m ? m[2].toLowerCase() : null; }
  var WARDROBE = [], ALL = {}, CATS = {}, CURLS = A + 'head-base.webp' + V;
  var looks = fetch(A + 'looks.json' + V, { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : { looks: [] }; }).catch(function () { return { looks: [] }; }).then(function (j) {
    var list = (j && j.looks) || [], d = new Date();
    ALL = { curls: { name: 'curls' } }; list.forEach(function (l) { ALL[l.name] = l; }); CATS = (j && j.categories) || {};
    var hol = list.filter(function (l) { return l.to; }).sort(function (a, b) { return a.to < b.to ? -1 : 1; });
    var mmdd = ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    var up = hol.filter(function (l) { return l.to >= mmdd; })[0] || hol[0];   // after the year's last holiday, the first again
    var rest = hol.slice(hol.indexOf(up) + 1).concat(hol.slice(0, hol.indexOf(up)));   // the other holidays, in the order they come
    WARDROBE = (up ? [up] : []).concat([{ name: 'curls' }], list.filter(function (l) { return l.rotate; }), rest);
    var want = urlLook();
    try { sessionStorage.removeItem('cg-look'); } catch (e) {}   // a look kept from a click before Oct 6, 2026: let it go
    var pick = want && ALL[want];
    return pick || WARDROBE[0] || { name: 'curls' };
  });
  function src(l) { return l && l.file ? A + 'looks/' + l.file + V + (l.v ? '.' + l.v : '') : CURLS; }   // v: a look replaced in the Studio
  function put(nb, l) {
    nb.querySelector('.nb-base').src = src(l);
    nb.classList.toggle('nb-nobulb', !!l && l.bulb === false);
    if (l && l.file) nb.setAttribute('data-look', l.name); else nb.removeAttribute('data-look');
    nb._look = l ? l.name : 'curls';
  }
  // a Note's own look (data-look on its Listen bar, picked when it was drafted: a bike helmet for a ride) is what she
  // wears there, once it has been made, whatever the address says (Christian, Oct 6, 2026)
  // ...and failing that, the look of the first of its categories that has one (looks.json "categories": every case
  // study in her mortarboard). Which look shows: the Note's own, else its category's, else the holiday look.
  function own(nb) {
    var bar = nb.closest('section.listen'); if (!bar) return null;
    var n = bar.getAttribute('data-look'); if (n && ALL[n]) return ALL[n];
    var cats = (bar.getAttribute('data-cats') || '').split(' ');
    for (var i = 0; i < cats.length; i++) if (CATS[cats[i]] && ALL[CATS[cats[i]]]) return ALL[CATS[cats[i]]];
    return null;
  }
  function wear(nb) { looks.then(function (l) { put(nb, own(nb) || l); }); }   // a Note's own look always wins
  // a click on her head: the next look in her wardrobe loads, then fades in over the old one while her head gives a
  // little shake (that bar only; nothing is kept)
  function restyle(nb) {
    if (nb._busy || WARDROBE.length < 2) return;
    var mine = own(nb), list = mine && WARDROBE.indexOf(mine) < 0 ? [mine].concat(WARDROBE) : WARDROBE;   // a Note's own look leads its round
    var at = list.map(function (l) { return l.name; }).indexOf(nb._look), l = list[(at + 1) % list.length];
    var img = new Image();
    img.onload = img.onerror = function () {
      [nb].forEach(function (n) {
        if (n._look === l.name) return;
        var base = n.querySelector('.nb-base'), old = base.cloneNode(); n._busy = true;
        old.className = 'nb-base nb-old'; base.parentNode.insertBefore(old, base.nextSibling);
        put(n, l);
        n.classList.remove('nb-swap'); void n.offsetWidth; if (!still) n.classList.add('nb-swap');
        requestAnimationFrame(function () { old.style.opacity = '0'; });
        setTimeout(function () { old.remove(); n.classList.remove('nb-swap'); n._busy = false; }, still ? 0 : 520);
      });
    };
    img.src = src(l);
  }
  var ctx = null;

  function build(bar) {
    var audio = bar.querySelector('audio');
    if (!audio || bar.querySelector('.nb')) return;
    bar.classList.add('has-nb');
    var nb = document.createElement('div'); nb.className = 'nb'; nb.setAttribute('aria-hidden', 'true');
    nb.innerHTML = '<div class="nb-rise"><div class="nb-head"><img class="nb-base" src="' + A + 'head-base.webp' + V + '" alt=""><span class="nb-eyes"><img class="nb-iris" src="' + A + 'head-iris.webp' + V + '" alt=""></span><img class="nb-shine" src="' + A + 'head-shine.webp' + V + '" alt=""><img class="nb-jaw-s" src="' + A + 'head-jaw-sides.webp' + V + '" alt=""><img class="nb-jaw" src="' + A + 'head-jaw.webp' + V + '" alt="">' +
      '<img class="nb-lids" src="' + A + 'head-lids.webp' + V + '" alt=""><i class="nb-bulb"></i><b class="nb-hit" title="GlazyArray\u2019s Style Array: click for her next look"></b></div>' +
      '<video class="nb-body" muted playsinline preload="none" poster="' + A + 'rest.jpg' + V + '"></video></div>';
    bar.insertBefore(nb, bar.firstChild);
    // her nameplate, standing on the desk to her right
    if (!bar.querySelector('.nb-plate')) { var pl = document.createElement('div'); pl.className = 'nb-plate'; pl.innerHTML = '<b>GlazyArray</b><small>Narrator \u00b7 Field Notes</small>'; bar.appendChild(pl); }
    var lbl = bar.querySelector('.listen-label');   // her name, under the Listen label: "Narrated by GlazyArray"
    if (lbl && !bar.querySelector('.nb-by')) { var by = document.createElement('span'); by.className = 'nb-by'; by.textContent = 'Narrated by GlazyArray'; lbl.parentNode.appendChild(by); }
    wear(nb);
    nb.querySelector('.nb-hit').addEventListener('click', function () { restyle(nb); });
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
