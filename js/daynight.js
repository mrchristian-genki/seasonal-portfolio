/* DAY AND NIGHT ON THE NEWSSTAND (Christian, Oct 21: "most web magazines are doing at least a light and dark version").
   The magazines' pages (field/tools/magazines.mjs) go dark with html.night-page, as the rest of the site does:
   - night or day in the address, or the look carried from another page (js/carry.js, which runs first), decides;
   - with neither, the reader's own light or dark setting does, and follows it if it changes;
   - a Day/Night button ([data-daynight]) switches it and writes night or day into the address, so the choice is kept
     going on (js/carry.js takes it to the next page) and on a copied link.
   Run in the head after js/carry.js, so the page never draws in the wrong one. */
(function () {
  'use strict';
  var H = document.documentElement, NIGHT = /^(night|nightmode|darkmode|dark)$/, DAY = /^(day|daymode|lightmode|light)$/;
  function words() { return decodeURIComponent(location.search.slice(1)).split(/[+&,;\s]+/).filter(Boolean); }
  var said = (window.__look ? window.__look() : words()).some(function (w) { return NIGHT.test(w) || DAY.test(w); });
  var sys = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  if (!said && sys) {
    H.classList.toggle('night-page', sys.matches);
    var follow = function () { if (!said) { H.classList.toggle('night-page', sys.matches); label(); } };
    if (sys.addEventListener) sys.addEventListener('change', follow); else if (sys.addListener) sys.addListener(follow);
  }
  function label() {
    var night = H.classList.contains('night-page');
    [].forEach.call(document.querySelectorAll('[data-daynight]'), function (b) {
      b.textContent = night ? 'Day' : 'Night';
      b.setAttribute('aria-pressed', String(night));
      b.setAttribute('aria-label', night ? 'Switch to day' : 'Switch to night');
    });
  }
  document.addEventListener('DOMContentLoaded', function () {
    label();
    document.addEventListener('click', function (ev) {
      var b = ev.target.closest && ev.target.closest('[data-daynight]'); if (!b) return;
      var night = !H.classList.contains('night-page');
      said = true;
      H.classList.toggle('night-page', night);
      var ws = words().filter(function (w) { return !NIGHT.test(w.toLowerCase()) && !DAY.test(w.toLowerCase()); });
      ws.push(night ? 'night' : 'day');
      try { history.replaceState(history.state, '', location.pathname + '?' + ws.join('+') + location.hash); } catch (e) { /* file:// */ }
      label();
    });
  });
})();
