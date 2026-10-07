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
