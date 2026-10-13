/* A.L.T.A.'s PLAYER: a Listen bar (section.listen.alta, data-narrator="alta") where she tells the episode from her
   tank (css/alta.css; her parts in assets/alta/parts, made from Christian's renders: assets/alta/KIT.md).
   - Her mouth follows the voice: Web Audio measures how loud it is and where its sound sits (bright like "ee" or
     round like "oo"), and picks the nearest of her own mouth shapes; between words her lips close.
   - She blinks every few seconds, her irises glance, her tail sculls under the ledge, and while she talks she opens
     her palms now and then. Her eyes bloom cyan-green as she starts, and settle back when she stops.
   - Without an episode yet she still waits in her tank, and says her introduction is on its way.
   - On a Note with a palette, her crown's filigree and the botanicals in her hair wear its two colours (no hats: her
     masks are head-flair-a/b, pearl versions of those parts, dyed with multiply).
   - Now and then, while she isn't talking, she dives: sinks below the ledge, hovers, and rises the same way.
   - With reduced motion she holds still: no tail, glances, blinks or gestures; only her mouth moves.
   Built for each such bar on the page, and for any that arrive later (a Note opened in the homepage's story window,
   her Workshop window). GlazyArray's player (js/narrator.js) leaves these bars to her. */
(function () {
  'use strict';
  var P = '/assets/alta/parts/', V = '?v=11';
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var GESTURES = ['palms', 'play'];   // her gesture clips in parts/ (KIT.md Rounds 2 and 7): open palms; "press play" (the lotus bloom came out
  // Oct 12: her forearms pass through the ledge)
  // gestures whose hand reaches over the front of the ledge, below it: a taller layer, always drawn with its mask (only her
  // hand shows below the ledge, the tank and her tail carry on behind it); "press play" only while she waits
  var TALL = { play: 1 }, IDLE_ONLY = { play: 1 };
  var SHAPES = ['smile', 'neutral', 'ah', 'oh', 'oo', 'ee', 'laugh'];
  var IC = {
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>', pause: '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zm6 0h4v14h-4z"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M12 5V2L7 6l5 4V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z"/></svg>', fwd: '<svg viewBox="0 0 24 24"><path d="M12 5V2l5 4-5 4V7a6 6 0 1 0 6 6h2a8 8 0 1 1-8-8z"/></svg>' };
  var ctx = null;
  function clock(s) { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }

  // A video whose bottom half is its own mask (white is her, black is the hall behind her), drawn into a canvas with
  // that mask as its alpha, so a backdrop shows through where the hall was. The video plays, hidden; the canvas sits
  // right after it and shows each frame. Null where WebGL isn't available (then she keeps the hall).
  function alphaCanvas(v) {
    var c = document.createElement('canvas'), gl = c.getContext('webgl', { premultipliedAlpha: false, alpha: true });
    if (!gl) return null;
    var sh = function (t, src) { var o = gl.createShader(t); gl.shaderSource(o, src); gl.compileShader(o); return o; }, pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 p;varying vec2 u;void main(){u=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}'));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, 'precision mediump float;varying vec2 u;uniform sampler2D t;void main(){vec3 c=texture2D(t,vec2(u.x,u.y*.5)).rgb;float a=texture2D(t,vec2(u.x,.5+u.y*.5)).r;gl_FragColor=vec4(c,a);}'));
    gl.linkProgram(pr); gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(function (k) { gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE); });
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    function draw() {
      if (v.readyState < 2 || !v.videoWidth) return;
      if (c.width !== v.videoWidth || c.height !== v.videoHeight / 2) { c.width = v.videoWidth; c.height = v.videoHeight / 2; gl.viewport(0, 0, c.width, c.height); }
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, v); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    var rvfc = 'requestVideoFrameCallback' in v;
    function loop() { draw(); if (!v.paused && !v.ended) { if (rvfc) v.requestVideoFrameCallback(loop); else requestAnimationFrame(loop); } }
    ['play', 'seeked', 'loadeddata'].forEach(function (e) { v.addEventListener(e, loop); });
    c.className = v.className.split(' ')[0] + '-c'; c.setAttribute('aria-hidden', 'true');
    v.classList.add('al-src'); v.parentNode.insertBefore(c, v.nextSibling);
    return c;
  }

  function build(bar) {
    // data-manual (the Parts Catalog's cards): nothing on a timer, no blinks, glances, gestures or dives of her own;
    // she does only what she's asked
    var auto = !still && !bar.hasAttribute('data-manual');
    if (bar.querySelector('.al-stage')) return;
    var audio = bar.querySelector('audio');
    var st = document.createElement('div'); st.className = 'al-stage'; st.setAttribute('aria-hidden', 'true');
    st.innerHTML = '<video class="al-tail" muted loop playsinline preload="none"></video>' +
      '<video class="al-palms" muted playsinline preload="none"></video>' +
      '<video class="al-tall" muted playsinline preload="none"></video>' +
      '<div class="al-head"><img class="al-base" src="' + P + 'head-base.webp' + V + '" alt="">' +
      ['a', 'b'].map(function (k) { return '<img class="al-pearl" src="' + P + 'head-flair-' + k + '.webp' + V + '" alt=""><i class="al-tint al-tint-' + k + '"></i>'; }).join('') +
      '<div class="al-eyes" style="position:absolute"><img src="' + P + 'head-iris.webp' + V + '" alt=""><i class="al-glow"></i></div>' +
      '<img class="al-lids" src="' + P + 'head-lids.webp' + V + '" alt=""><div class="al-mouth" style="position:absolute">' +
      SHAPES.map(function (k) { return '<img data-m="' + k + '" src="' + P + 'mouth-' + k + '.webp' + V + '" alt=""' + (k === 'smile' ? ' class="on"' : '') + '>'; }).join('') + '</div>' +
      '<img class="al-rest" src="' + P + 'head-rest.webp' + V + '" alt=""></div>';   // her resting face: smiling eyes and a warm smile
    bar.insertBefore(st, bar.children[1] || null);
    // a backdrop behind her tank (data-bd: the scene for this Note, as the site picks it; assets/alta/KIT.md Round 8):
    // her still without the hall (rest-cut), and her gesture, dive and rise with their masks (*-cut.mp4), over the scene
    // A scene of her own (assets/alta/backdrops) is made for her tank; one borrowed from the Note (assets/narrator/
    // backdrops, the one GlazyArray and Robot Marley show) is framed for a wide strip, so it fills just the strip above
    // her ledge, softly blurred, its middle showing (Christian, Oct 13)
    var bd = bar.getAttribute('data-bd'), CUT = {};
    var lent = !!bd && /^\/assets\/narrator\/backdrops\/[\w.-]+\.(webp|jpg|png)(\?[\w.=-]*)?$/.test(bd);
    if (bd && (lent || /^\/assets\/alta\/backdrops\/[\w.-]+\.(webp|jpg|png)(\?[\w.=-]*)?$/.test(bd)) && !!document.createElement('canvas').getContext('webgl')) {
      st.classList.add('al-has-bd'); st.style.setProperty('--al-bd', 'url(' + bd + ')');
      var rc = document.createElement('img'); rc.className = 'al-restcut'; rc.alt = '';
      rc.onload = function () { st.classList.add('al-rc-in'); };   // her still is in: its small stand-in goes
      rc.src = P + 'rest-cut.webp' + V; st.insertBefore(rc, st.firstChild);
      if (lent) { st.classList.add('al-bd-lent'); var bl = document.createElement('i'); bl.className = 'al-bdl'; bl.innerHTML = '<i></i>'; st.insertBefore(bl, st.firstChild); }   // under everything, her still included
      CUT = { palms: 1, dive: 1, rise: 1 };
    }
    // the Note's two colours (data-palette, from its hero): her crown's filigree takes the first, her hair's botanicals the second
    var pal = (bar.getAttribute('data-palette') || '').split(' ').filter(function (c) { return /^#[0-9a-f]{6}$/i.test(c); });
    if (pal.length) { bar.style.setProperty('--al1', pal[0]); bar.style.setProperty('--al2', pal[1] || pal[0]); bar.classList.add('has-pal'); }
    var lbl = bar.querySelector('.listen-label');
    if (lbl && !bar.querySelector('.al-by')) { var by = document.createElement('span'); by.className = 'al-by'; by.textContent = 'Narrated by A.L.T.A.'; lbl.parentNode.appendChild(by); }
    var cutSrc = function (k) { return P + k + (CUT[k] || (CUT.palms && GESTURES.indexOf(k) >= 0) ? '-cut' : '') + '.mp4' + V; };
    var tail = st.querySelector('.al-tail'), palms = st.querySelector('.al-palms'), tallV = st.querySelector('.al-tall'), head = st.querySelector('.al-head'), glow = st.querySelector('.al-glow'), eyes = st.querySelector('.al-eyes');
    var M = {}; [].forEach.call(st.querySelectorAll('.al-mouth img'), function (i) { M[i.getAttribute('data-m')] = i; });
    var cur = 'smile';
    function say(k) { if (k === cur || !M[k]) return; M[cur].classList.remove('on'); M[k].classList.add('on'); cur = k; }

    // her tail, while she's on screen
    var onScreen = !('IntersectionObserver' in window);
    if (!still) {
      tail.src = P + 'tail.mp4' + V;
      var vis = function (on) {
        var was = onScreen; onScreen = on;
        if (on) { tail.preload = 'auto'; var p = tail.play(); if (p && p.catch) p.catch(function () {}); tail.classList.add('on'); if (!was && isTalking && !isTalking()) gestures(true); } else tail.pause();
      };
      if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { vis(es[0].isIntersecting); }).observe(st); else vis(true);
    }
    // blinks and glances
    if (auto) (function blink() {
      setTimeout(function () {
        if (!bar.isConnected) return;
        bar.classList.add('blink'); setTimeout(function () { bar.classList.remove('blink'); }, 130);
        if (Math.random() < 0.2) setTimeout(function () { bar.classList.add('blink'); setTimeout(function () { bar.classList.remove('blink'); }, 120); }, 300);
        blink();
      }, 2600 + Math.random() * 3800);
    })();
    if (auto) (function glance() {
      if (!bar.isConnected) return;
      var away = Math.random() < 0.45;
      eyes.style.setProperty('--gx', away ? ((Math.random() - .5) * 7).toFixed(1) + '%' : '0%');
      eyes.style.setProperty('--gy', away ? ((Math.random() - .4) * 4).toFixed(1) + '%' : '0%');
      setTimeout(glance, away ? 900 + Math.random() * 900 : 2200 + Math.random() * 3200);
    })();

    // her gestures, laid over her torso: one now and then while she talks, and now and then while she waits at the
    // ledge too. Each fades in, plays once and fades back to her rest pose. GESTURES are the clips in parts/.
    var gT = 0, gestKey = '';
    if (CUT.palms) alphaCanvas(palms);
    var tallOk = !!alphaCanvas(tallV), tallKey = '';
    if (!still) [palms, tallV].forEach(function (v) { v.addEventListener('timeupdate', function () { if (v.duration && v.currentTime > v.duration - 0.6) v.classList.remove('on'); }); });
    var gestOn = function () { return palms.classList.contains('on') || tallV.classList.contains('on'); };
    function gesture(want) {
      if (still || gestOn()) return;
      var can = GESTURES.filter(function (g) { return (!TALL[g] || tallOk) && (!IDLE_ONLY[g] || !isTalking()); });
      var pick = can.filter(function (g) { return g !== gestKey; });   // never the same one twice running
      var k = can.indexOf(want) >= 0 ? want : (pick.length ? pick : can)[Math.floor(Math.random() * (pick.length || can.length))];
      if (!k) return;
      var v = TALL[k] ? tallV : palms;
      if (TALL[k]) { if (k !== tallKey) { tallKey = k; v.src = P + k + (CUT.palms ? '-cut' : '') + '.mp4' + V; } }
      else if (k !== gestKey) v.src = cutSrc(k);
      gestKey = k;
      v.preload = 'auto'; v.currentTime = 0;
      var p = v.play();
      var on = function () { v.classList.add('on'); };
      if (p && p.then) p.then(on, function () {}); else on();
    }
    // Waiting, her first gesture comes soon (4 to 8 s after she comes on screen or stops talking), so people see one
    // before they scroll on, then one every 14 to 22 s; her dives wait longer (plan, below)
    function gestures(soon) {
      clearTimeout(gT); if (!auto) return;
      var t = isTalking();
      gT = setTimeout(function () {
        if (!bar.isConnected) return;
        if (isTalking() || (dv.state === 'up' && onScreen && !document.hidden)) gesture();
        gestures();
      }, t ? 12000 + Math.random() * 10000 : soon ? 4000 + Math.random() * 4000 : 14000 + Math.random() * 8000);
    }

    // the idle dive: now and then, while she isn't talking, she lets go of the ledge and sinks below it, does one thing
    // underwater, and rises the way she went down (rise.mp4 is dive.mp4 backwards). Underwater she hovers near the glass,
    // glides a lap of the tank, or meditates and glows (glow.mp4: it comes up, holds, and fades back down); each starts and
    // ends on the dive's last frame. Her own video head shows meanwhile; her layered head fades out as she goes and back
    // in once she's up. Play mid-dive brings her straight back up: a glow fades down first, a lap cross-fades.
    var dv = { state: 'up', t: 0, v: null }, ready = false, GLOW_IN = 10;
    var V3 = ['dive', 'hover', 'glide', 'glow', 'rise'].map(function (k) { var v = document.createElement('video'); v.className = 'al-dive'; v.muted = true; v.playsInline = true; v.preload = 'none'; v.setAttribute('playsinline', ''); if (k === 'hover') v.loop = true; v.dataset.k = k; st.appendChild(v); return v; });
    var vDive = V3[0], vHover = V3[1], vGlide = V3[2], vGlow = V3[3], vRise = V3[4];
    function load() { if (ready) return; ready = true; V3.forEach(function (v) { v.src = cutSrc(v.dataset.k); v.preload = 'auto'; }); }
    function showV(v) { V3.forEach(function (x) { x.classList.toggle('on', x === v); }); st.classList.toggle('al-under', !!v); }
    if (CUT.dive) { alphaCanvas(vDive); alphaCanvas(vRise); }
    var onUp = null;   // Play pressed while she was under: the episode starts once she's back at the ledge
    function surfaced() { dv.state = 'up'; head.classList.remove('gone'); if (onUp) { var f = onUp; onUp = null; f(); } setTimeout(function () { if (dv.state === 'up') { V3.forEach(function (x) { x.classList.remove('on'); x.pause(); }); st.classList.remove('al-under'); } }, 300); plan(); }
    function play(v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
    function rise(rate) {
      if (dv.state === 'rise' || dv.state === 'up' || dv.state === 'calm') return;
      // mid-routine: she finishes it first, quicker, then rises. glow.mp4 is her glow coming up (GLOW_IN seconds), the
      // held glow, then the first part backwards: coming up, it mirrors into the fade; held, it hurries to the fade.
      // A lap speeds up home.
      if (dv.state === 'under' && (dv.v === vGlow || dv.v === vGlide) && dv.v.duration) {
        dv.state = 'calm'; dv.rate = rate || 1; clearTimeout(dv.t); dv.v.playbackRate = Math.max(1.5, dv.rate);
        if (dv.v === vGlow) {
          var t = vGlow.currentTime, out = vGlow.duration - GLOW_IN;
          if (t < GLOW_IN) vGlow.currentTime = vGlow.duration - t;
          else if (t < out) {
            vGlow.playbackRate = 3;
            var slow = function () { if (dv.state !== 'calm' || vGlow.currentTime >= out) { vGlow.removeEventListener('timeupdate', slow); if (dv.state === 'calm') vGlow.playbackRate = Math.max(1.5, dv.rate); } };
            vGlow.addEventListener('timeupdate', slow);
          }
        }
        return;
      }
      var from = dv.state === 'dive' && vDive.duration ? Math.max(0, vDive.duration - vDive.currentTime) : 0;
      dv.state = 'rise'; clearTimeout(dv.t); vRise.playbackRate = rate || 1;
      // from where she is: the dive's time, mirrored (the rise is the dive backwards); once it can seek there
      var start = function () {
        vRise.currentTime = from;
        var go = function () { vRise.removeEventListener('seeked', go); play(vRise); showV(vRise); V3.forEach(function (x) { if (x !== vRise) x.pause(); }); };
        if (from > 0) vRise.addEventListener('seeked', go); else go();
      };
      if (vRise.readyState >= 1) start(); else vRise.addEventListener('loadedmetadata', start, { once: true });
    }
    function dive() {
      if (still || dv.state !== 'up' || isTalking() || !bar.isConnected || gestOn()) return plan();
      load(); dv.state = 'dive'; vDive.currentTime = 0;
      var go = function () { vDive.removeEventListener('playing', go); if (dv.state !== 'dive') return; showV(vDive); head.classList.add('gone'); palms.classList.remove('on'); tallV.classList.remove('on'); };
      vDive.addEventListener('playing', go); var p = vDive.play(); if (p && p.catch) p.catch(function () { dv.state = 'up'; plan(); });
    }
    // underwater: a pause at the glass, a lap, or her meditation, then up
    var last = null;
    vDive.addEventListener('ended', function () {
      if (dv.state !== 'dive') return;
      var pick = [vHover, vGlide, vGlow].filter(function (v) { return v !== last; });
      var v = { hover: vHover, glide: vGlide, glow: vGlow }[want] || pick[Math.floor(Math.random() * pick.length)]; last = v; want = '';
      dv.state = 'under'; dv.v = v; v.currentTime = 0; v.playbackRate = 1; play(v); showV(v);
      if (v === vHover) dv.t = setTimeout(function () { rise(1); }, 5000 + Math.random() * 5000);
    });
    [vGlide, vGlow].forEach(function (v) { v.addEventListener('ended', function () { if (dv.v === v && (dv.state === 'under' || dv.state === 'calm')) { var r = dv.state === 'calm' ? dv.rate : 1; dv.state = 'under'; dv.v = null; rise(r); } }); });
    vRise.addEventListener('ended', function () { if (dv.state === 'rise') surfaced(); });
    function plan() { clearTimeout(dv.t); if (!auto || dv.state !== 'up') return; dv.t = setTimeout(dive, 30000 + Math.random() * 30000); }
    var isTalking = function () { return false; };
    bar.altaDive = dive;   // for testing, and for a page that wants to cue it
    // her eye moods (a soft cyan while she talks; a steady amber; a bright cyan-green bloom), each easing over .9 s
    var EYES = { talk: ['#2fe8c0', '.35', '1.1', ''], amber: ['#ffb020', '.85', '.92', 'brightness(1.3) saturate(1.35)'], cyan: ['#2fe8c0', '.85', '1.14', 'brightness(1.3) saturate(1.3)'] }, eyeNow = '';
    var iris = eyes.querySelector('img');
    function eyeMode(m) {
      if (m === eyeNow) return; eyeNow = m;
      if (!m) { glow.style.opacity = '0'; eyes.style.removeProperty('--dil'); iris.style.filter = ''; return; }
      var x = EYES[m] || EYES.talk;
      glow.style.backgroundColor = x[0]; glow.style.opacity = x[1]; eyes.style.setProperty('--dil', x[2]); iris.style.filter = x[3];
    }
    // a page that shows her parts (the Parts Catalog) can cue each one: a dive with a chosen routine underwater, a
    // gesture, an eye mood, a mouth shape, a blink
    var want = '';
    bar.alta = {
      dive: function (k) { want = k || ''; if (dv.state === 'up') { clearTimeout(dv.t); dive(); } },
      gesture: function (k) { if (dv.state === 'up') { palms.classList.remove('on'); tallV.classList.remove('on'); gesture(k); } },
      eyes: function (m) { eyeMode(m || ''); },
      say: function (k) { bar.classList.toggle('talking', k !== 'rest'); say(k === 'rest' ? 'smile' : k); },
      blink: function () { bar.classList.add('blink'); setTimeout(function () { bar.classList.remove('blink'); }, 130); },
      state: function () { return dv.state; }
    };
    if (!still) { plan(); gestures(true); }

    if (!audio) {   // no episode yet: she waits in her tank
      var soon = document.createElement('p'); soon.className = 'al-soon'; soon.textContent = bar.getAttribute('data-soon') || 'Her introduction is on its way.';
      st.appendChild(soon); return;
    }

    // her controls
    var c = document.createElement('div'); c.className = 'al-ctl';
    c.innerHTML = '<button type="button" class="al-sm al-b" aria-label="Back 15 seconds">' + IC.back + '</button><button type="button" class="al-pp" aria-label="Play">' + IC.play + '</button>' +
      '<button type="button" class="al-sm al-f" aria-label="On 15 seconds">' + IC.fwd + '</button><span class="al-t al-t0">0:00</span>' +
      '<input class="al-seek" type="range" min="0" max="1000" value="0" aria-label="Where in the episode"><span class="al-t al-t1">' +
      ((/(\d+:\d\d)/.exec((lbl || {}).textContent || '') || [, '0:00'])[1]) + '</span>';
    st.appendChild(c);
    var pp = c.querySelector('.al-pp'), seek = c.querySelector('.al-seek'), t0 = c.querySelector('.al-t0'), t1 = c.querySelector('.al-t1'), drag = false;
    function show() {
      var d = audio.duration || 0; if (!drag) seek.value = d ? Math.round(audio.currentTime / d * 1000) : 0;
      t0.textContent = clock(audio.currentTime); if (d && isFinite(d)) t1.textContent = clock(d);
      var on = !audio.paused; pp.innerHTML = on ? IC.pause : IC.play; pp.setAttribute('aria-label', on ? 'Pause' : 'Play');
    }
    ['timeupdate', 'play', 'pause', 'loadedmetadata', 'ended'].forEach(function (e) { audio.addEventListener(e, show); });
    pp.onclick = function () { if (holding) { onUp = null; hold(false); return; } if (audio.paused) audio.play().catch(function () {}); else audio.pause(); };
    c.querySelector('.al-b').onclick = function () { audio.currentTime = Math.max(0, audio.currentTime - 15); };
    c.querySelector('.al-f').onclick = function () { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 15); };
    seek.oninput = function () { drag = true; if (audio.duration) t0.textContent = clock(seek.value / 1000 * audio.duration); };
    seek.onchange = function () { drag = false; if (audio.duration) audio.currentTime = seek.value / 1000 * audio.duration; show(); };
    show();

    // her mouth: loudness picks how open, brightness (where the sound's energy sits) picks "ee" over "oo"
    var an = null, td = null, fd = null, talking = false, raf = 0, level = 0, lastSwap = 0, quiet = 0;
    function listen() {
      if (an || !(window.AudioContext || window.webkitAudioContext)) return;
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        var src = ctx.createMediaElementSource(audio);
        an = ctx.createAnalyser(); an.fftSize = 1024; td = new Uint8Array(an.fftSize); fd = new Uint8Array(an.frequencyBinCount);
        src.connect(an); an.connect(ctx.destination);
      } catch (e) { an = null; }
    }
    function tick(now) {
      var v = 0, bright = 0.5;
      if (an) {
        an.getByteTimeDomainData(td); var s = 0; for (var i = 0; i < td.length; i += 4) { var d = (td[i] - 128) / 128; s += d * d; }
        v = Math.min(1, Math.max(0, (Math.sqrt(s / (td.length / 4)) - 0.015) * 5));
        an.getByteFrequencyData(fd); var w = 0, t = 0; for (var j = 2; j < 120; j++) { w += fd[j] * j; t += fd[j]; } bright = t ? Math.min(1, (w / t) / 40) : 0.5;
      } else if (talking) v = 0.3 + 0.3 * Math.sin(now / 90) * Math.sin(now / 233);
      level += (v - level) * (v > level ? 0.6 : 0.3);
      if (now - lastSwap > 85) {
        lastSwap = now; var k;
        if (level < 0.07) { quiet++; k = talking ? (quiet > 12 ? 'smile' : 'neutral') : 'smile'; }
        else { quiet = 0; k = level > 0.5 ? (bright > 0.55 ? 'ah' : 'oh') : level > 0.22 ? (bright > 0.6 ? 'ee' : bright < 0.35 ? 'oo' : 'oh') : (bright > 0.5 ? 'ee' : 'neutral'); }
        say(k);
      }
      if (!still) head.style.transform = 'rotate(' + (Math.sin(now / 800) * 1.2 * level).toFixed(2) + 'deg) translateY(' + (-level * 1.2).toFixed(2) + '%)';
      if (talking || level > 0.01) raf = requestAnimationFrame(tick); else { raf = 0; say('smile'); head.style.transform = ''; }
    }
    isTalking = function () { return talking; };
    // her eyes as she speaks: a soft cyan while she talks, and at the episode's cues (data-cues, from the Note) a steady
    // amber ("when somebody litters") or a bright cyan-green bloom ("when a kid makes a good call"). Each eases over .9 s.
    var CUES = []; try { CUES = JSON.parse(bar.getAttribute('data-cues') || '[]').sort(function (a, b) { return a.at - b.at; }); } catch (e) { CUES = []; }
    function cueEyes() { var m = 'talk'; CUES.forEach(function (c) { if (audio.currentTime >= c.at) m = c.eyes || 'talk'; }); return m; }
    if (CUES.length) audio.addEventListener('timeupdate', function () { if (talking) eyeMode(cueEyes()); });
    // Play while she's underwater (or on her way down): the episode holds, she comes back up a little quicker, and it
    // starts once she's at the ledge. The button shows she's coming; pressed again, it's called off.
    var holding = false;
    function hold(on) {
      holding = on; pp.classList.toggle('al-wait', on);
      if (on) { pp.setAttribute('aria-label', 'Starting when she\'s back up (press to cancel)'); pp.innerHTML = IC.pause; } else show();
    }
    audio.addEventListener('play', function () {
      if (dv.state !== 'up') {
        audio.pause(); listen(); hold(true); rise(1.6);
        onUp = function () { if (!holding) return; hold(false); var p = audio.play(); if (p && p.catch) p.catch(function () {}); };
        return;
      }
      listen(); if (ctx && ctx.state === 'suspended') ctx.resume();
      talking = true; bar.classList.add('talking'); eyeMode(cueEyes());
      gestures(); if (!raf) raf = requestAnimationFrame(tick);
    });
    ['pause', 'ended'].forEach(function (t) { audio.addEventListener(t, function () {
      if (holding) { show(); pp.innerHTML = IC.pause; return; }
      talking = false; bar.classList.remove('talking'); eyeMode(''); plan(); gestures(true);
    }); });
  }

  function scan(root) { (root.querySelectorAll ? root : document).querySelectorAll('section.listen.alta').forEach(build); }
  function start() {
    scan(document);
    new MutationObserver(function (ms) { ms.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) { if (n.matches && n.matches('section.listen.alta')) build(n); else scan(n); } }); }); })
      .observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
