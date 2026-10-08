/* The lake scene, shown or hidden, remembered in this browser (css/lake.css). On the homepage: "Hide the lake" on
   the scene, "Show the lake" in a band under the header. On the Play pages the band's link opens the same thing on
   the homepage with the lake, and remembers that it's wanted. */
(function () {
  var KEY = 'cg-lake', root = document.documentElement, hero = document.getElementById('hero');
  function set(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* private window */ } }
  // The address can say it too, for a link to send: ?spring+day+nlake opens with the lake closed, ylake with it
  // shown, whatever this browser chose before (and without changing that choice). Showing or hiding it by hand
  // writes the word, so the address is always ready to share.
  function urlWords() { return decodeURIComponent(location.search.slice(1)).toLowerCase().split(/[+&,;\s]+/).map(function (w) { return w.split('=')[0]; }).filter(Boolean); }
  var linkWord = urlWords().filter(function (w) { return w === 'ylake' || w === 'nlake'; }).pop() || null;
  function wanted() { if (linkWord) return linkWord === 'ylake'; try { return localStorage.getItem(KEY) !== '0'; } catch (e) { return true; } }
  function writeWord(on) {
    linkWord = on ? 'ylake' : 'nlake';
    var ws = decodeURIComponent(location.search.slice(1)).split(/[+&,;\s]+/).filter(function (w) { return w && !/^(ylake|nlake)$/i.test(w); });
    ws.push(linkWord);
    try { history.replaceState(history.state, '', location.pathname + '?' + ws.join('+') + location.hash); } catch (e) { /* file:// */ }
  }
  window.__lakeWord = function () { return linkWord ? [linkWord] : []; };   // scene.js keeps it when it rewrites the address
  if (!hero) {   // a Play page: the band's link remembers the choice, then goes
    document.addEventListener('click', function (ev) { var a = ev.target.closest && ev.target.closest('a[data-lake]'); if (a) set(a.getAttribute('data-lake')); });
    return;
  }
  var head = document.querySelector('.site-head');
  var band = document.createElement('nav'); band.className = 'lake-band'; band.setAttribute('aria-label', 'The lake scene');
  band.innerHTML = '<button type="button">Show the lake <span aria-hidden="true">▾</span></button>';
  var hide = document.createElement('button'); hide.type = 'button'; hide.className = 'lake-hide'; hide.innerHTML = 'Hide the lake <span aria-hidden="true">▴</span>';
  if (head) head.insertAdjacentElement('afterend', band); else hero.parentNode.insertBefore(band, hero);
  hero.appendChild(hide);
  function glide(y) { if (window.easeScroll) easeScroll(y); else window.scrollTo(0, y); }   // js/motion.js: eased, never a jump
  function apply(on, byHand) {
    root.classList.toggle('lake-off', !on); band.hidden = on;
    if (on) hero.removeAttribute('aria-hidden'); else hero.setAttribute('aria-hidden', 'true');
    if (byHand) {
      set(on ? '1' : '0'); writeWord(on);
      if (on) { dispatchEvent(new Event('resize')); glide(0); hide.focus({ preventScroll: true }); }
      else band.querySelector('button').focus({ preventScroll: true });
    }
  }
  // Closing and opening, by hand: the scene folds away like a pop-up book. The page under it slides up over the
  // lake like a drawer (the hero's bottom edge, its white shoreline with it, rises), while the plates fold up and
  // fade, nearest first: plants and rocks, then the shores and pines, the mountains, the clouds, the sky last.
  // Then the band eases open. Opening runs it backwards, the sky first. Only transforms, opacity and a clip move,
  // so the scene itself never re-lays out. With reduced motion it simply switches.
  var EASE = 'cubic-bezier(.65,0,.35,1)', MS = 1150, busy = false;
  var FOLD = [   // plate, start (share of the time), how far up it folds (share of its height)
    ['.plate-ui', 0, 0.06], ['.plate-foreground', 0.02, 0.34], ['.plate-fx', 0.02, 0.3], ['.plate-midground', 0.12, 0.26], ['.plate-birds', 0.14, 0.22],
    ['.plate-background', 0.24, 0.2], ['.plate-clouds', 0.3, 0.16], ['.plate-aurora', 0.34, 0.12], ['.plate-celestial', 0.34, 0.12], ['.plate-sky', 0.42, 0.06]];
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function animate(on, done) {
    if (reduce || !hero.animate) return done();
    busy = true;
    var H = hero.offsetHeight, swell = hero.querySelector('.hero-swell'), anims = [];
    var shut = { clipPath: 'inset(0 0 ' + H + 'px 0)', marginBottom: -H + 'px' }, open = { clipPath: 'inset(0 0 0px 0)', marginBottom: '0px' };
    var opt = function (delay, dur, ease) { return { duration: dur, delay: delay, easing: ease || EASE, fill: 'both' }; };
    anims.push(hero.animate(on ? [shut, open] : [open, shut], opt(0, MS)));
    if (swell) anims.push(swell.animate(on ? [{ transform: 'translateY(' + -H + 'px)' }, { transform: 'none' }] : [{ transform: 'none' }, { transform: 'translateY(' + -H + 'px)' }], opt(0, MS)));
    FOLD.forEach(function (f) {
      var el = hero.querySelector(f[0]); if (!el) return;
      var sky = f[0] === '.plate-sky';   // the sky only folds: fading it would show the night layer behind
      var folded = { transform: 'translateY(' + (-f[2] * 100) + '%) scaleY(' + (1 - f[2]) + ')', opacity: sky ? 1 : 0 }, flat = { transform: 'none', opacity: 1 };
      if (on) anims.push(el.animate([folded, flat], opt(MS * (0.5 - f[1]) * 0.9, MS * 0.55, 'cubic-bezier(.2,.8,.3,1)')));    // the sky first, the plants last
      else anims.push(el.animate([flat, folded], opt(MS * f[1], MS * 0.55, 'cubic-bezier(.55,0,.75,.4)')));                  // the plants first, the sky last
    });
    Promise.all(anims.map(function (a) { return a.finished; })).then(function () { done(); anims.forEach(function (a) { a.cancel(); }); busy = false; }, function () { busy = false; });
  }
  function bandIn(show) {   // the band eases open (or shut) on its own
    if (reduce || !band.animate) return;
    band.animate(show ? [{ maxHeight: '0px', opacity: 0, padding: '0 16px' }, { maxHeight: '60px', opacity: 1 }] : [{ maxHeight: '60px', opacity: 1 }, { maxHeight: '0px', opacity: 0, padding: '0 16px' }],
      { duration: 650, easing: EASE });
  }
  band.querySelector('button').onclick = function () {
    if (busy) return;
    if (reduce || !hero.animate) return apply(true, true);
    bandIn(false);
    setTimeout(function () { apply(true, true); animate(true, function () {}); }, reduce ? 0 : 380);
  };
  hide.onclick = function () {
    if (busy) return;
    glide(0);
    animate(false, function () { apply(false, true); bandIn(true); });
  };
  apply(wanted(), false);
})();
