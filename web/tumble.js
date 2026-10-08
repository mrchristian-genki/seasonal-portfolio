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
  var root = document.documentElement, shownYear = 2026, ticking = false;

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
    if (year !== shownYear) { yearEl.textContent = year; shownYear = year; toolbox(year); }
    if (root.getAttribute('data-era') !== era) { root.setAttribute('data-era', era); browserEl.textContent = label; }
    if (still) return;
    // the parallax: each prop moves against the scroll by its depth, and turns as it falls
    for (var k = 0; k < props.length; k++) {
      var p = props[k], box = p.parentNode.getBoundingClientRect();
      if (box.bottom < -200 || box.top > vh + 200) continue;
      var d = +p.getAttribute('data-depth'), off = (box.top + box.height / 2 - mid), spin = +(p.getAttribute('data-spin') || 0);
      p.style.transform = 'translate3d(0,' + (off * (d - 0.5) * 0.6).toFixed(1) + 'px,0) rotate(' + (spin * off / vh).toFixed(1) + 'deg)';
    }
  }
  // the toolbox: a feature is blanked out (greyed, struck through) once you've fallen to a year before it worked
  // everywhere, and lights up again as you climb; nothing leaves the list, so 1997 shows how much wasn't there
  var tbx = [].slice.call(document.querySelectorAll('[data-tbx] li')), tbxN = document.querySelectorAll('[data-tbx-count]'), lost = document.querySelector('[data-tbx-lost]');
  function toolbox(y) {
    var n = 0, gone = [];
    tbx.forEach(function (li) {
      var have = y >= +li.getAttribute('data-y');
      if (have) n++;
      else if (!li.classList.contains('off')) gone.push(li.querySelector('span').textContent);
      li.classList.toggle('off', !have);
    });
    [].forEach.call(tbxN, function (e) { e.textContent = n; });
    if (lost) lost.textContent = gone.length ? 'Just lost: ' + gone.slice(-3).join(', ') + (gone.length > 3 ? ' and ' + (gone.length - 3) + ' more' : '') : (n === tbx.length ? '' : lost.textContent);
  }
  var tbBtn = document.querySelector('[data-tbx-open]'), tbBox = document.getElementById('tbBox');
  if (tbBtn) tbBtn.addEventListener('click', function () { var o = tbBox.classList.toggle('open'); tbBtn.setAttribute('aria-expanded', String(o)); });
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
  if (up) up.addEventListener('click', function () { scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' }); });
})();
