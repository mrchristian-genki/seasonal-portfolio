/* Robot Marley's player: builds on any .mly element (css/marley.css; her parts and kit in assets/marley/).
   Her parts are layered the way A.L.T.A.'s are: her body breathing, her tail wagging in slow arcs, her head on her
   neck (a curious tilt now and then), each ear on its own pivot, her lids, her mouth shapes, the gold glow on her
   lenses, and her collar and charm over the seam. Now and then she does one of her moves (assets/marley/moves/: a
   happy wag, lying down, standing to look around, a tilt and a wink): each clip starts and ends in her seated pose,
   so her parts cross-fade to it and back. The clips carry their own masks (colour over mask, drawn in a canvas),
   so whatever is behind her shows.

   On the element: data-palette="#collar #charm" (a Note's two colours), data-charm="heart" (else her bone),
   data-controls (her buttons below her). el.marley = { move(k), tilt(deg), blink(), eyes(mood), say(shape), talk(),
   charm(k), colours([a, b] | null) }. Every change eases; with reduced motion she stays still unless asked. */
(function () {
  'use strict';
  var P = '/assets/marley/parts/', MV = '/assets/marley/moves/', V = '?v=1';
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MOVES = [['wag', 'A happy wag'], ['down', 'Lie down'], ['stand', 'Stand and look'], ['tilt', 'Tilt and wink']];
  var CHARMS = ['bone', 'heart', 'paw', 'star', 'pinecone', 'ball', 'bike', 'leaf'];
  var DYE = { leaf: 0 }, OWN = { ball: '#f1eee6' };   // the leaf has no cyan render yet; her own white ball is the cyan cut dyed white
  var EYES = { happy: ['#ffb21e', '#ffcf4a', 0.45, 0.35], unsure: ['#b4570c', '#7a3a06', 0.7, 0.15], upset: ['#e0261a', '#ff3b2b', 0.75, 0.3] };
  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  var mask = function (u) { return '-webkit-mask:url(' + u + ') 0 0/100% 100%;mask:url(' + u + ') 0 0/100% 100%;'; };

  // a video whose bottom half is its own mask, drawn into a canvas with that mask as its alpha (as A.L.T.A.'s are)
  function alphaCanvas(v) {
    var c = document.createElement('canvas'), gl = c.getContext('webgl', { premultipliedAlpha: true, alpha: true });
    if (!gl) return null;
    var sh = function (t, src) { var o = gl.createShader(t); gl.shaderSource(o, src); gl.compileShader(o); return o; }, pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 p;varying vec2 u;void main(){u=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}'));
    // premultiplied, with the mask's faint floor (video black is never quite 0) cut away: no pale rim around her on any browser
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, 'precision mediump float;varying vec2 u;uniform sampler2D t;void main(){vec3 c=texture2D(t,vec2(u.x,u.y*.5)).rgb;float a=clamp((texture2D(t,vec2(u.x,.5+u.y*.5)).r-.1)/.82,0.,1.);gl_FragColor=vec4(c*a,a);}'));
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
    c.className = 'mly-mv-c'; c.setAttribute('aria-hidden', 'true');
    v.parentNode.insertBefore(c, v.nextSibling);
    return c;
  }

  function build(el) {
    if (el.marley) return;
    el.classList.add('mly');
    el.setAttribute('role', 'img');
    if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', 'Robot Marley, a robot hound, sitting and wagging her tail');
    var st = document.createElement('div'); st.className = 'mly-st';
    st.innerHTML = '<div class="mly-parts">' +
      '<img class="mly-tail" src="' + P + 'tail.webp' + V + '" alt="">' +
      '<img class="mly-body" src="' + P + 'body.webp' + V + '" alt="">' +
      '<div class="mly-g mly-head"><img src="' + P + 'head.webp' + V + '" alt=""><div class="mly-g mly-mouth">' +
        ['closed', 'small', 'open', 'pant'].map(function (k) { return '<img data-m="' + k + '" src="' + P + 'mouth-' + k + '.webp' + V + '" alt=""' + (k === 'closed' ? ' class="on"' : '') + '>'; }).join('') + '</div>' +
        '<img class="mly-lids" src="' + P + 'lids.webp' + V + '" alt=""><i class="mly-glow mly-glow-c"></i><i class="mly-glow mly-glow-s"></i>' +
        '<img class="mly-ear mly-earL mly-down" src="' + P + 'earL.webp' + V + '" alt=""><img class="mly-ear mly-earR mly-down" src="' + P + 'earR.webp' + V + '" alt="">' +
        '<img class="mly-ear mly-earL mly-up" src="' + P + 'earL-up.webp' + V + '" alt=""><img class="mly-ear mly-earR mly-up" src="' + P + 'earR-up.webp' + V + '" alt=""></div>' +
      '<img src="' + P + 'collar.webp' + V + '" alt=""><i class="mly-dc"></i><i class="mly-dc mly-dc2"></i>' +
      '<div class="mly-g mly-charm"></div></div>';
    el.insertBefore(st, el.firstChild);
    // the scene behind her (data-bd: the Note's backdrop, as the site picks it), under a soft floor shadow
    var bd = el.getAttribute('data-bd');
    if (bd && /^\/assets\/[\w.\/-]+\.(webp|jpg|png)(\?v=[\w-]+)?$/.test(bd)) { st.classList.add('has-bd'); st.style.backgroundImage = 'radial-gradient(ellipse at 50% 95%,rgba(0,0,0,.28),transparent 42%),url(' + bd + ')'; }
    var q = function (s) { return st.querySelector(s); };
    var head = q('.mly-head'), ch = q('.mly-charm'), gc = q('.mly-glow-c'), gs = q('.mly-glow-s');
    var eL = q('.mly-earL.mly-down'), eR = q('.mly-earR.mly-down');

    // mouth
    var M = {}, cur = 'closed';
    [].forEach.call(st.querySelectorAll('.mly-mouth img'), function (i) { M[i.getAttribute('data-m')] = i; });
    function say(k) { if (k === cur || !M[k]) return; M[cur].classList.remove('on'); M[k].classList.add('on'); cur = k; }
    var talkT;
    function talk() {
      clearTimeout(talkT);
      var seq = [], n = 10 + Math.floor(Math.random() * 6);
      for (var w = 0; w < n; w++) { seq.push(['small', 'open', 'small', 'open', 'small'][Math.floor(Math.random() * 5)], 'closed'); if (Math.random() < 0.2) seq.push('closed'); }
      seq.push('pant', 'closed'); var i = 0;
      (function next() { if (i >= seq.length) return; say(seq[i++]); talkT = setTimeout(next, 130 + Math.random() * 80); })();
    }
    // head, ears, lids, eyes
    function tilt(d) { head.style.transform = d ? 'rotate(' + d + 'deg)' : ''; }
    function flick(k) { var e = k === 'L' ? eL : eR; e.style.transform = 'rotate(' + (k === 'L' ? 14 : -14) + 'deg)'; setTimeout(function () { e.style.transform = ''; }, 700); }
    function blink() { el.classList.add('blink'); setTimeout(function () { el.classList.remove('blink'); }, 140); }
    function eyes(m) { var e = EYES[m] || EYES.happy; gc.style.background = e[0]; gs.style.background = e[1]; gc.style.opacity = e[2]; gs.style.opacity = e[3]; }

    // collar and charm: her own, or a Note's two colours (the charm's dyed face cross-fades in over her own)
    var pal = null, chK = '';
    function charm(k) {
      if (CHARMS.indexOf(k) < 0) k = 'bone';
      chK = k;
      var d = DYE[k] !== 0, o = OWN[k], c = pal ? pal[1] : o || '#ffffff', show = !!(pal || o);
      ch.innerHTML = '<img class="mly-own" src="' + P + 'charm-' + k + '.webp' + V + '" alt=""' + (d ? ' style="opacity:' + (show ? 0 : 1) + '"' : '') + '>' +
        (d ? '<div class="mly-g mly-dyed" style="opacity:' + (show ? 1 : 0) + '"><img src="' + P + 'charm-' + k + '-dye.webp' + V + '" alt=""><i class="mly-dye" style="' + mask(P + 'charm-' + k + '-mask.webp' + V) + 'background:' + c + '"></i></div>'
           : '<i class="mly-dye" style="' + mask(P + 'charm-' + k + '.webp' + V) + 'opacity:' + (pal ? 1 : 0) + ';background:' + c + '"></i>');
      if (!still) { ch.classList.remove('sw'); void ch.offsetWidth; ch.classList.add('sw'); }
    }
    function colours(p) {
      pal = p && /^#[0-9a-f]{6}$/i.test(p[0]) && /^#[0-9a-f]{6}$/i.test(p[1]) ? p : null;
      el.classList.toggle('pal', !!pal);
      if (pal) [].forEach.call(st.querySelectorAll('.mly-dc'), function (i) { i.style.background = pal[0]; });
      var own = ch.querySelector('.mly-own'), dy = ch.querySelector('.mly-dyed'), i = ch.querySelector('.mly-dye'), o = OWN[chK], show = !!(pal || o);
      if (i) i.style.background = pal ? pal[1] : o || '#ffffff';
      if (dy) { dy.style.opacity = show ? 1 : 0; own.style.opacity = show ? 0 : 1; } else if (i) i.style.opacity = pal ? 1 : 0;
    }
    charm(el.getAttribute('data-charm') || 'bone');
    colours((el.getAttribute('data-palette') || '').split(' '));

    // her moves: a video (colour over mask) drawn in a canvas; her parts fade out as it fades in, and back near its end
    var vid = document.createElement('video'); vid.className = 'mly-mv'; vid.muted = true; vid.playsInline = true; vid.preload = 'none';
    vid.setAttribute('playsinline', ''); vid.setAttribute('muted', ''); vid.setAttribute('aria-hidden', 'true');
    st.appendChild(vid);
    var cv = alphaCanvas(vid), moving = '', lastMove = '', onScreen = false, moveT, ctl = {};
    function settle() { tilt(0); el.classList.remove('alert'); say('closed'); }
    function done() {
      cv.classList.remove('on'); st.classList.remove('moving');
      setTimeout(function () { if (!st.classList.contains('moving')) { vid.pause(); } moving = ''; mark(); plan(); }, 650);
    }
    function move(k) {
      if (!cv || moving || !MOVES.some(function (m) { return m[0] === k; })) return;
      clearTimeout(moveT); moving = k; lastMove = k; mark(); settle();
      vid.src = MV + k + '.mp4' + V; vid.preload = 'auto';
      var faded = false;
      var go = function () {
        vid.removeEventListener('playing', go);
        setTimeout(function () { if (moving === k) { cv.classList.add('on'); st.classList.add('moving'); } }, 60);
      };
      var tick = function () { if (!faded && vid.duration && vid.currentTime > vid.duration - 0.75) { faded = true; vid.removeEventListener('timeupdate', tick); done(); } };
      vid.addEventListener('playing', go); vid.addEventListener('timeupdate', tick);
      vid.onended = function () { if (!faded) { faded = true; done(); } };
      setTimeout(function () { var p = vid.play(); if (p && p.catch) p.catch(function () { moving = ''; mark(); plan(); }); }, 300);
    }
    // in a Listen bar (a Note she narrates): she talks along while the episode plays, and her moves wait for it
    var bar = el.closest && el.closest('section.listen'), au = bar && bar.querySelector('audio'), chatT;
    function chat() { clearTimeout(chatT); if (!au || au.paused || au.ended) { say('closed'); return; } say(['small', 'open', 'small', 'closed', 'open', 'small'][Math.floor(Math.random() * 6)]); chatT = setTimeout(chat, 110 + Math.random() * 90); }
    if (au) { au.addEventListener('play', chat); ['pause', 'ended'].forEach(function (k) { au.addEventListener(k, function () { clearTimeout(chatT); say('closed'); }); }); }
    function plan() {
      clearTimeout(moveT); if (still || !cv) return;
      moveT = setTimeout(function () {
        if (!onScreen || moving || document.hidden || (au && !au.paused)) return plan();
        var pick = MOVES.map(function (m) { return m[0]; }).filter(function (k) { return k !== lastMove; });
        move(pick[Math.floor(Math.random() * pick.length)]);
      }, rnd(22000, 40000));
    }
    function mark() { Object.keys(ctl).forEach(function (k) { ctl[k].disabled = !!moving; ctl[k].classList.toggle('on', moving === k); }); }

    // on her own: blinks, an ear flick now and then, a curious tilt once in a while, and her moves
    if (!still) {
      (function b() { setTimeout(function () { if (!moving) { blink(); if (Math.random() < 0.2) setTimeout(blink, 340); } b(); }, rnd(3000, 6500)); })();
      (function f() { setTimeout(function () { if (!moving) flick(Math.random() < 0.5 ? 'L' : 'R'); f(); }, rnd(6000, 14000)); })();
      (function t() { setTimeout(function () { if (!moving) { tilt(Math.random() < 0.5 ? -9 : 9); setTimeout(function () { if (!moving) tilt(0); }, 2600); } t(); }, rnd(14000, 26000)); })();
    }
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { onScreen = es[0].isIntersecting; }).observe(st); else onScreen = true;
    plan();

    // her buttons
    if (el.hasAttribute('data-controls')) {
      var box = document.createElement('div'); box.className = 'mly-ctl';
      var row = function (label, items, fn, group) {
        var r = document.createElement('div'); r.className = 'mly-row'; r.innerHTML = '<span>' + label + '</span>';
        items.forEach(function (x, n) {
          var b = document.createElement('button'); b.type = 'button'; b.className = 'mly-chip' + (group && x[2] ? ' on' : ''); b.textContent = x[1];
          b.onclick = function () { if (group) [].forEach.call(r.querySelectorAll('.mly-chip'), function (y) { y.classList.toggle('on', y === b); }); fn(x[0], b); };
          r.appendChild(b); if (!group && fn === move) ctl[x[0]] = b;
        });
        box.appendChild(r);
      };
      if (cv) row('Moves', MOVES, move);
      row('Eyes', [['happy', 'Happy gold', 1], ['unsure', 'Dark amber'], ['upset', 'Red']], eyes, true);
      row('Head', [['curious', 'Curious tilt'], ['alert', 'Ears up'], ['talk', 'Talk'], ['blink', 'Blink']], function (k) {
        if (moving) return;
        if (k === 'curious') { tilt(Math.random() < 0.5 ? -10 : 10); setTimeout(function () { tilt(0); }, 2600); }
        else if (k === 'alert') { el.classList.add('alert'); setTimeout(function () { el.classList.remove('alert'); }, 2400); }
        else if (k === 'talk') talk(); else blink();
      });
      row('Charm', CHARMS.map(function (k) { return [k, k === 'bike' ? 'bike wheel' : k, k === chK]; }), charm, true);
      el.appendChild(box);
    }
    el.marley = { move: move, tilt: tilt, blink: blink, eyes: eyes, say: say, talk: talk, charm: charm, colours: colours };
  }

  function scan(root) { [].forEach.call((root.querySelectorAll ? root : document).querySelectorAll('.marley'), build); }
  function init() {
    scan(document);
    new MutationObserver(function (ms) { ms.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) { if (n.matches && n.matches('.marley')) build(n); else scan(n); } }); }); })
      .observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
