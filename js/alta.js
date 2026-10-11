/* A.L.T.A.'s PLAYER: a Listen bar (section.listen.alta, data-narrator="alta") where she tells the episode from her
   tank (css/alta.css; her parts in assets/alta/parts, made from Christian's renders: assets/alta/KIT.md).
   - Her mouth follows the voice: Web Audio measures how loud it is and where its sound sits (bright like "ee" or
     round like "oo"), and picks the nearest of her own mouth shapes; between words her lips close.
   - She blinks every few seconds, her irises glance, her tail sculls under the ledge, and while she talks she opens
     her palms now and then. Her eyes bloom cyan-green as she starts, and settle back when she stops.
   - Without an episode yet she still waits in her tank, and says her introduction is on its way.
   - On a Note with a palette, her crown's filigree and the botanicals in her hair wear its two colours (no hats: her
     masks are head-flair-a/b, pearl versions of those parts, dyed with multiply).
   - With reduced motion she holds still: no tail, glances, blinks or gestures; only her mouth moves.
   Built for each such bar on the page, and for any that arrive later (a Note opened in the homepage's story window,
   her Workshop window). GlazyArray's player (js/narrator.js) leaves these bars to her. */
(function () {
  'use strict';
  var P = '/assets/alta/parts/', V = '?v=3';
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SHAPES = ['smile', 'neutral', 'ah', 'oh', 'oo', 'ee', 'laugh'];
  var IC = {
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>', pause: '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zm6 0h4v14h-4z"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M12 5V2L7 6l5 4V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z"/></svg>', fwd: '<svg viewBox="0 0 24 24"><path d="M12 5V2l5 4-5 4V7a6 6 0 1 0 6 6h2a8 8 0 1 1-8-8z"/></svg>' };
  var ctx = null;
  function clock(s) { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }

  function build(bar) {
    if (bar.querySelector('.al-stage')) return;
    var audio = bar.querySelector('audio');
    var st = document.createElement('div'); st.className = 'al-stage'; st.setAttribute('aria-hidden', 'true');
    st.innerHTML = '<video class="al-tail" muted loop playsinline preload="none"></video>' +
      '<video class="al-palms" muted playsinline preload="none"></video>' +
      '<div class="al-head"><img class="al-base" src="' + P + 'head-base.webp' + V + '" alt="">' +
      ['a', 'b'].map(function (k) { return '<img class="al-pearl" src="' + P + 'head-flair-' + k + '.webp' + V + '" alt=""><i class="al-tint al-tint-' + k + '"></i>'; }).join('') +
      '<div class="al-eyes" style="position:absolute"><img src="' + P + 'head-iris.webp' + V + '" alt=""><i class="al-glow"></i></div>' +
      '<img class="al-lids" src="' + P + 'head-lids.webp' + V + '" alt=""><div class="al-mouth" style="position:absolute">' +
      SHAPES.map(function (k) { return '<img data-m="' + k + '" src="' + P + 'mouth-' + k + '.webp' + V + '" alt=""' + (k === 'smile' ? ' class="on"' : '') + '>'; }).join('') + '</div></div>';
    bar.insertBefore(st, bar.children[1] || null);
    // the Note's two colours (data-palette, from its hero): her crown's filigree takes the first, her hair's botanicals the second
    var pal = (bar.getAttribute('data-palette') || '').split(' ').filter(function (c) { return /^#[0-9a-f]{6}$/i.test(c); });
    if (pal.length) { bar.style.setProperty('--al1', pal[0]); bar.style.setProperty('--al2', pal[1] || pal[0]); bar.classList.add('has-pal'); }
    var lbl = bar.querySelector('.listen-label');
    if (lbl && !bar.querySelector('.al-by')) { var by = document.createElement('span'); by.className = 'al-by'; by.textContent = 'Narrated by A.L.T.A.'; lbl.parentNode.appendChild(by); }
    var tail = st.querySelector('.al-tail'), palms = st.querySelector('.al-palms'), head = st.querySelector('.al-head'), glow = st.querySelector('.al-glow'), eyes = st.querySelector('.al-eyes');
    var M = {}; [].forEach.call(st.querySelectorAll('.al-mouth img'), function (i) { M[i.getAttribute('data-m')] = i; });
    var cur = 'smile';
    function say(k) { if (k === cur || !M[k]) return; M[cur].classList.remove('on'); M[k].classList.add('on'); cur = k; }

    // her tail, while she's on screen
    if (!still) {
      tail.src = P + 'tail.mp4' + V;
      var vis = function (on) { if (on) { tail.preload = 'auto'; var p = tail.play(); if (p && p.catch) p.catch(function () {}); tail.classList.add('on'); } else tail.pause(); };
      if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { vis(es[0].isIntersecting); }).observe(st); else vis(true);
    }
    // blinks and glances
    if (!still) (function blink() {
      setTimeout(function () {
        if (!bar.isConnected) return;
        bar.classList.add('blink'); setTimeout(function () { bar.classList.remove('blink'); }, 130);
        if (Math.random() < 0.2) setTimeout(function () { bar.classList.add('blink'); setTimeout(function () { bar.classList.remove('blink'); }, 120); }, 300);
        blink();
      }, 2600 + Math.random() * 3800);
    })();
    if (!still) (function glance() {
      if (!bar.isConnected) return;
      var away = Math.random() < 0.45;
      eyes.style.setProperty('--gx', away ? ((Math.random() - .5) * 7).toFixed(1) + '%' : '0%');
      eyes.style.setProperty('--gy', away ? ((Math.random() - .4) * 4).toFixed(1) + '%' : '0%');
      setTimeout(glance, away ? 900 + Math.random() * 900 : 2200 + Math.random() * 3200);
    })();

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
    pp.onclick = function () { if (audio.paused) audio.play().catch(function () {}); else audio.pause(); };
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
    // a gesture now and then while she talks: her palms open, then she settles back to the ledge
    var gT = 0;
    if (!still) { palms.src = P + 'palms.mp4' + V; palms.addEventListener('timeupdate', function () { if (palms.duration && palms.currentTime > palms.duration - 0.6) palms.classList.remove('on'); }); }
    function gestures() {
      clearTimeout(gT); if (still || !talking) return;
      gT = setTimeout(function () { if (!talking) return; palms.currentTime = 0; palms.classList.add('on'); palms.play().catch(function () {}); gestures(); }, 12000 + Math.random() * 10000);
    }
    audio.addEventListener('play', function () {
      listen(); if (ctx && ctx.state === 'suspended') ctx.resume();
      talking = true; glow.style.backgroundColor = '#2fe8c0'; glow.style.opacity = '.35'; eyes.style.setProperty('--dil', '1.05');
      gestures(); if (!raf) raf = requestAnimationFrame(tick);
    });
    ['pause', 'ended'].forEach(function (t) { audio.addEventListener(t, function () { talking = false; clearTimeout(gT); glow.style.opacity = '0'; eyes.style.removeProperty('--dil'); }); });
  }

  function scan(root) { (root.querySelectorAll ? root : document).querySelectorAll('section.listen.alta').forEach(build); }
  function start() {
    scan(document);
    new MutationObserver(function (ms) { ms.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) { if (n.matches && n.matches('section.listen.alta')) build(n); else scan(n); } }); }); })
      .observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
