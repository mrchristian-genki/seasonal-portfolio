/* THE BOOK SHELF on the Books tab (css/shelf.css). A few real covers from the catalog (assets/shelf/shelf.json,
   small copies of /books/covers/) drift by as line art; every couple of seconds the next one in view is coloured
   in by a brush sweep (two rows, drifting opposite ways), the way the catalog's covers reveal their colour on hover, then goes back to line art.
   A hover or a focus colours one at once; each opens the catalog. It starts when the shelf is on screen. */
(function () {
  'use strict';
  var box = document.querySelector('[data-shelf]'); if (!box) return;
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var A = 'assets/shelf/', started = false, books = [];
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function card(b, i, dup) {
    var a = document.createElement('a'); a.className = 'bk';
    a.href = 'https://www.christiangehrke.com/books/'; a.target = '_blank'; a.rel = 'noopener';
    a.style.setProperty('--tilt', ((i * 37) % 5 - 2) * 0.6 + 'deg');
    if (dup) { a.tabIndex = -1; a.setAttribute('aria-hidden', 'true'); }
    a.setAttribute('aria-label', b.title + ' (' + b.series + '), in the catalog');
    a.innerHTML = '<span class="bk-art"><img class="c" alt="" loading="lazy" decoding="async" src="' + A + b.id + '-c.webp"><img class="b" alt="" loading="lazy" decoding="async" src="' + A + b.id + '-b.webp"></span>' +
      (b.published ? '<span class="bk-pub">Out now</span>' : '');
    a.addEventListener('mouseenter', function () { a.classList.add('lit'); });
    a.addEventListener('mouseleave', function () { a.classList.remove('lit'); });
    a.addEventListener('focus', function () { a.classList.add('lit'); });
    a.addEventListener('blur', function () { a.classList.remove('lit'); });
    return a;
  }
  function build(all) {   // two rows, drifting opposite ways; the published ones split between them
    [0, 1].forEach(function (k) {
      var list = all.filter(function (b, i) { return i % 2 === k; });
      var track = document.createElement('div'); track.className = 'shelf-track' + (k ? ' rev' : '');
      list.forEach(function (b, i) { track.appendChild(card(b, i * 2 + k, false)); });
      if (!still) list.forEach(function (b, i) { track.appendChild(card(b, i * 2 + k, true)); });   // a second copy, so the drift loops seamlessly
      box.appendChild(track);
    });
    books = [].slice.call(box.querySelectorAll('.bk'));
    slide(box);
    if (!still) cycle();
  }
  // the brush: the next cover in view gets coloured, holds, and goes back to line art
  var at = 0;
  function cycle() {
    setTimeout(function () {
      if (!document.hidden && box.offsetParent) {
        var r = box.getBoundingClientRect(), seen = books.filter(function (b) {
          var q = b.getBoundingClientRect(); return q.left > r.left + r.width * 0.1 && q.right < r.right - r.width * 0.1 && !b.matches(':hover');
        });
        if (seen.length) {
          var b = seen[at++ % seen.length]; b.classList.add('lit');
          setTimeout(function () { if (!b.matches(':hover') && b !== document.activeElement) b.classList.remove('lit'); }, 2600);
        }
      }
      cycle();
    }, 900);
  }
  function start() {
    if (started) return; started = true;
    fetch(A + 'shelf.json?v=2').then(function (r) { return r.json(); }).then(build).catch(function () { box.hidden = true; });
  }
  // THE ROWS MOVE BY HAND TOO (Christian, Oct 7, 2026): each row drifts on its own (opposite ways), and a finger or
  // a mouse can grab it and swipe; it glides on a little after a swipe, then picks the drift back up. Up and down
  // still scrolls the page. On a phone, the first tap on a cover colours it in (or scrolls a window), the second
  // opens it; a swipe never opens anything. A hover (mouse) pauses the drift, as before.
  function slide(shelf) {
    var tracks = [].slice.call(shelf.querySelectorAll('.shelf-track'));
    if (still) { shelf.classList.add('shelf-scroll'); return; }   // no drift: the rows just scroll sideways
    shelf.classList.add('shelf-js');
    var hover = false;
    shelf.addEventListener('mouseenter', function () { hover = true; }); shelf.addEventListener('mouseleave', function () { hover = false; });
    tracks.forEach(function (t, k) {
      var dir = k ? 1 : -1, secs = (k ? 125 : 110) * (innerWidth < 640 ? 0.64 : 1), x = 0, w = 0, v = 0, rest = 0, drag = null, prev = performance.now();
      function wrap() { w = t.scrollWidth / 2 || 1; while (x > 0) x -= w; while (x <= -w) x += w; }
      t.style.touchAction = 'pan-y';
      t.addEventListener('pointerdown', function (e) {
        if (e.button) return;
        drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, start: x, moved: 0, lx: e.clientX, lt: e.timeStamp, touch: e.pointerType !== 'mouse', side: false }; v = 0;
      });
      addEventListener('pointermove', function (e) {
        if (!drag || e.pointerId !== drag.id) return;
        var dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
        if (!drag.side && Math.abs(dx) < 6) { if (Math.abs(dy) > 10) drag = null; return; }   // up and down: the page scrolls
        drag.side = true; drag.moved = Math.max(drag.moved, Math.abs(dx));
        var dt = Math.max(1, e.timeStamp - drag.lt); v = (e.clientX - drag.lx) / dt * 1000; drag.lx = e.clientX; drag.lt = e.timeStamp;
        x = drag.start + dx; wrap(); t.style.transform = 'translate3d(' + x + 'px,0,0)';
        if (e.cancelable && drag.touch) e.preventDefault();
      }, { passive: false });
      function up(e) {
        if (!drag || (e && e.pointerId !== drag.id)) return;
        if (drag.side) { t._swiped = performance.now(); rest = performance.now() + 2200; }
        drag = null;
      }
      addEventListener('pointerup', up); addEventListener('pointercancel', up);
      // a swipe never opens a cover; on a phone, the first tap colours it in, the second opens it
      t.addEventListener('click', function (e) {
        var a = e.target.closest('a'); if (!a) return;
        if (t._swiped && performance.now() - t._swiped < 400) { e.preventDefault(); return; }
        if (matchMedia('(hover: none)').matches && !a.classList.contains('tapped')) {
          e.preventDefault(); [].forEach.call(shelf.querySelectorAll('.tapped'), function (o) { o.classList.remove('tapped', 'lit'); });
          a.classList.add('tapped', 'lit'); rest = performance.now() + 4000;
        }
      });
      (function step(now) {
        var dt = Math.min(0.05, (now - prev) / 1000); prev = now;
        if (!drag) {
          if (Math.abs(v) > 4) { x += v * dt; v *= Math.pow(0.04, dt); }   // the glide after a swipe
          else if (!hover && now > rest && !document.hidden) { wrap(); x += dir * (w / secs) * dt; }
          wrap(); t.style.transform = 'translate3d(' + x + 'px,0,0)';
        }
        requestAnimationFrame(step);
      })(prev);
    });
  }
  function when(el, fn) {   // fn once el comes near the screen
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es, o) { if (es.some(function (e) { return e.isIntersecting; })) { o.disconnect(); fn(); } }, { rootMargin: '300px' }).observe(el);
    else fn();
  }
  when(box, start);

  // THE WEB SHELF on the Web tab: real pages (assets/webshelf/, screenshots of the live sites) in little browser
  // windows, two rows drifting opposite ways; one at a time scrolls down its whole page and back, and a hover scrolls one
  var web = document.querySelector('[data-webshelf]');
  if (web) when(web, function () {
    fetch('assets/webshelf/web.json?v=1').then(function (r) { return r.json(); }).then(function (all) {
      var wins = [];
      function win(w, i, dup) {
        var a = document.createElement('a'); a.className = 'win'; a.href = w.url; a.target = '_blank'; a.rel = 'noopener';
        a.style.setProperty('--tilt', ((i * 37) % 5 - 2) * 0.5 + 'deg');
        a.style.setProperty('--to', -Math.max(0, (1 - 325 / w.h) * 100).toFixed(1) + '%');   // the view is 16:10 of a 520-wide page
        if (dup) { a.tabIndex = -1; a.setAttribute('aria-hidden', 'true'); }
        a.setAttribute('aria-label', w.title + ' (' + w.host + ')');
        a.innerHTML = '<span class="win-bar"><i></i><i></i><i></i><span></span></span><span class="win-view"><img alt="" loading="lazy" decoding="async" src="assets/webshelf/' + w.id + '.webp?v=1"></span>';
        a.addEventListener('mouseenter', function () { a.classList.add('lit'); });
        a.addEventListener('mouseleave', function () { a.classList.remove('lit'); });
        a.addEventListener('focus', function () { a.classList.add('lit'); });
        a.addEventListener('blur', function () { a.classList.remove('lit'); });
        return a;
      }
      [0, 1].forEach(function (k) {
        var list = all.filter(function (w, i) { return i % 2 === k; }), track = document.createElement('div');
        track.className = 'shelf-track' + (k ? ' rev' : '');
        var row = still ? list : list.concat(list);   // long enough to fill a wide screen
        row.forEach(function (w, i) { track.appendChild(win(w, i * 2 + k, still ? false : i >= list.length)); });
        if (!still) row.forEach(function (w, i) { track.appendChild(win(w, i * 2 + k, true)); });
        web.appendChild(track);
      });
      wins = [].slice.call(web.querySelectorAll('.win'));
      slide(web);
      if (still) return;
      var n = 0;
      (function tour() {
        setTimeout(function () {
          if (!document.hidden && web.offsetParent) {
            var r = web.getBoundingClientRect(), seen = wins.filter(function (w) { var q = w.getBoundingClientRect(); return q.left > r.left + r.width * 0.12 && q.right < r.right - r.width * 0.12 && !w.matches(':hover'); });
            if (seen.length) { var w = seen[n++ % seen.length]; w.classList.add('lit'); setTimeout(function () { if (!w.matches(':hover') && w !== document.activeElement) w.classList.remove('lit'); }, 6000); }
          }
          tour();
        }, 2400);
      })();
    }).catch(function () { web.hidden = true; });
  });
  // "Up next" on each tab: moves to the next one, as its tab button does
  document.querySelectorAll('[data-next]').forEach(function (b) {
    b.addEventListener('click', function () { var t = document.getElementById(b.getAttribute('data-next')); if (t) { t.click(); document.getElementById('hero').scrollIntoView({ behavior: still ? 'auto' : 'smooth' }); } });
  });
})();
