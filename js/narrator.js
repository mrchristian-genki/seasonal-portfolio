/* THE NARRATOR, GlazyArray: a little brass robot in each Listen bar (section.listen with an <audio>) that tells the episode.
   Its torso and hands are one video (assets/narrator/narrator.mp4, green screen keyed onto the bar's colour) in fourteen
   8-second parts, every one starting and ending in the same rest pose: the fingers tapping; four gestures, each
   followed by the same played backwards (her arms opened wide like a storyteller, a little seated hand dance, a brass
   ball that appears in her hand, both hands talking along); parts 3 and 4 just hold the rest pose (a heart drawn in
   light was there, and came out); and three hints. The robot moves only by jumping
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
  var A = '/assets/narrator/', V = '?v=26', DROP = 0.0448;   // the chin plate's drop, as a share of the head layer's height (the side plates go half as far)
  var D = 193 / 24, IDLE = 0, GESTURES = [{ f: 1, r: 2 }, { f: 8, r: 9 }, { f: 10, r: 11 }, { f: 12, r: 13 }];   // the parts of narrator.mp4: forward and backwards copies
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
  var WARDROBE = [], ALL = {}, CATS = {}, BDS = {}, CATBD = {}, CURLS = A + 'head-base.webp' + V;
  var looks = fetch(A + 'looks.json' + V, { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : { looks: [] }; }).catch(function () { return { looks: [] }; }).then(function (j) {
    var list = (j && j.looks) || [], d = new Date();
    ALL = { curls: { name: 'curls' } }; list.forEach(function (l) { ALL[l.name] = l; }); CATS = (j && j.categories) || {};
    ((j && j.backdrops) || []).forEach(function (b) { BDS[b.name] = b; }); CATBD = (j && j.categoryBackdrops) || {};
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
  // ...and failing that, the look its categories give it (looks.json "categories": every case study in her
  // mortarboard). Which look shows: the Note's own, else its category's, else the holiday look.
  function own(nb) {
    var bar = nb.closest('section.listen'); if (!bar) return null;
    var n = bar.getAttribute('data-look'); if (n && ALL[n]) return ALL[n];
    // two categories with different looks and none picked for the Note: the holiday look (Christian, Oct 6, 2026:
    // the editor picks one in the Studio while drafting)
    var cats = (bar.getAttribute('data-cats') || '').split(' '), found = [];
    cats.forEach(function (c) { var l = CATS[c] && ALL[CATS[c]]; if (l && found.indexOf(l) < 0) found.push(l); });
    return found.length === 1 ? found[0] : null;
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

  // HER BACKDROP (looks.json "backdrops", made in the Studio): a softly blurred scene behind the whole bar, a library for
  // a case study, a bike shop for a ride. Chosen like her look: the Note's own (data-backdrop), else the one its
  // categories give it (a single one; two different and none picked: none), else the bar's plain teal.
  function ownBd(bar) {
    var n = bar.getAttribute('data-backdrop'); if (n && BDS[n]) return BDS[n];
    var found = [];
    (bar.getAttribute('data-cats') || '').split(' ').forEach(function (c) { var b = CATBD[c] && BDS[CATBD[c]]; if (b && found.indexOf(b) < 0) found.push(b); });
    return found.length === 1 ? found[0] : null;
  }
  function backdrop(bar, nb) {
    looks.then(function () {
      var b = ownBd(bar); if (!b || bar.querySelector('.nb-bd')) return;
      var w = document.createElement('div'), i = document.createElement('i'); w.className = 'nb-bd'; w.setAttribute('aria-hidden', 'true');
      i.style.backgroundImage = 'url(' + A + 'backdrops/' + b.file + V + (b.v ? '.' + b.v : '') + ')';
      w.appendChild(i); bar.insertBefore(w, bar.firstChild); bar.classList.add('has-bd');
      keyer(nb);   // over a scene, her body's teal comes out
    });
  }
  // her body's video is on the bar's teal (#0f4d47); over a backdrop a little WebGL pass keys the teal out (alpha from
  // the distance to it, the teal unmixed from the edges) and draws her into a canvas over the hidden video
  var LQ = 'data:image/webp;base64,UklGRoQCAABXRUJQVlA4IHgCAADwDgCdASqCACgAPrVSoEwnJKaiKrVbGOAWiWIAz9oNP8vwzrm3g55nTM96GRuE44VXd2kTU14W4BR6I26vfLOm3ThBQoHGvcwxzBz4VpbgtaUy59Xw6F1BWvNJFWDERV1jixpT25hBibdx3QfoYebO/MxXqlVgz5Eb/VazJKRiAAD+8iHc+/T7o8md12qpHabjT2iyHnSYHd/jZ9M+a0DnyvZhjnVVBObhhE8kRnmZMUtgw4ItMsoK6Er/Xyzk2Oyct7Q1wvSj4HszlDmSIDVHW+0mcHFLHu24GwnPcJ+aR9xmgWwGwjOsWEbDVk6O1Avd3O1NzEu3X7iDwCBB0ybcaak5LWVcmmUaeBy9PcfiA8iTbW1u34lbFMEBDVQ2gD6NZ7ilveY1dJr8e1564nBZNoIGN1MuTxmvfScte8jAGRjiiYHHoQsbi5dQtNuCW3F6jtQwQc/FwEwDN+UrcnMvao4tvarJIvWqvFW7fv+deMZ6PLv4XdEi9K9xtqmR2p0lWspwiZ/zD87xVIWboYlu6Ivnl9qVnkHLxMpDwwxVR/kEweYvWsKWJBx46WX8k6Fke5hogJFaKUSQjD6fdQ7jL2UOLtX2xjJ+i28F4rwpHYap7W+lbyYu5y2zUWTa9M38Gl5+Ty8SlImRKBKFgw6xX4Vr+RKvVh2kFz6f2mnnTLI+LtDv/tS5ev4ito8HSxHUCFgZnyIswj1SyQbGYWsWnoW4tmkWtYnLVUZF7Y8uwxJhd1xCB33Nq5MDI+dSQRgrIJD2BYOA8u0lG8UT2DK9dJdpxv3LKBLS0kaaS+2rQvYYoUw65iKhBv5O4wkW1chL4TNRKAAAAA==';
  function keyer(nb) {
    var v = nb.querySelector('.nb-body'), c = document.createElement('canvas'); c.width = 976; c.height = 300; c.className = 'nb-keyed';
    var gl = c.getContext('webgl', { premultipliedAlpha: true, alpha: true }); if (!gl) return;
    function sh(t, src) { var o = gl.createShader(t); gl.shaderSource(o, src); gl.compileShader(o); return o; }
    var pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 p;varying vec2 v;void main(){v=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}'));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, 'precision mediump float;uniform sampler2D t;varying vec2 v;const vec3 T=vec3(15.,77.,71.)/255.;' +
      'void main(){vec3 c=texture2D(t,v).rgb;float a=clamp((distance(c,T)*255.-14.)/40.,0.,1.);vec3 o=clamp((c-(1.-a)*T)/max(a,.001),0.,1.);gl_FragColor=vec4(o*a,a);}'));
    gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(function (k) { gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE); });
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    var rest = new Image(), lq = new Image(), last = null;
    rest.src = A + 'rest.jpg' + V; lq.src = LQ;
    function draw(src) { try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); } catch (e) {} }
    v.parentNode.insertBefore(c, v.nextSibling); nb.classList.add('nb-keying');
    (function tick() {
      if (!c.isConnected) return;
      // the video's frame once it has one; until then the rest pose, or its tiny copy
      if (v.readyState >= 2) { if (last !== v.currentTime) { last = v.currentTime; draw(v); } }
      else if (rest.complete && rest.naturalWidth) { if (last !== 'rest') { last = 'rest'; draw(rest); } }
      else if (lq.complete && lq.naturalWidth && last !== 'lq') { last = 'lq'; draw(lq); }
      requestAnimationFrame(tick);
    })();
  }

  // THE PLAYER: the bar's title and her name sit on a glass card with its own controls (play, a scrubber with the
  // times, 15 seconds back and on), over the plain audio element, which stays for the sound and the narrator
  var IC = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4h4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><text x="12" y="15.2" text-anchor="middle" font-size="7" font-weight="700" fill="currentColor">15</text></svg>',
    fwd: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v4h-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><text x="12" y="15.2" text-anchor="middle" font-size="7" font-weight="700" fill="currentColor">15</text></svg>' };
  function clock(t) { t = Math.max(0, Math.round(t || 0)); return Math.floor(t / 60) + ':' + ('0' + t % 60).slice(-2); }
  function player(bar, audio) {
    if (bar.querySelector('.nb-glass')) return;
    var g = document.createElement('div'); g.className = 'nb-glass';
    [].slice.call(bar.children).forEach(function (k) { if (!k.matches('.nb,.nb-plate,.nb-bd')) g.appendChild(k); });
    var p = document.createElement('div'); p.className = 'nb-player';
    p.innerHTML = '<div class="nb-row"><span class="nb-t0">0:00</span><input class="nb-seek" type="range" min="0" max="1000" step="1" value="0" aria-label="Where in the episode"><span class="nb-t1">' +
      (/(\d+:\d\d)/.exec((bar.querySelector('.listen-label') || {}).textContent || '') || [, '0:00'])[1] + '</span></div>' +
      '<div class="nb-ctl"><button type="button" class="nb-b15" aria-label="Back 15 seconds">' + IC.back + '</button><button type="button" class="nb-pp" aria-label="Play">' + IC.play + '</button>' +
      '<button type="button" class="nb-f15" aria-label="On 15 seconds">' + IC.fwd + '</button></div>';
    g.appendChild(p); bar.appendChild(g);
    audio.classList.add('nb-audio');   // its own controls stay on but out of sight (an audio without them can't be shown at all)
    var seek = p.querySelector('.nb-seek'), pp = p.querySelector('.nb-pp'), t0 = p.querySelector('.nb-t0'), t1 = p.querySelector('.nb-t1'), dragging = false;
    function show() {
      var d = audio.duration || 0, f = d ? audio.currentTime / d : 0;
      if (!dragging) seek.value = Math.round(f * 1000);
      seek.style.setProperty('--p', (seek.value / 10) + '%');
      t0.textContent = clock(audio.currentTime); if (d && isFinite(d)) t1.textContent = clock(d);
      var on = !audio.paused; pp.innerHTML = on ? IC.pause : IC.play; pp.setAttribute('aria-label', on ? 'Pause' : 'Play'); g.classList.toggle('nb-on', on);
    }
    ['timeupdate', 'play', 'pause', 'loadedmetadata', 'durationchange', 'ended'].forEach(function (e) { audio.addEventListener(e, show); });
    pp.addEventListener('click', function () { if (audio.paused) audio.play().catch(function () {}); else audio.pause(); });
    p.querySelector('.nb-b15').addEventListener('click', function () { audio.currentTime = Math.max(0, audio.currentTime - 15); });
    p.querySelector('.nb-f15').addEventListener('click', function () { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 15); });
    seek.addEventListener('input', function () { dragging = true; seek.style.setProperty('--p', (seek.value / 10) + '%'); if (audio.duration) t0.textContent = clock(seek.value / 1000 * audio.duration); });
    seek.addEventListener('change', function () { dragging = false; if (audio.duration) audio.currentTime = seek.value / 1000 * audio.duration; show(); });
    show();
  }

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
    wear(nb); backdrop(bar, nb); player(bar, audio);
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
    function inGesture(part) { return GESTURES.some(function (x) { return x.f === part || x.r === part; }); }
    // the voice stopped: to the nearer rest pose, the end of this part or (by the backwards copy) its start
    function settle() {
      var t = body.currentTime, part = Math.floor((t + 0.02) / D), local = Math.max(0, t - part * D);   // a hair of margin: a jump lands right on a part's first frame
      if (!inGesture(part) || !plan) return;
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
      if (!still) { var part = Math.floor((body.currentTime + 0.02) / D); if (hint) endHint(); if (!plan || !inGesture(part)) gesture(); }   // from tapping, a hint or rest, straight into a gesture
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
