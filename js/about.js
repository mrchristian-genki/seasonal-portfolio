/* ABOUT, IN PLACE: clicking the name in the header (or a ?about link) opens the About page as a
   modal over the lake. It reads about/index.html and shows its <main>, so there's one copy of the
   résumé. The page itself stays at about/ for sharing and printing. */
(function () {
  'use strict';
  var brand = document.querySelector('.site-head .brand');
  if (!brand) return;
  brand.setAttribute('href', 'about/');
  var dlg = null, cssOn = false;
  function has() { return /(^|[?+&,;\s])about([+&,;\s=]|$)/i.test(decodeURIComponent(location.search)); }
  function setURL(on) {
    var ws = decodeURIComponent(location.search.slice(1)).split(/[+&,;\s]+/).filter(function (w) { return w && w.toLowerCase() !== 'about'; });
    if (on) ws.push('about');
    try { history.replaceState(history.state, '', location.pathname + (ws.length ? '?' + ws.join('+') : '') + location.hash); } catch (e) {}
  }
  function open() {
    if (!cssOn) { cssOn = true; var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'about/about.css?v=1793340000'; document.head.appendChild(l); }
    if (!dlg) {
      dlg = document.createElement('dialog'); dlg.className = 'pi-story ab-modal';
      dlg.innerHTML = '<div class="pi-story-bar"><a class="pi-story-link" href="about/" target="_blank" rel="noopener">Open as a page</a><button type="button" class="pi-close" aria-label="Close">×</button></div><div class="pi-story-body"></div>';
      dlg.querySelector('.pi-close').onclick = function () { dlg.close(); };
      dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
      dlg.addEventListener('close', function () { setURL(false); });
      document.body.appendChild(dlg);
    }
    var body = dlg.querySelector('.pi-story-body');
    if (!body.firstChild) {
      body.innerHTML = '<p>Loading…</p>';
      fetch('about/').then(function (r) { return r.text(); }).then(function (html) {
        var m = new DOMParser().parseFromString(html, 'text/html').querySelector('main.about-page'), base = new URL('about/', location.href);
        if (!m) throw 0;
        m.querySelectorAll('[href],[src]').forEach(function (n) { ['href', 'src'].forEach(function (k) { var v = n.getAttribute(k); if (v && !/^(https?:|#|mailto:)/.test(v)) n.setAttribute(k, new URL(v, base).href); }); });
        body.innerHTML = ''; body.appendChild(document.importNode(m, true));
      }).catch(function () { location.href = 'about/'; });
    }
    if (!dlg.open) dlg.showModal();
    body.scrollTop = 0; setURL(true);
  }
  brand.addEventListener('click', function (e) { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); open(); });
  if (has()) addEventListener('load', open);
})();
