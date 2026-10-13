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
  var P = '/assets/marley/parts/web/', MV = '/assets/marley/moves/', V = '?v=2';
  // Her parts, each cropped to its own box in her 560 x 728 frame (assets/marley/parts/web/boxes.json; the full-frame
  // originals stay in parts/ for the kit): a few MB decoded instead of sixty, so a phone keeps every layer painted.
  var FW = 560, FH = 728, BOX = {"tail":[386,538,154,102],"body":[92,220,328,496],"head":[148,22,214,288],"lids":[150,42,218,108],"collar":[170,220,174,92],"earL":[92,30,102,166],"earR":[308,28,116,168],"earL-up":[28,12,174,144],"earR-up":[306,12,180,160],"mouth":[158,126,206,184],"iris":[178,80,150,42],"charm-bone":[224,270,84,94],"charm-heart":[220,270,88,120],"charm-paw":[212,268,96,128],"charm-star":[224,268,84,116],"charm-pinecone":[228,270,80,128],"charm-ball":[220,268,88,122],"charm-bike":[208,268,100,156],"charm-leaf":[216,302,82,98],"hat-halloween":[176,-40,156,100],"hat-winter":[186,-40,138,96],"hat-stpatricks":[184,-38,140,92],"charm-broom":[230,314,66,216],"charm-snowglobe":[212,278,92,134],"charm-clover":[204,276,106,150],"hat-hawaii":[158,2,192,61],"charm-lei":[102,165,316,315],"hat-beanie":[150,-40,208,155],"charm-wintercone":[222,275,74,116]};
  var pct = function (n, d) { return (n / d * 100).toFixed(4) + '%'; };
  // a part's place in her frame, and (ox, oy: shares of the frame) the point it turns about, made relative to its box
  function at(g, ox, oy) {
    var b = BOX[g]; if (!b) return '';
    // (right, bottom and margin pinned too: a page's own picture styles, like a Note's centred images, can't move it)
    return ' style="left:' + pct(b[0], FW) + ';top:' + pct(b[1], FH) + ';right:auto;bottom:auto;margin:0;max-width:none;max-height:none;width:' + pct(b[2], FW) + ';height:' + pct(b[3], FH) +
      (ox != null ? ';transform-origin:' + pct(ox * FW - b[0], b[2]) + ' ' + pct(oy * FH - b[1], b[3]) : '') + '"';
  }
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MOVES = [['wag', 'A happy wag'], ['down', 'Lie down'], ['stand', 'Stand and look'], ['tilt', 'Tilt and wink']];
  var CHARMS = ['bone', 'heart', 'paw', 'star', 'pinecone', 'ball', 'bike', 'leaf'];
  var DYE = { leaf: 0 }, OWN = { ball: '#f1eee6' };
  // her holiday looks (Christian, Oct 13): a hat on her head and a charm on her collar, each with a cyan render for a
  // Note's colours like her charms. Worn on the site's holiday dates (assets/narrator/looks.json, the same windows as
  // GlazyArray's), or picked; the hats tilt with her head. Thanksgiving's is on its way. Hawaii (Oct 13) isn't a holiday,
  // only picked: sunglasses pushed up on her head (worn as a hat) and a flower lei (as a charm, too big to swing).
  // Tahoe winter (Oct 13): a knit beanie and a pinecone charm, on its dates (01-02 to 01-31)
  var HOL = { halloween: ['halloween', 'broom', 'Halloween'], 'winter-holidays': ['winter', 'snowglobe', 'Winter holidays'], 'st-patricks': ['stpatricks', 'clover', 'St. Patrick\'s'], hawaii: ['hawaii', 'lei', 'Hawaii'], 'tahoe-winter': ['beanie', 'wintercone', 'Tahoe winter'] };
  var HCHARMS = ['broom', 'snowglobe', 'clover', 'lei', 'wintercone'];   // the leaf has no cyan render yet; her own white ball is the cyan cut dyed white
  // looks brought in from the Studio (Characters, "Bring in a look", Oct 13): a look in looks.json whose "marley" names
  // her pieces ({ hat, charm, hatBox, charmBox, v, label }) joins the ones above, no code needed; its files carry their
  // own version (PV), so a look brought in again isn't served from a cache
  var PV = {}, PE = {}, LOOKS_J = null;
  function adopt(J) {
    ((J && J.looks) || []).forEach(function (l) {
      var m = l.marley, ok = function (k) { return /^[a-z0-9]{1,24}$/.test(k || ''); }, box = function (b) { return Array.isArray(b) && b.length === 4 && b.every(function (n) { return typeof n === 'number'; }); };
      if (!m || typeof m !== 'object' || !ok(m.hat) || !ok(m.charm) || !box(m.hatBox) || !box(m.charmBox)) return;
      BOX['hat-' + m.hat] = m.hatBox; BOX['charm-' + m.charm] = m.charmBox;
      HOL[l.name] = [m.hat, m.charm, String(m.label || l.name.replace(/-/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); })).slice(0, 40)];
      if (HCHARMS.indexOf(m.charm) < 0) HCHARMS.push(m.charm);
      if (m.v) PV['hat-' + m.hat] = PV['charm-' + m.charm] = '?v=' + String(m.v).replace(/\W/g, '');
      if (m.ext === 'png') PE['hat-' + m.hat] = PE['charm-' + m.charm] = 'png';   // a browser that couldn't save webp
    });
    return J;
  }
  function looksJ() { return LOOKS_J || (LOOKS_J = fetch('/assets/narrator/looks.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(adopt)); }
  function pv(part) { return PV[part] || V; }
  function pe(part) { return PE[part] || 'webp'; }
  // her lenses: their own amber unless a mood tints them (Christian, Oct 12: a softer gold, amber as her normal)
  // [gold overlay, red colour, red screen] opacities, each layer fading on its own
  var EYES = { amber: [0, 0, 0], happy: [0.55, 0, 0], upset: [0, 0.7, 0.26] };
  EYES.unsure = EYES.amber;
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
      if (c.onframe && v.currentTime > 0) { var f = c.onframe; c.onframe = null; f(sane()); }
    }
    // the first frame of a move, checked before it's shown: she should cover a fair part of the frame, in colour. A
    // phone that hands WebGL an empty or black frame (it happens while a video is still waking up) fails this, and the
    // move is skipped: her layers stay, never a blank or a dark block where she was
    function sane() {
      try {
        var w = c.width, h = c.height, px = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
        var her = 0, dark = 0;
        for (var i = 0; i < px.length; i += 4 * 37) { if (px[i + 3] > 200) { her++; if (px[i] + px[i + 1] + px[i + 2] < 24) dark++; } }
        var n = px.length / (4 * 37);
        return her > n * 0.08 && her < n * 0.9 && dark < her * 0.5;
      } catch (e) { return true; }
    }
    var rvfc = 'requestVideoFrameCallback' in v;
    function loop() { draw(); if (!v.paused && !v.ended) { if (rvfc) v.requestVideoFrameCallback(loop); else requestAnimationFrame(loop); } }
    ['play', 'seeked', 'loadeddata'].forEach(function (e) { v.addEventListener(e, loop); });
    c.className = 'mly-mv-c'; c.setAttribute('aria-hidden', 'true');
    v.parentNode.insertBefore(c, v.nextSibling);
    return c;
  }

  function build(el) {
    // data-manual (the Parts Catalog's cards): no blinks, ear flicks, tilts or moves on a timer; only what's asked
    var auto = !still && !el.hasAttribute('data-manual');
    if (el.marley) return;
    el.classList.add('mly');
    el.setAttribute('role', 'img');
    if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', 'Robot Marley, a robot hound, sitting and wagging her tail');
    var st = document.createElement('div'); st.className = 'mly-st';
    st.innerHTML = '<div class="mly-seat" aria-hidden="true"></div><div class="mly-parts">' +
      '<img class="mly-tail" src="' + P + 'tail.webp' + V + '" alt=""' + at('tail', .725, .824) + '>' +
      '<img class="mly-body" src="' + P + 'body.webp' + V + '" alt=""' + at('body', .5, 1) + '>' +
      '<div class="mly-g mly-head"><img src="' + P + 'head.webp' + V + '" alt=""' + at('head') + '><div class="mly-g mly-mouth">' +
        ['closed', 'small', 'open', 'pant'].map(function (k) { return '<img data-m="' + k + '" src="' + P + 'mouth-' + k + '.webp' + V + '" alt=""' + at('mouth') + (k === 'closed' ? ' class="on"' : '') + '>'; }).join('') + '</div>' +
        '<img class="mly-lids" src="' + P + 'lids.webp' + V + '" alt=""' + at('lids') + '>' + ['g', 'c', 's'].map(function (k) { return '<i class="mly-glow mly-glow-' + k + '"' + at('iris') + '></i>'; }).join('') +
        '<img class="mly-ear mly-earL mly-down" src="' + P + 'earL.webp' + V + '" alt=""' + at('earL', .307, .071) + '><img class="mly-ear mly-earR mly-down" src="' + P + 'earR.webp' + V + '" alt=""' + at('earR', .593, .071) + '>' +
        '<img class="mly-ear mly-earL mly-up" src="' + P + 'earL-up.webp' + V + '" alt=""' + at('earL-up', .307, .071) + '><img class="mly-ear mly-earR mly-up" src="' + P + 'earR-up.webp' + V + '" alt=""' + at('earR-up', .593, .071) + '>' +
        '<div class="mly-g mly-hat"></div></div>' +
      '<img src="' + P + 'collar.webp' + V + '" alt=""' + at('collar') + '><i class="mly-dc"' + at('collar') + '></i><i class="mly-dc mly-dc2"' + at('collar') + '></i>' +
      '<div class="mly-g mly-charm"></div></div>';
    el.insertBefore(st, el.firstChild);
    // her stand-in fades once every part has loaded (and decoded, where the browser can say)
    (function () {
      var parts = st.querySelector('.mly-parts'), imgs = [].slice.call(parts.querySelectorAll('img'));
      Promise.all(imgs.map(function (i) { return (i.decode ? i.decode() : new Promise(function (ok) { if (i.complete) ok(); else i.onload = i.onerror = ok; })).catch(function () {}); }))
        .then(function () { parts.classList.add('ready'); });
    })();
    // the scene behind her (data-bd: the Note's backdrop, as the site picks it), softly blurred and dimmed the way
    // GlazyArray's is (css/narrator.css .nb-bd), so she and her stump stand out in front of it
    var bd = el.getAttribute('data-bd');
    if (bd && /^\/assets\/[\w.\/-]+\.(webp|jpg|png)(\?v=[\w-]+)?$/.test(bd)) {
      var bi = document.createElement('i'); bi.className = 'mly-bd'; bi.style.backgroundImage = 'url(' + bd + ')';
      st.insertBefore(bi, st.firstChild); st.classList.add('has-bd');
    }
    var q = function (s) { return st.querySelector(s); };
    var head = q('.mly-head'), ch = q('.mly-charm'), hatEl = q('.mly-hat'), gg = q('.mly-glow-g'), gc = q('.mly-glow-c'), gs = q('.mly-glow-s');
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
      return seq.length * 210;   // about how long she talks (each shape 130 to 210 ms), for her buttons' lock
    }
    // head, ears, lids, eyes
    function tilt(d) { head.style.transform = d ? 'rotate(' + d + 'deg)' : ''; }
    function flick(k) { var e = k === 'L' ? eL : eR; e.style.transform = 'rotate(' + (k === 'L' ? 14 : -14) + 'deg)'; setTimeout(function () { e.style.transform = ''; }, 700); }
    function blink() { el.classList.add('blink'); setTimeout(function () { el.classList.remove('blink'); }, 140); }
    function eyes(m) { var e = EYES[m] || EYES.amber; gg.style.opacity = e[0]; gc.style.opacity = e[1]; gs.style.opacity = e[2]; }

    // collar and charm: her own, or a Note's two colours (the charm's dyed face cross-fades in over her own)
    var pal = null, chK = '';
    function charm(k) {
      if (CHARMS.indexOf(k) < 0 && HCHARMS.indexOf(k) < 0) k = 'bone';
      chK = k;
      if (box) [].forEach.call(box.querySelectorAll('[data-row="charm"] .mly-chip'), function (c) { c.classList.toggle('on', c.getAttribute('data-k') === k); });
      var d = DYE[k] !== 0, o = OWN[k], c = pal ? pal[1] : o || '#ffffff', show = !!(pal || o);
      var bx = at('charm-' + k).slice(8, -1);   // the charm's own box (its face, dyed face and mask share it)
      ch.innerHTML = '<img class="mly-own" src="' + P + 'charm-' + k + '.' + pe('charm-' + k) + pv('charm-' + k) + '" alt="" style="' + bx + (d ? ';opacity:' + (show ? 0 : 1) : '') + '">' +
        (d ? '<div class="mly-g mly-dyed" style="opacity:' + (show ? 1 : 0) + '"><img src="' + P + 'charm-' + k + '-dye.' + pe('charm-' + k) + pv('charm-' + k) + '" alt="" style="' + bx + '"><i class="mly-dye" style="' + bx + ';' + mask(P + 'charm-' + k + '-mask.' + pe('charm-' + k) + pv('charm-' + k)) + 'background:' + c + '"></i></div>'
           : '<i class="mly-dye" style="' + bx + ';' + mask(P + 'charm-' + k + '.' + pe('charm-' + k) + pv('charm-' + k)) + 'opacity:' + (pal ? 1 : 0) + ';background:' + c + '"></i>');
      ch.classList.remove('sw'); if (!still && k !== 'lei') { void ch.offsetWidth; ch.classList.add('sw'); }
    }
    // her hat: her own, or (with a Note's colours) its cyan render dyed with the first, like her collar. A new hat fades
    // in as the old one fades out
    var hatK = '';
    function hatHTML(k) {
      var bx = at('hat-' + k).slice(8, -1), show = !!pal;
      return '<img class="mly-own" src="' + P + 'hat-' + k + '.' + pe('hat-' + k) + pv('hat-' + k) + '" alt="" style="' + bx + ';opacity:' + (show ? 0 : 1) + '">' +
        '<div class="mly-g mly-dyed" style="opacity:' + (show ? 1 : 0) + '"><img src="' + P + 'hat-' + k + '-dye.' + pe('hat-' + k) + pv('hat-' + k) + '" alt="" style="' + bx + '">' +
        '<i class="mly-dye" style="' + bx + ';' + mask(P + 'hat-' + k + '-mask.' + pe('hat-' + k) + pv('hat-' + k)) + 'background:' + (pal ? pal[0] : '#ffffff') + '"></i></div>';
    }
    function hat(k) {
      k = k && BOX['hat-' + k] ? k : '';
      if (k === hatK) return;
      hatK = k;
      [].forEach.call(hatEl.children, function (old) { old.style.opacity = 0; setTimeout(function () { if (old.parentNode) old.parentNode.removeChild(old); }, still ? 0 : 950); });
      if (!k) return;
      var w = document.createElement('div'); w.className = 'mly-g mly-hatk'; w.style.opacity = 0; w.innerHTML = hatHTML(k);
      hatEl.appendChild(w);
      requestAnimationFrame(function () { requestAnimationFrame(function () { w.style.opacity = 1; }); });
    }
    // a holiday: its hat and its charm (her own charm comes back after); '' takes it off
    var holK = '', charmBefore = '';
    function holiday(k) {
      var h = HOL[k];
      if (box) [].forEach.call(box.querySelectorAll('[data-row="holiday or look"] .mly-chip'), function (c) { c.classList.toggle('on', c.getAttribute('data-k') === (h ? k : 'none')); });
      if (h) { if (!holK) charmBefore = chK; holK = k; hat(h[0]); charm(h[1]); }
      else if (holK) { holK = ''; hat(''); charm(charmBefore || 'bone'); }
    }
    function colours(p) {
      pal = p && /^#[0-9a-f]{6}$/i.test(p[0]) && /^#[0-9a-f]{6}$/i.test(p[1]) ? p : null;
      [].forEach.call(hatEl.querySelectorAll('.mly-hatk'), function (w) {
        var o = w.querySelector('.mly-own'), d = w.querySelector('.mly-dyed'), i = w.querySelector('.mly-dye');
        if (i && pal) i.style.background = pal[0];
        if (o && d) { o.style.opacity = pal ? 0 : 1; d.style.opacity = pal ? 1 : 0; }
      });
      el.classList.toggle('pal', !!pal);
      if (pal) [].forEach.call(st.querySelectorAll('.mly-dc'), function (i) { i.style.background = pal[0]; });
      var own = ch.querySelector('.mly-own'), dy = ch.querySelector('.mly-dyed'), i = ch.querySelector('.mly-dye'), o = OWN[chK], show = !!(pal || o);
      if (i) i.style.background = pal ? pal[1] : o || '#ffffff';
      if (dy) { dy.style.opacity = show ? 1 : 0; own.style.opacity = show ? 0 : 1; } else if (i) i.style.opacity = pal ? 1 : 0;
    }
    charm(el.getAttribute('data-charm') || 'bone');
    colours((el.getAttribute('data-palette') || '').split(' '));
    // the holiday she wears, in GlazyArray's order: data-holiday names one outright ("none" for none); else a holiday on
    // today's date (the site's holiday windows) unless this Note ignores holidays (data-noholiday); else the holiday
    // look this Note or its category chose (data-look, from field/tools/publish.mjs), say St. Patrick's on a Note
    // about Ireland
    (function () {
      var want = el.getAttribute('data-holiday'), own = el.getAttribute('data-look');
      if (want === 'none') return;
      if (want && HOL[want]) return holiday(want);
      var noDates = el.closest && el.closest('[data-noholiday]');
      if (own && HOL[own] && noDates) return holiday(own);
      looksJ().then(function (J) {   // (and the looks brought in from the Studio)
        if (holK) return;
        if (want && HOL[want]) return holiday(want);
        if (own && HOL[own] && noDates) return holiday(own);
        var d = new Date(), md = ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
        var on = noDates ? null : (J.looks || []).filter(function (l) { return HOL[l.name] && l.from && l.to && (l.from <= l.to ? md >= l.from && md <= l.to : md >= l.from || md <= l.to); })[0];
        if (!holK) { if (on) holiday(on.name); else if (own && HOL[own]) holiday(own); }
      }).catch(function () { if (!holK && own && HOL[own]) holiday(own); });
    })();

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
      // shown only once a good frame is on the canvas; if none comes within a few seconds, or the first is bad, she
      // skips the move and stays as she is
      var wait = setTimeout(function () { if (moving === k && !cv.classList.contains('on')) { cv.onframe = null; vid.pause(); moving = ''; mark(); plan(); } }, 3500);
      var go = function () {
        vid.removeEventListener('playing', go);
        cv.onframe = function (ok) {
          clearTimeout(wait);
          if (moving !== k) return;
          if (!ok) { vid.pause(); moving = ''; mark(); plan(); return; }
          cv.classList.add('on'); st.classList.add('moving');
        };
      };
      var tick = function () { if (!faded && vid.duration && vid.currentTime > vid.duration - 0.75) { faded = true; vid.removeEventListener('timeupdate', tick); done(); } };
      vid.addEventListener('playing', go); vid.addEventListener('timeupdate', tick);
      vid.onended = function () { if (!faded) { faded = true; done(); } };
      setTimeout(function () { var p = vid.play(); if (p && p.catch) p.catch(function () { moving = ''; mark(); plan(); }); }, 300);
    }
    // in a Listen bar (a Note she narrates): she talks along while the episode plays, and her moves wait for it
    var bar = el.closest && el.closest('section.listen'), au = bar && bar.querySelector('audio');
    // her mouth follows the voice itself (as A.L.T.A.'s does): Web Audio measures how loud it is each frame, so she only
    // opens her mouth when there's sound, never ahead of it while the episode is still loading
    var ctx = null, an = null, td = null, talking = false, raf = 0, level = 0, lastSwap = 0;
    function listen() {
      if (an || !(window.AudioContext || window.webkitAudioContext)) return;
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        var src = ctx.createMediaElementSource(au);
        an = ctx.createAnalyser(); an.fftSize = 1024; td = new Uint8Array(an.fftSize);
        src.connect(an); an.connect(ctx.destination);
      } catch (e) { an = null; }
    }
    function tick(now) {
      var v = 0;
      if (an) { an.getByteTimeDomainData(td); var s = 0; for (var i = 0; i < td.length; i += 4) { var d = (td[i] - 128) / 128; s += d * d; } v = Math.min(1, Math.max(0, (Math.sqrt(s / (td.length / 4)) - 0.015) * 5)); }
      else if (talking && !au.paused && au.currentTime > 0) v = 0.3 + 0.3 * Math.sin(now / 90) * Math.sin(now / 233);
      level += (v - level) * (v > level ? 0.6 : 0.3);
      if (now - lastSwap > 85) { lastSwap = now; say(level < 0.07 ? 'closed' : level > 0.42 ? 'open' : 'small'); }
      if (talking || level > 0.01) raf = requestAnimationFrame(tick); else { raf = 0; say('closed'); }
    }
    if (au) {
      au.addEventListener('play', function () {
        listen(); if (ctx && ctx.state === 'suspended') ctx.resume();
        if (moving) done();   // mid-move: she comes back to sit and talk
        talking = true; if (!raf) raf = requestAnimationFrame(tick);
      });
      ['pause', 'ended'].forEach(function (k) { au.addEventListener(k, function () { talking = false; }); });
    }
    function plan() {
      clearTimeout(moveT); if (!auto || !cv) return;
      moveT = setTimeout(function () {
        if (!onScreen || moving || document.hidden || (au && !au.paused)) return plan();
        var pick = MOVES.map(function (m) { return m[0]; }).filter(function (k) { return k !== lastMove; });
        move(pick[Math.floor(Math.random() * pick.length)]);
      }, rnd(22000, 40000));
    }
    // her buttons wait while she does something that takes time, so nothing is cut off halfway: the one pressed shows
    // a thin bar filling for as long as it lasts (or, for a move, sliding until the clip ends), the others dim and
    // softly pulse, and all come back once she's done (css .mly-ctl.busy)
    var box = null, lockT = 0, lockKind = '';
    function lock(b, ms, kind) {
      if (!box) return;
      clearTimeout(lockT); lockKind = kind || 'act';
      box.classList.add('busy');
      [].forEach.call(box.querySelectorAll('.mly-chip'), function (c) { c.disabled = true; c.classList.toggle('run', c === b); c.classList.toggle('wait', c === b && !ms); c.classList.remove('go'); });
      if (b && ms) { b.style.setProperty('--dur', Math.round(ms) + 'ms'); void b.offsetWidth; b.classList.add('go'); }
      if (ms) lockT = setTimeout(unlock, ms);
    }
    function unlock() {
      if (!box) return;
      clearTimeout(lockT); lockKind = '';
      box.classList.remove('busy');
      [].forEach.call(box.querySelectorAll('.mly-chip'), function (c) { c.disabled = false; c.classList.remove('run', 'wait', 'go'); });
    }
    // a move (pressed, or one she does on her own) holds her buttons until its clip has faded back to her
    function mark() { if (moving) lock(ctl[moving] || null, 0, 'move'); else if (lockKind === 'move') unlock(); }

    // on her own: blinks, an ear flick now and then, a curious tilt once in a while, and her moves
    if (auto) {
      (function b() { setTimeout(function () { if (!moving) { blink(); if (Math.random() < 0.2) setTimeout(blink, 340); } b(); }, rnd(3000, 6500)); })();
      (function f() { setTimeout(function () { if (!moving) flick(Math.random() < 0.5 ? 'L' : 'R'); f(); }, rnd(6000, 14000)); })();
      (function t() { setTimeout(function () { if (!moving) { tilt(Math.random() < 0.5 ? -9 : 9); setTimeout(function () { if (!moving) tilt(0); }, 2600); } t(); }, rnd(14000, 26000)); })();
    }
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { onScreen = es[0].isIntersecting; }).observe(st); else onScreen = true;
    plan();

    // her buttons
    if (el.hasAttribute('data-controls')) {
      box = document.createElement('div'); box.className = 'mly-ctl';
      var row = function (label, items, fn, group) {
        var r = document.createElement('div'); r.className = 'mly-row'; r.setAttribute('data-row', label.toLowerCase()); r.innerHTML = '<span>' + label + '</span>';
        items.forEach(function (x, n) {
          var b = document.createElement('button'); b.type = 'button'; b.className = 'mly-chip' + (group && x[2] ? ' on' : ''); b.textContent = x[1]; b.setAttribute('data-k', x[0]);
          b.onclick = function () {
            if (box.classList.contains('busy')) return;
            if (group) [].forEach.call(r.querySelectorAll('.mly-chip'), function (y) { y.classList.toggle('on', y === b); });
            fn(x[0], b);
          };
          r.appendChild(b); if (!group && fn === move) ctl[x[0]] = b;
        });
        box.appendChild(r);
      };
      if (cv) row('Moves', MOVES, move);
      // each holds her buttons for as long as it takes, the ease back included
      row('Eyes', [['amber', 'Amber', 1], ['happy', 'Happy gold'], ['upset', 'Red']], function (k, b) { eyes(k); lock(b, 900); }, true);
      row('Head', [['curious', 'Curious tilt'], ['alert', 'Ears up'], ['talk', 'Talk'], ['blink', 'Blink']], function (k, b) {
        if (moving) return;
        if (k === 'curious') { tilt(Math.random() < 0.5 ? -10 : 10); setTimeout(function () { tilt(0); }, 2600); lock(b, 3500); }
        else if (k === 'alert') { el.classList.add('alert'); setTimeout(function () { el.classList.remove('alert'); }, 2400); lock(b, 3000); }
        else if (k === 'talk') lock(b, talk() + 200);
        else { blink(); lock(b, 400); }
      });
      row('Charm', CHARMS.map(function (k) { return [k, k === 'bike' ? 'bike wheel' : k, k === chK]; }), function (k, b) { if (holK) { holiday(''); } charm(k); lock(b, still ? 900 : 2400); }, true);
      // once the looks brought in from the Studio are known (it fades in, css/marley.css .mly-late)
      var holRow = function () {
        if (box.querySelector('[data-row="holiday or look"]')) return;
        row('Holiday or look', [['none', 'None', !holK]].concat(Object.keys(HOL).map(function (k) { return [k, HOL[k][2], k === holK]; })), function (k, b) { holiday(k === 'none' ? '' : k); lock(b, still ? 900 : 2400); }, true);
        var hr = box.querySelector('[data-row="holiday or look"]'); if (hr) hr.classList.add('mly-late');
      };
      looksJ().then(holRow, holRow);
      el.appendChild(box);
    }
    el.marley = { move: move, tilt: tilt, blink: blink, eyes: eyes, say: say, talk: talk, charm: charm, colours: colours, hat: hat, holiday: holiday };
  }

  function scan(root) { [].forEach.call((root.querySelectorAll ? root : document).querySelectorAll('.marley'), build); }
  function init() {
    scan(document);
    new MutationObserver(function (ms) { ms.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) { if (n.matches && n.matches('.marley')) build(n); else scan(n); } }); }); })
      .observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
