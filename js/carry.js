/* CARRYING THE LOOK FROM PAGE TO PAGE (Christian, Oct 20: no "data hole" where a state resets when you go to another
   page and come back). The look is what a visitor sets on the lake: the season, day or night, the lake shown or
   closed, and the weather. On the lake page (index.html) scene.js, lake.js and the rest write it into the address;
   this script carries it on:
   - every link to another of the site's pages gets the look added to it as it's followed (a word the link already
     names, say its own season, stays the link's), so Books, Play's pages, the Tumble and the way back all keep it;
   - the look is kept for the tab's session too (sessionStorage), so a page reached some other way (the village's
     doors set location.href) still has it; a page whose address names no look takes that one and writes it into its
     own address, so Back, a reload and a copied link keep it;
   - a page without the lake shows what it can: the season and night on the logo and wherever its own styles follow
     html[data-season] and html.night-page.
   Run in the head, before the page draws, after any calendar season the page sets for its logo.
   window.__look() gives the look words of the address now (js/homestead.js keeps them when it rewrites it). */
(function () {
  'use strict';
  var H = document.documentElement, KEY = 'cg-look', lake = !!document.getElementById('hero') || location.pathname.replace(/index\.html$/, '') === '/';
  var SEASON = { spring: 'spring', summer: 'summer', fall: 'fall', autumn: 'fall', winter: 'winter' };
  var NIGHT = /^(night|nightmode|darkmode|dark)$/, DAY = /^(day|daymode|lightmode|light)$/, LAKE = /^(ylake|nlake)$/;
  // the weather words scene.js knows (STORM_LEVELS)
  var WEATHER = /^(drizzle|shower|tempest|flurries|snow|blizzard|rain|downpour|snowfall|snowstorm|storm|thunder|heavyrain)$/;
  var SECTION = /^(home|books|web|workshop|lab|notes|dose|above|daydreams|newsstand)$/i;   // the lake page's sections (scene.js LINK_VIEW)
  function kind(w) { return w in SEASON ? 'season' : NIGHT.test(w) || DAY.test(w) ? 'light' : LAKE.test(w) ? 'lake' : WEATHER.test(w) ? 'weather' : ''; }
  function words(q) { return decodeURIComponent(q || '').replace(/^\?/, '').split(/[+&,;\s]+/).map(function (w) { return w.split('=')[0]; }).filter(Boolean); }
  function look(ws) { return ws.map(function (w) { return w.toLowerCase(); }).filter(kind); }
  function saved() { try { return words(sessionStorage.getItem(KEY) || ''); } catch (e) { return []; } }
  function save(ws) { try { sessionStorage.setItem(KEY, ws.join('+')); } catch (e) { /* private window */ } }
  window.__look = function () { return look(words(location.search)); };

  // A page without the lake: its address's look, else the session's; shown, kept, and written into the address.
  if (!lake) {
    var mine = window.__look(), ws = mine.length ? mine : saved();
    ws.forEach(function (w) {
      if (w in SEASON) H.dataset.season = SEASON[w];
      if (NIGHT.test(w)) H.classList.add('night-page');
    });
    if (ws.length) {
      save(ws);
      if (!mine.length) {
        var rest = words(location.search).filter(function (w) { return !kind(w.toLowerCase()); });
        try { history.replaceState(history.state, '', location.pathname + '?' + rest.concat(ws).join('+') + location.hash); } catch (e) { /* file:// */ }
      }
    }
  }
  // Leaving any page, the look as it is now is the session's (the lake page's address is kept up to date as it changes).
  addEventListener('pagehide', function () { var ws = window.__look(); if (ws.length || lake) save(ws); });

  // The site's own pages a look travels to (not the Studio, the field tools, the catalog app at /books/, or files).
  function ours(u) {
    if (u.origin !== location.origin) return false;
    var p = u.pathname;
    if (/^\/(studio|field|books|assets|css|js)\//.test(p) || /\.(?!html$)[a-z0-9]+$/i.test(p)) return false;
    return true;
  }
  // The look goes onto the link just as it's followed (a click, a middle-click or a new tab), then the link is put back,
  // so it never holds an old look.
  function carry(ev) {
    var a = ev.target.closest && ev.target.closest('a[href]');
    if (!a || ev.defaultPrevented || a.hasAttribute('download')) return;
    var href = a.getAttribute('href'); if (!href || href.charAt(0) === '#') return;
    var u; try { u = new URL(href, location.href); } catch (e) { return; }
    if (!ours(u) || (u.pathname === location.pathname && !u.search && u.hash)) return;
    var cur = window.__look(); if (!cur.length) return;
    var theirs = words(u.search), has = {};
    look(theirs).forEach(function (w) { has[kind(w)] = 1; });
    var add = cur.filter(function (w) { return !has[kind(w)]; });
    if (!add.length) return;
    // to the lake page with no section named: Home (a season alone there would open the section it used to mean)
    if (/^\/(index\.html)?$/.test(u.pathname) && !theirs.some(function (w) { return SECTION.test(w); })) theirs.unshift('home');
    u.search = '?' + theirs.concat(add).join('+');
    a.setAttribute('href', u.href.replace(location.origin, ''));
    setTimeout(function () { a.setAttribute('href', href); }, 0);
  }
  document.addEventListener('click', carry, true);
  document.addEventListener('auxclick', carry, true);
})();
