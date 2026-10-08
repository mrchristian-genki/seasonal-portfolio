/* THE TUMBLE (web/index.html): as you scroll, the year counter falls from 2026 to 1997 (each era runs its own years
   from top to bottom), the bar takes on the era you're in, and the props and big years drift and spin at their own
   depths. The 2000s intro loads and can be skipped; the 1990s hit counter ticks. Reduced motion: the counter and
   the bar still follow you, nothing moves. */
(function () {
  'use strict';
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var eras = [].slice.call(document.querySelectorAll('.era')), end = document.querySelector('.tb-end');
  var yearEl = document.querySelector('[data-tb-year]'), browserEl = document.querySelector('[data-tb-browser]');
  var props = [].slice.call(document.querySelectorAll('[data-depth]'));
  var root = document.documentElement, shownYear = 2026, ticking = false, lastY = scrollY, lastT = performance.now();
  var now = document.querySelector('[data-now]');

  function frame() {
    ticking = false;
    var vh = innerHeight, mid = vh * 0.5, year = 2026, era = 'e26', label = eras[0].getAttribute('data-browser');
    // the era whose band crosses the middle of the screen, and how far through it we are
    for (var i = 0; i < eras.length; i++) {
      var r = eras[i].getBoundingClientRect();
      if (r.top <= mid && r.bottom > mid) {
        var t = Math.min(1, Math.max(0, (mid - r.top) / r.height)), from = +eras[i].getAttribute('data-from'), to = +eras[i].getAttribute('data-to');
        year = Math.round(from + (to - from) * t); era = eras[i].getAttribute('data-era'); label = eras[i].getAttribute('data-browser'); break;
      }
      if (r.bottom <= mid) { year = +eras[i].getAttribute('data-to'); era = eras[i].getAttribute('data-era'); label = eras[i].getAttribute('data-browser'); }
    }
    if (end && end.getBoundingClientRect().top < mid) { year = 1997; era = 'end'; }
    if (now && now.getBoundingClientRect().bottom > mid) era = 'now';
    tapeAt(year);
    if (year !== shownYear) { yearEl.textContent = year; shownYear = year; toolbox(year); needle('year', 2026 - year, 29); }
    if (root.getAttribute('data-era') !== era) { root.setAttribute('data-era', era); browserEl.textContent = label; }
    // 88: fall fast enough and the machine flashes
    var t1 = performance.now(), sy = scrollY, v = Math.abs(sy - lastY) / Math.max(16, t1 - lastT) * 30;
    lastY = sy; lastT = t1;
    if (!still && v >= 88) flux();
    needle('speed', Math.min(120, v));
    if (still) return;
    // the parallax: each prop moves against the scroll by its depth, and turns as it falls
    for (var k = 0; k < props.length; k++) {
      var p = props[k], box = p.parentNode.getBoundingClientRect();
      if (box.bottom < -200 || box.top > vh + 200) continue;
      var d = +p.getAttribute('data-depth'), off = (box.top + box.height / 2 - mid), spin = +(p.getAttribute('data-spin') || 0);
      p.style.transform = 'translate3d(0,' + (off * (d - 0.5) * 0.6).toFixed(1) + 'px,0) rotate(' + (spin * off / vh).toFixed(1) + 'deg)';
    }
  }
  // the toolbox: each browser badge and each tool fades in once its year comes round, and out again as you fall past it
  var tbx = [].slice.call(document.querySelectorAll('.tbx-g li')), tbxN = document.querySelectorAll('[data-tbx-count]');
  var brs = [].slice.call(document.querySelectorAll('[data-tbx-br] li'));
  function toolbox(y) {
    var n = 0;
    tbx.forEach(function (li) { var have = y >= +li.getAttribute('data-y'); if (have) n++; li.classList.toggle('off', !have); });
    [].forEach.call(tbxN, function (e) { e.textContent = n; });
    if (typeof needle === 'function') needle('tools', n, tbx.length);
    brs.forEach(function (li) {
      var b = +li.getAttribute('data-b'), e = +(li.getAttribute('data-e') || 9999), on = y >= b && y <= e;
      li.classList.toggle('off', !on);
      var nm = li.querySelector('.sr').textContent;
      li.title = nm + (y < b ? ': not yet (' + b + ')' : y > e ? ': gone since ' + e : ': since ' + b);
    });
  }
  var tbBtn = document.querySelector('[data-tbx-open]'), tbBox = document.getElementById('tbBox');
  if (tbBtn) tbBtn.addEventListener('click', function () { var o = tbBox.classList.toggle('open'); tbBtn.setAttribute('aria-expanded', String(o)); document.documentElement.classList.toggle('tbx-open', o); });
  // the tape: each year's mark sits where that year is reached in the scroll, each era is a band in its colour; the
  // marker follows you, and a click or a drag on the tape takes you there
  var tape = document.querySelector('[data-tape]'), tMark = document.querySelector('[data-tape-mark]'), tTicks = document.querySelector('[data-tape-ticks]'), tBands = document.querySelector('[data-tape-bands]');
  var COL = { e26: '#6ee7b7', e15: '#e91e63', e10: '#c8a060', e05: '#3a9bd8', e00: '#7fd1ff', e97: '#800000' }, marks = [], maxY = 1;
  function eraY(el, y) { var top = el.getBoundingClientRect().top + scrollY, f = +el.getAttribute('data-from'), t = +el.getAttribute('data-to'); return top + el.offsetHeight * (f - y) / (f - t) - innerHeight / 2; }
  function layTape() {
    if (!tape) return;
    maxY = Math.max(1, document.documentElement.scrollHeight - innerHeight); marks = [];
    var h = '', b = '', pct = function (y) { return (Math.min(1, Math.max(0, y / maxY)) * 100).toFixed(2) + '%'; };
    eras.forEach(function (el) {
      var f = +el.getAttribute('data-from'), t = +el.getAttribute('data-to'), y0 = eraY(el, f), y1 = eraY(el, t);
      b += '<i style="top:' + pct(y0) + ';height:' + ((Math.min(maxY, y1) - Math.max(0, y0)) / maxY * 100).toFixed(2) + '%;--c:' + COL[el.getAttribute('data-era')] + '"></i>';
      for (var y = f; y >= t; y--) if (!marks.some(function (m) { return m.y === y; })) marks.push({ y: y, at: eraY(el, y) });
    });
    marks.forEach(function (m) { var big = m.y % 5 === 0 || m.y === 1997; h += '<i class="' + (big ? 'big' : '') + '" style="top:' + pct(m.at) + '"></i>' + (big ? '<b style="top:' + pct(m.at) + '">' + m.y + '</b>' : ''); });
    tTicks.innerHTML = h; tBands.innerHTML = b; tapeAt(shownYear, true);
  }
  function tapeAt(y) {
    if (!tape) return;
    tMark.style.top = (Math.min(1, scrollY / maxY) * 100).toFixed(2) + '%';
    tMark.firstChild.textContent = scrollY < 40 ? 'Now' : y; tape.setAttribute('aria-valuenow', y); tape.setAttribute('aria-valuetext', scrollY < 40 ? 'Now, 2026' : String(y));
  }
  function goYear(y) { var m = marks.filter(function (k) { return k.y === y; })[0]; if (m) tumbleTo(Math.max(0, m.at + 1)); }
  if (tape) {
    var drag = false, sx = 0;
    var toY = function (e) { var r = tape.getBoundingClientRect(); return Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) * maxY; };
    tape.addEventListener('pointerdown', function (e) { drag = true; sx = e.clientY; tape.setPointerCapture(e.pointerId); tape.classList.add('drag'); });
    tape.addEventListener('pointermove', function (e) { if (drag && Math.abs(e.clientY - sx) > 4) { root.style.scrollBehavior = 'auto'; scrollTo(0, toY(e)); } });
    tape.addEventListener('pointerup', function (e) {
      if (!drag) return; drag = false; tape.classList.remove('drag'); root.style.scrollBehavior = '';
      if (Math.abs(e.clientY - sx) <= 4) tumbleTo(toY(e));
    });
    tape.addEventListener('keydown', function (e) {
      var d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 5, PageDown: -5 }[e.key];
      if (e.key === 'Home') { e.preventDefault(); tumbleTo(0); return; }
      if (e.key === 'End') { e.preventDefault(); goYear(1997); return; }
      if (d) { e.preventDefault(); goYear(Math.min(2026, Math.max(1997, shownYear + d)), true); }
    });
    addEventListener('resize', layTape); addEventListener('load', layTape); layTape();
    if ('ResizeObserver' in window) new ResizeObserver(function () { layTape(); }).observe(document.querySelector('main'));
  }

  // the top: the readouts (where you're headed, today, your last visit) and the chart of what the browser can do
  var tcNow = document.querySelector('[data-tc-now]'), tcLast = document.querySelector('[data-tc-last]');
  var MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  var stamp = function (d) { return MON[d.getMonth()] + ' ' + ('0' + d.getDate()).slice(-2) + ' ' + d.getFullYear() + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); };
  if (tcNow) {
    var tcNow2 = document.querySelector('[data-tc-now2]'), tcLast2 = document.querySelector('[data-tc-last2]');
    var tick = function () { tcNow.textContent = tcNow2.textContent = stamp(new Date()); }; tick(); setInterval(tick, 10000);
    try { var last = localStorage.getItem('tumble-last'); if (last) tcLast.textContent = tcLast2.textContent = stamp(new Date(+last)); localStorage.setItem('tumble-last', String(Date.now())); } catch (e) {}
  }
  // the cockpit: the render scaled to cover its frame (left-aligned on wide screens, centred on the big dial on
  // phones); its needles swing from -120 to 120 degrees, for the year, the fall speed and the toolbox
  var room = document.querySelector('[data-tm-room]'), view = room && room.parentNode;
  function fitRoom() {
    if (!room) return;
    var W = view.clientWidth, H = view.clientHeight, k = Math.max(W / 1376, H / 768), x = W <= 760 ? Math.min(0, Math.max(W - 1376 * k, W / 2 - 688 * k)) : 0;
    room.style.transform = 'translate(' + x.toFixed(1) + 'px,' + ((H - 768 * k) / 2).toFixed(1) + 'px) scale(' + k.toFixed(4) + ')';
  }
  addEventListener('resize', fitRoom); fitRoom();
  function needle(k, v, max) { var n = room && room.querySelector('[data-nd="' + k + '"]'); if (n) n.style.setProperty('--a', (-120 + 240 * Math.max(0, Math.min(1, v / (max || 120)))).toFixed(1) + 'deg'); }
  needle('year', 2026 - shownYear, 29);
  function flux() {
    if (root.classList.contains('flux')) return;
    root.classList.add('flux'); setTimeout(function () { root.classList.remove('flux'); }, 900);
  }
  // the browsers under glass: a pick falls to the year that browser arrived (before 1997, to the very bottom)
  // a pick tumbles you down to it: a slow, eased scroll (several seconds, longer the further you go), which a wheel, a touch
  // or a key stops at once
  var tumbleRaf = 0;
  function tumbleTo(top) {
    cancelAnimationFrame(tumbleRaf);
    if (still) { scrollTo(0, top); return; }
    var from = scrollY, d = top - from, dur = Math.min(11000, Math.max(2000, Math.abs(d) / 1.5)), t0 = performance.now();
    root.style.scrollBehavior = 'auto';
    var stop = function () { cancelAnimationFrame(tumbleRaf); root.style.scrollBehavior = ''; ['wheel', 'touchstart', 'keydown'].forEach(function (e) { removeEventListener(e, stop); }); };
    ['wheel', 'touchstart', 'keydown'].forEach(function (e) { addEventListener(e, stop, { passive: true }); });
    (function step(now) {
      var k = Math.min(1, (now - t0) / dur), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      scrollTo(0, from + d * e);
      if (k < 1) tumbleRaf = requestAnimationFrame(step); else stop();
    })(t0);
  }
  // the jewels and their console buttons: hover or focus shows the browser's up-close render in the dial's face with
  // the year it arrived; a tap or click on a jewel holds it there and wakes its button on the console below in a slow,
  // big glow. Nothing scrolls until the year in the dial itself is picked: then a slow tumble down to it.
  var close = document.querySelector('.tm-close'), closeImg = close && close.querySelector('img'), closeYr = close && close.querySelector('b'), held = 0, heldY = 0;
  var jwls = [].slice.call(document.querySelectorAll('.tm-jw')), brbs = [].slice.call(document.querySelectorAll('.tm-hb.br'));
  function showClose(k, y) { closeImg.src = 'media/closeup/' + k + '.webp'; closeYr.textContent = y; close.classList.add('on'); }
  function hideClose() { if (!held) close.classList.remove('on'); }
  function release() { clearTimeout(held); held = 0; close.classList.remove('on', 'held'); close.setAttribute('tabindex', '-1'); }
  [].forEach.call(document.querySelectorAll('[data-close]'), function (b, n) {
    var k = b.getAttribute('data-close'), y = (jwls.filter(function (j) { return j.getAttribute('data-close') === k; })[0] || b).getAttribute('data-b');
    (new Image()).src = 'media/closeup/' + k + '.webp';
    var show = function () { if (!held) showClose(k, y); };
    b.addEventListener('mouseenter', show); b.addEventListener('focus', show); b.addEventListener('mouseleave', hideClose); b.addEventListener('blur', hideClose);
  });
  jwls.forEach(function (b, i) {
    b.addEventListener('click', function () {
      heldY = +b.getAttribute('data-b'); showClose(b.getAttribute('data-close'), heldY);
      close.classList.add('held'); close.setAttribute('tabindex', '0'); close.setAttribute('aria-label', 'Tumble down to ' + heldY);
      clearTimeout(held); held = setTimeout(release, 9000);
      brbs.forEach(function (h) { h.classList.remove('mega'); });
      var h = brbs[i]; if (!h) return; void h.offsetWidth; h.classList.add('mega');
      clearTimeout(h._mega); h._mega = setTimeout(function () { h.classList.remove('mega'); }, 9000);
    });
  });
  function goHeld() {
    if (!held) return; var y = heldY; release();
    brbs.forEach(function (h) { h.classList.remove('mega'); });
    if (y < 1997) { if (end) tumbleTo(end.getBoundingClientRect().top + scrollY); } else goYear(y);
  }
  if (close) {
    close.addEventListener('click', goHeld);
    close.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goHeld(); } });
  }
  // the jewels: all lit, and slow patterns run through them, only while the cockpit is on screen. On shuffle (the
  // default) a new pattern comes up every few seconds; the console's own buttons pick one, set the speed, flash them,
  // switch the power and the portholes, spin the needles, or hit 88
  var jw = [].slice.call(document.querySelectorAll('.tm-jw')), jwSeen = true, rnd = null;
  jw.forEach(function (b) { var i = b.querySelector('img'); if (i) { var u = i.cloneNode(); u.className = 'unlit'; i.after(u); } });
  function jset(f) { jw.forEach(function (b, i) { b.classList.toggle('off', !!f(i)); }); }
  var PAT = {
    chase: function (t) { return function (i) { return i === t % 9; }; },
    alt: function (t) { return function (i) { return (i + t) % 2; }; },
    random: function (t) { if (t % 4 === 0 || !rnd) rnd = jw.map(function () { return Math.random() < .4; }); return function (i) { return rnd[i]; }; },
    sweep: function (t) { return function (i) { return i < (t % 18 < 9 ? t % 9 : 9 - t % 9); }; },
    ripple: function (t) { return function (i) { return Math.abs(i - 4) === t % 5; }; },
    twinkle: function () { return function () { return Math.random() < .3; }; },
    comet: function (t) { return function (i) { var d = (t - i + 900) % 9; return d > 2; }; },
    on: function () { return function () { return false; }; },
    off: function () { return function () { return true; }; }
  };
  // the console: a button for each browser (in its colour) switches its jewel; one switches them all; one plays the
  // patterns, a new one at random every few seconds. Every light eases on and off (tumble.css).
  var SHUF = ['chase', 'alt', 'random', 'sweep', 'ripple', 'twinkle', 'comet'], playing = false, pat = PAT.on, step = 0, speed = 3, jwTimer = 0;
  var SPD = [0, 1500, 1200, 950, 750, 560];
  var hbs = [].slice.call(document.querySelectorAll('.tm-hb')), brb = hbs.filter(function (h) { return h.classList.contains('br'); });
  function sync() { brb.forEach(function (h, i) { h.classList.toggle('lit', !jw[i].classList.contains('off')); }); }
  function setJ(f) { jset(f); sync(); }
  function tickJ() {
    clearTimeout(jwTimer); if (!playing || still) return;
    jwTimer = setTimeout(tickJ, SPD[speed]);
    if (!jwSeen || document.hidden || root.classList.contains('tm-dark')) return;
    if (step % 10 === 0) pat = Math.random() < .25 ? PAT.on : PAT[SHUF[Math.floor(Math.random() * SHUF.length)]];
    setJ(pat(step)); step++;
  }
  if (jw.length) {
    tickJ();
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { jwSeen = es[0].isIntersecting; if (!jwSeen && playing) setJ(PAT.on()); }).observe(document.querySelector('.tm-view'));
  }
  function lit(sel, on) { hbs.forEach(function (h) { if (h.matches(sel)) h.classList.toggle('lit', on); }); }
  function press(h) { h.classList.add('pz'); setTimeout(function () { h.classList.remove('pz'); }, 260); }
  function showSpeed() { hbs.forEach(function (h) { var m = /^s:(\d)/.exec(h.getAttribute('data-act')); if (m) h.classList.toggle('lit', +m[1] <= speed); }); }
  function stopPlay() { playing = false; clearTimeout(jwTimer); lit('[data-act="play"]', false); }
  function burst() { root.classList.remove('tm-burst'); void root.offsetWidth; root.classList.add('tm-burst'); setTimeout(function () { root.classList.remove('tm-burst'); }, 1700); }
  function spin() { if (still) return; root.classList.add('tm-spin'); setTimeout(function () { root.classList.remove('tm-spin'); }, 1100); }
  lit('[data-act="play"]', false); lit('[data-act="all"]', true); lit('[data-act="power"]', true); lit('[data-act="ports"]', true); showSpeed(); sync();
  hbs.forEach(function (h) {
    h.addEventListener('click', function () {
      var a = h.getAttribute('data-act'); press(h);
      if (a === 'power') { var dark = root.classList.toggle('tm-dark'); lit('[data-act="power"]', !dark); setJ(dark ? PAT.off() : PAT.on()); return; }
      if (root.classList.contains('tm-dark')) return;
      if (a.indexOf('b:') === 0) { if (playing) { stopPlay(); jset(PAT.on()); } var j = jw[+a.slice(2)]; j.classList.toggle('off'); sync(); }
      else if (a === 'all') { stopPlay(); var anyOn = jw.some(function (j) { return !j.classList.contains('off'); }); setJ(anyOn ? PAT.off() : PAT.on()); h.classList.toggle('lit', !anyOn); }
      else if (a === 'play') { if (playing) { stopPlay(); setJ(PAT.on()); } else { playing = true; step = 0; h.classList.add('lit'); tickJ(); } }
      else if (a.indexOf('s:') === 0) { speed = +a.slice(2); showSpeed(); if (playing) tickJ(); }
      else if (a === 'speed') { speed = speed % 5 + 1; showSpeed(); if (playing) tickJ(); var kk = ((parseFloat(h.style.getPropertyValue('--k')) || 0) + 72) % 360; h.style.setProperty('--k', kk + 'deg'); h.classList.add('turned'); }
      else if (a === 'lamp') { h.classList.toggle('lit'); burst(); }
      else if (a === 'go') { flux(); spin(); }
      else if (a === 'spin') { spin(); var k = ((parseFloat(h.style.getPropertyValue('--k')) || 0) + 60) % 360; h.style.setProperty('--k', k + 'deg'); h.classList.add('turned'); }
      else if (a === 'ports') { var off = root.classList.toggle('tm-noports'); lit('[data-act="ports"]', !off); }
    });
  });

  var chart = document.querySelector('[data-tm-chart]');
  if (chart) {
    var GC = ['#7dff4a', '#ff4fd8', '#ffb31f', '#38c8ff', '#b07bff'], groups = [].slice.call(document.querySelectorAll('.tbx-g')), Y0 = 1993, Y1 = 2026, W = 600, H = 250;
    var x = function (y) { return 24 + (y - Y0) / (Y1 - Y0) * (W - 30); }, yy = function (n) { return H - n / 36 * (H - 10); };
    var base = []; for (var y = Y0; y <= Y1; y++) base.push(0);
    var svg = '<defs>' + GC.map(function (c, i) { return '<linearGradient id="tg' + i + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + c + '" stop-opacity=".95"/><stop offset="1" stop-color="' + c + '" stop-opacity=".25"/></linearGradient>'; }).join('') + '</defs>', key = '';
    groups.forEach(function (g, i) {
      var ys = [].map.call(g.querySelectorAll('li'), function (li) { return +li.getAttribute('data-y'); }), top = [], d;
      for (var k = 0; k <= Y1 - Y0; k++) top.push(base[k] + ys.filter(function (v) { return v <= Y0 + k; }).length);
      d = 'M' + x(Y0) + ',' + yy(base[0]);
      for (k = 0; k <= Y1 - Y0; k++) d += 'L' + x(Y0 + k) + ',' + yy(top[k]) + (k < Y1 - Y0 ? 'L' + x(Y0 + k + 1) + ',' + yy(top[k]) : '');
      for (k = Y1 - Y0; k >= 0; k--) d += 'L' + x(Y0 + k + (k < Y1 - Y0 ? 1 : 0)) + ',' + yy(base[k]) + 'L' + x(Y0 + k) + ',' + yy(base[k]);
      svg += '<path class="ar" style="--c:' + GC[i] + '" d="' + d + 'Z" fill="url(#tg' + i + ')" stroke="' + GC[i] + '" stroke-width="1"/>';
      key += '<span><i style="--c:' + GC[i] + '"></i>' + g.querySelector('h3').textContent + '</span>';
      base = top;
    });
    [1997, 2005, 2015, 2026].forEach(function (y) { svg += '<text x="' + x(y) + '" y="' + (H + 16) + '" text-anchor="middle">' + y + '</text><line x1="' + x(y) + '" x2="' + x(y) + '" y1="' + H + '" y2="' + (H + 4) + '" stroke="#9fb6c4"/>'; });
    svg += '<text x="' + (x(Y1) + 4) + '" y="' + (yy(base[Y1 - Y0]) + 4) + '" fill="#fff">' + base[Y1 - Y0] + '</text>';
    chart.innerHTML = svg; document.querySelector('[data-tm-key]').innerHTML = key;
  }
  // the gauges: each job's tools, and the browsers, in 1997 and now; the needles sweep from then to now when they come into view
  var gbox = document.querySelector('[data-tm-gauges]');
  if (gbox) {
    var rows = [].map.call(document.querySelectorAll('.tbx-g'), function (g) {
      var ys = [].map.call(g.querySelectorAll('li'), function (li) { return +li.getAttribute('data-y'); });
      return { n: g.querySelector('h3').textContent, a: ys.filter(function (y) { return y <= 1997; }).length, b: ys.length, max: ys.length };
    });
    var alive = function (y) { return [].filter.call(document.querySelectorAll('[data-tbx-br] li'), function (li) { return y >= +li.getAttribute('data-b') && y <= +(li.getAttribute('data-e') || 9999); }).length; };
    rows.push({ n: 'Browsers', a: alive(1997), b: alive(2026), max: 9 });
    var ang = function (v, m) { return (-120 + 240 * v / m).toFixed(1) + 'deg'; };
    gbox.innerHTML = rows.map(function (r) {
      return '<figure class="tm-g"><div class="dial"><img class="face" src="media/tm/gauge.webp" alt=""><img class="nd" src="media/tm/needle.webp" alt="" style="--a:' + ang(r.a, r.max) + '" data-to="' + ang(r.b, r.max) + '"></div><figcaption>' + r.n + '<b>' + r.a + ' &rarr; ' + r.b + '</b></figcaption></figure>';
    }).join('');
    var sweep = function () { [].forEach.call(gbox.querySelectorAll('.nd'), function (n, i) { setTimeout(function () { n.style.setProperty('--a', n.getAttribute('data-to')); }, still ? 0 : i * 180); }); };
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es, o) { if (es[0].isIntersecting) { o.disconnect(); sweep(); } }, { threshold: .4 }).observe(gbox); else sweep();
    needle('tools', rows.reduce(function (t, r, i) { return i < rows.length - 1 ? t + r.b : t; }, 0), 36);
  }

  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll); frame();

  // 2000–2004: the intro loads when it comes into view; "Skip intro" (or reaching 100%) folds it away
  var splash = document.querySelector('[data-tb-splash]');
  if (splash) {
    var pct = splash.querySelector('[data-tb-load]'), bar = splash.querySelector('[data-tb-bar]'), n = 0, timer = 0;
    var gone = function () { clearInterval(timer); splash.classList.add('gone'); };
    splash.querySelector('[data-tb-skip]').addEventListener('click', gone);
    var go = function () { if (timer) return; timer = setInterval(function () { n = Math.min(100, n + 1 + Math.floor(Math.random() * 3)); pct.textContent = n; bar.style.width = n + '%'; if (n >= 100) setTimeout(gone, 600); }, still ? 30 : 90); };
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es, o) { if (es[0].isIntersecting) { o.disconnect(); go(); } }, { threshold: .5 }).observe(splash); else go();
  }
  // 1997–1999: the visitor counter goes up while you're on the page
  var count = document.querySelector('[data-tb-count]');
  if (count && !still) { var c = 427; setInterval(function () { if (Math.random() < .35) { c++; count.textContent = ('000000' + c).slice(-6); } }, 2500); }
  // clips play only while they're on screen
  [].forEach.call(document.querySelectorAll('[data-tb-video]'), function (v) {
    if (still) { v.controls = true; return; }
    if (!('IntersectionObserver' in window)) { v.autoplay = true; return; }
    new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { var r = v.play(); if (r && r.catch) r.catch(function () {}); } else v.pause(); }); }, { threshold: .3 }).observe(v);
  });
  // the end: climb back up
  var up = document.querySelector('[data-tb-up]');
  if (up) up.addEventListener('click', function () { tumbleTo(0); });
  // set the browsers and tools for the year you start at (the top is 2026: the gone ones dim)
  toolbox(shownYear);
})();
