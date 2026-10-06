/* The lake scene, shown or hidden, remembered in this browser (css/lake.css). On the homepage: "Hide the lake" on
   the scene, "Show the lake" in a band under the header. On the Play pages the band's link opens the same thing on
   the homepage with the lake, and remembers that it's wanted. */
(function () {
  var KEY = 'cg-lake', root = document.documentElement, hero = document.getElementById('hero');
  function set(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* private window */ } }
  function wanted() { try { return localStorage.getItem(KEY) !== '0'; } catch (e) { return true; } }
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
  function apply(on, byHand) {
    root.classList.toggle('lake-off', !on); band.hidden = on;
    if (on) hero.removeAttribute('aria-hidden'); else hero.setAttribute('aria-hidden', 'true');
    if (byHand) {
      set(on ? '1' : '0');
      if (on) { dispatchEvent(new Event('resize')); window.scrollTo({ top: 0, behavior: 'smooth' }); hide.focus({ preventScroll: true }); }
      else band.querySelector('button').focus({ preventScroll: true });
    }
  }
  band.querySelector('button').onclick = function () { apply(true, true); };
  hide.onclick = function () { apply(false, true); };
  apply(wanted(), false);
})();
