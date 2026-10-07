/* THE BOOK SHELF on the Books tab (css/shelf.css). A few real covers from the catalog (assets/shelf/shelf.json,
   small copies of /books/covers/) drift by as line art; every couple of seconds the next one in view is coloured
   in by a brush sweep, the way the catalog's covers reveal their colour on hover, then goes back to line art.
   A hover or a focus colours one at once and names it; each opens the catalog. It starts when the shelf is on screen. */
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
      (b.published ? '<span class="bk-pub">Out now</span>' : '') +
      '<span class="bk-cap"><b>' + esc(b.title) + '</b><i>' + esc(b.series) + '</i></span>';
    a.addEventListener('mouseenter', function () { a.classList.add('lit'); });
    a.addEventListener('mouseleave', function () { a.classList.remove('lit'); });
    a.addEventListener('focus', function () { a.classList.add('lit'); });
    a.addEventListener('blur', function () { a.classList.remove('lit'); });
    return a;
  }
  function build(list) {
    var track = document.createElement('div'); track.className = 'shelf-track';
    list.forEach(function (b, i) { track.appendChild(card(b, i, false)); });
    if (!still) list.forEach(function (b, i) { track.appendChild(card(b, i, true)); });   // a second copy, so the drift loops seamlessly
    box.appendChild(track);
    books = [].slice.call(track.children);
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
    }, 1300);
  }
  function start() {
    if (started) return; started = true;
    fetch(A + 'shelf.json?v=1').then(function (r) { return r.json(); }).then(build).catch(function () { box.hidden = true; });
  }
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es, o) { if (es.some(function (e) { return e.isIntersecting; })) { o.disconnect(); start(); } }, { rootMargin: '300px' }).observe(box);
  else start();
  // "Up next" on each tab: moves to the next one, as its tab button does
  document.querySelectorAll('[data-next]').forEach(function (b) {
    b.addEventListener('click', function () { var t = document.getElementById(b.getAttribute('data-next')); if (t) { t.click(); document.getElementById('hero').scrollIntoView({ behavior: still ? 'auto' : 'smooth' }); } });
  });
})();
