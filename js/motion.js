/* MOTION (CLAUDE.md "Motion: nothing is fast or instant"), shared by the homepage and the Play pages.
   easeScroll(top[, box]): a scroll to a spot is a slow, eased glide (web/tumble.js tumbleTo), longer for longer
   distances, stopped at once by a wheel, touch or key; easeScroll.to(el) glides to an element (its scroll-margin
   kept). In-page # links glide too. softDialog(d, ms[, keep]): d.close() fades the dialog out first (css .shut),
   Esc too, unless keep() says another layer takes the Esc. With reduced motion everything happens at once. */
(function () {
  'use strict';
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches, EV = ['wheel', 'touchstart', 'keydown'];
  function easeScroll(top, box, done) {
    var win = !box || box === window || box === document.documentElement || box === document.scrollingElement;
    var el = win ? document.scrollingElement || document.documentElement : box;
    var max = el.scrollHeight - (win ? innerHeight : el.clientHeight), from = win ? scrollY : el.scrollTop;
    top = Math.max(0, Math.min(max, top));
    var set = function (y) { if (win) scrollTo(0, y); else el.scrollTop = y; };
    if (el._esStop) el._esStop();
    var d = top - from;
    if (still || Math.abs(d) < 2) { set(top); if (done) done(); return; }
    var dur = Math.min(6000, Math.max(1000, Math.abs(d) / 1.5)), t0 = performance.now(), raf = 0, sb = el.style.scrollBehavior;
    el.style.scrollBehavior = 'auto';
    var stop = el._esStop = function () { cancelAnimationFrame(raf); el._esStop = null; el.style.scrollBehavior = sb; EV.forEach(function (e) { removeEventListener(e, stop); }); };
    EV.forEach(function (e) { addEventListener(e, stop, { passive: true }); });
    (function step(now) {
      var k = Math.min(1, (now - t0) / dur), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      set(from + d * e);
      if (k < 1) raf = requestAnimationFrame(step); else { stop(); if (done) done(); }
    })(t0);
  }
  easeScroll.to = function (target, done) {
    var m = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
    easeScroll(target.getBoundingClientRect().top + scrollY - m, null, done);
  };
  window.easeScroll = easeScroll;

  // # links on the page: the same glide, and the address still changes as a jump would
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || (a.target && a.target !== '_self')) return;
    var h = a.getAttribute('href'), t = h.length > 1 ? document.getElementById(decodeURIComponent(h.slice(1))) : null;
    if (h.length > 1 && !t) return;
    e.preventDefault();
    var at = location.href.indexOf('#');
    if ((at < 0 ? '' : location.href.slice(at)) !== h) try { history.pushState(null, '', h); } catch (er) {}
    if (t) easeScroll.to(t); else easeScroll(0);
  });

  window.softDialog = function (d, ms, keep) {
    if (d._soft) return d; d._soft = true;
    var close = d.close.bind(d), show = d.showModal.bind(d), t = 0;
    var undo = function () { if (t) { clearTimeout(t); t = 0; d.classList.remove('shut'); } };
    d.close = function (v) {
      if (!d.open || t) return;
      if (still) return close(v);
      d.classList.add('shut');
      t = setTimeout(function () { t = 0; d.classList.remove('shut'); close(v); }, ms);
    };
    d.showModal = function () { undo(); if (!d.open) show(); };
    d.addEventListener('cancel', function (e) { if (still || (keep && keep())) return; e.preventDefault(); d.close(); });
    return d;
  };
})();
