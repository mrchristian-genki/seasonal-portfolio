/* THE LAKE HOME's latest Notes (index.html .home-latest): the three newest Field Notes from Play's own list (play/hub.json,
   built by field/tools/publish.mjs), each a card that opens the Note. Loads once the welcome is near the screen. */
(function () {
  'use strict';
  var box = document.querySelector('[data-home-latest]'); if (!box) return;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function load() {
    fetch('play/hub.json').then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (h) {
      var list = (h.episodes || []).slice(0, 3);
      if (!list.length) return;
      box.innerHTML = '<h3>The latest from Play</h3><div class="hl-cards">' + list.map(function (e) {
        return '<a class="hl-card" href="' + esc(e.url) + '">' +
          (e.cover ? '<span class="hl-img"><img src="' + esc(e.cover.src) + '" alt="" width="' + e.cover.w + '" height="' + e.cover.h + '" loading="lazy" decoding="async"></span>' : '') +
          '<span class="hl-kick">' + esc(e.kind) + ' · ' + esc(e.date) + '</span><b>' + esc(e.title) + '</b><span class="hl-sum">' + esc(e.summary) + '</span></a>';
      }).join('') + '</div>';
      requestAnimationFrame(function () { box.classList.add('in'); });
    }).catch(function () { box.hidden = true; });
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { io.disconnect(); load(); } }, { rootMargin: '400px 0px' });
    io.observe(box);
  } else load();
})();
