/* WHAT GLAZYARRAY WEARS ON A NOTE: one rule for her look (the cap) and her backdrop (the scene behind the Listen bar),
   used by the site (js/narrator.js), the Studio and the deploy (field/tools/publish.mjs checks every Note with it;
   field/tools/gacard.py has the same rule in Python). Christian, Oct 7, 2026. Each is decided on its own, in order:

     1. A holiday on its dates (a look with "from"/"to", month-day) wins on every Note, unless the Note says
        "ignore holidays". Its backdrop too, if the holiday has one ("backdrop" on the look).
     2. The Note's own pick (made for it, not taken from a category).
     3. Its categories: the one the Note's editor ticked first, then the highest priority (looks.json
        "categoryRank", 0 when not set), then the one changed most recently ("categoryStamp").
     4. The site's default, ticked in the Studio's Categories tab like a Note's poster (looks.json "defaults": a
        look and a backdrop). With no default look ticked, the holiday coming up next (or her curls).

   Who narrates a Note (Christian, Oct 11, 2026) follows the same order without holidays: the Note's own choice
   (episode.narrator), its categories (looks.json "categoryNarrators"), the site default ("defaults.narrator"), else
   GlazyArray. A.L.T.A.'s tank backdrop (the scene behind her glass) follows it too: the Note's own (altaBackdrop),
   its categories' (looks.json "categoryTanks"), the default ("defaults.tank"), else none (the hall). Her scenes are
   looks.json "tankBackdrops", files in assets/alta/backdrops/. NARRATORS are the ones with a player: GlazyArray (js/narrator.js), A.L.T.A. (js/alta.js) and Robot Marley (js/marley.js).

   So there is never nothing unless there is nothing at all. pick() also says where each came from, for the Studio.
   A category can offer more than one backdrop or tank scene (looks.json "categoryBackdropChoices", "categoryTankChoices"):
   the one that fits the Note's words and colours best is worn (fit(), below).
   note = { look, backdrop, narrator, cats: [...], prefer, ignoreHolidays, words, palette, month }; date = a Date (today by default). */
(function (root) {
  'use strict';
  function mmdd(d) { return ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function within(md, l) { return l.from <= l.to ? md >= l.from && md <= l.to : md >= l.from || md <= l.to; }   // a window may run over New Year
  function holidays(J) { return ((J && J.looks) || []).filter(function (l) { return l.from && l.to; }).sort(function (a, b) { return a.to < b.to ? -1 : 1; }); }
  // WHICH OF A CATEGORY'S CHOICES FITS A NOTE (Christian, Oct 13, 2026): its words (note.words: its title, summary,
  // place, tags and episode title) against each scene's name and description, kin words counting half (dusk for
  // sunset, shore for lake), then its two colours (note.palette, from its hero) against each scene's colours
  // ("colors", taken from the image when it's added) to settle the rest, and its month (note.month) keeps snow to
  // winter and golden leaves to autumn. A tie goes to the category's own pick.
  var KIN = [['sunset', 'dusk', 'evening', 'golden', 'sundown', 'twilight'], ['lake', 'water', 'shore', 'beach', 'bay', 'swim', 'paddle', 'cove'],
    ['snow', 'winter', 'ski', 'ice', 'frozen', 'powder'], ['forest', 'pine', 'tree', 'wood', 'trail', 'hike', 'trailhead'], ['cliff', 'coast', 'ocean', 'sea', 'atlantic', 'headland'],
    ['mist', 'fog', 'morning', 'dawn', 'sunrise'], ['tropical', 'palm', 'hawaii', 'island', 'oahu'], ['library', 'book', 'study', 'research', 'case'],
    ['classroom', 'class', 'school', 'lesson', 'teach', 'chalkboard'], ['pool', 'lifeguard', 'lesson', 'safety'], ['boat', 'boathouse', 'kayak', 'paddle', 'dock'],
    ['ireland', 'irish', 'donegal', 'atlantic'], ['tahoe', 'lake', 'sierra', 'emerald'], ['castle', 'lighthouse', 'ruin', 'tower'], ['mountain', 'peak', 'summit', 'ridge']];
  var SKIP = /^(the|and|with|from|that|this|its|her|his|for|into|over|under|about|along|across|small|soft|warm|old|little|large|seen|like|their|beyond|far|on|in|of|a|an|at|to|by)$/;
  function wordsOf(t) { return (String(t || '').toLowerCase().match(/[a-z]+/g) || []).map(function (w) { return w.length > 4 ? w.replace(/ies$/, 'y').replace(/s$/, '') : w; }).filter(function (w) { return w.length > 2 && !SKIP.test(w); }); }
  function rgb(h) { var n = parseInt(String(h).slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function cdist(a, b) { a = rgb(a); b = rgb(b); var r = (a[0] + b[0]) / 2, d = [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; return Math.sqrt((2 + r / 256) * d[0] * d[0] + 4 * d[1] * d[1] + (2 + (255 - r) / 256) * d[2] * d[2]); }
  function fit(list, note) {
    var nw = {}; wordsOf(note.words).forEach(function (w) { nw[w] = 1; });
    var pal = (note.palette || []).filter(function (c) { return /^#[0-9a-f]{6}$/i.test(c); });
    var best = null;
    list.forEach(function (b, k) {
      var hit = [], s = 0;
      wordsOf(b.name.replace(/-/g, ' ') + ' ' + (b.scene || '') + ' ' + (b.about || '')).filter(function (w, i, a) { return a.indexOf(w) === i; }).forEach(function (w) {
        if (nw[w]) { s += 1; hit.push(w); return; }
        var kin = KIN.filter(function (g) { return g.indexOf(w) >= 0; }).some(function (g) { return g.some(function (x) { return nw[x]; }); });
        if (kin) { s += 0.5; hit.push(w); }
      });
      // the season: a snowy scene for a Note from December to March, an autumn one for September to November
      var bw = ' ' + wordsOf(b.name.replace(/-/g, ' ') + ' ' + (b.scene || '')).join(' ') + ' ', mo = +note.month || 0;
      if (mo && /\s(snow|snowy|winter)\s/.test(bw)) { if (mo === 12 || mo <= 3) { s += 0.5; hit.push('winter'); } else s -= 3; }
      if (mo && /\s(autumn|aspen|foliage)\s/.test(bw)) { if (mo >= 9 && mo <= 11) { s += 0.3; hit.push('autumn'); } else s -= 2; }
      var cs = 0;
      if (pal.length && b.colors && b.colors.length) { var d = Math.min.apply(null, pal.map(function (p) { return Math.min.apply(null, b.colors.map(function (c) { return cdist(p, c); })); })); cs = Math.max(0, 1 - d / 400) * 0.8; s += cs; }
      if (!best || s > best.s + 1e-9) best = { b: b, s: s, why: hit.length ? hit.slice(0, 3).join(', ') : cs > 0.4 ? 'its colours' : '' };
    });
    return best;
  }
  function pick(J, note, date) {
    J = J || {}; note = note || {};
    var md = mmdd(date || new Date()), looks = {}, bds = {};
    (J.looks || []).forEach(function (l) { looks[l.name] = l; }); looks.curls = { name: 'curls' };
    (J.backdrops || []).forEach(function (b) { bds[b.name] = b; });
    var hol = holidays(J), on = hol.filter(function (l) { return within(md, l); }).sort(function (a, b) { return a.from < b.from ? 1 : -1; })[0] || null;
    var up = hol.filter(function (l) { return l.to >= md; })[0] || hol[0] || null;
    var rank = J.categoryRank || {}, stamp = J.categoryStamp || {}, cats = (note.cats || []).filter(Boolean);
    // more: a category's other choices (looks.json "categoryBackdropChoices" / "categoryTankChoices"): its own pick and
    // these are offered, and the one that fits the Note best (fit()) is worn
    function byCats(map, have, more) {
      var c = cats.map(function (c, i) {
        var list = [map[c]].concat((more && more[c]) || []).filter(function (n, k, a) { return n && have[n] && a.indexOf(n) === k; });
        return { c: c, v: list[0], list: list, i: i };
      }).filter(function (x) { return x.v; });
      c.sort(function (a, b) {
        return (b.c === note.prefer) - (a.c === note.prefer) || (rank[b.c] || 0) - (rank[a.c] || 0) ||
          (stamp[b.c] || '').localeCompare(stamp[a.c] || '') || a.i - b.i;
      });
      var w = c[0] || null;
      if (w && w.list.length > 1 && (note.words || note.palette)) { var f = fit(w.list.map(function (n) { return have[n]; }), note); w.v = f.b.name; w.fits = f.why; }
      return w;
    }
    var fits = function (x) { return x.fits ? ', fits ' + x.fits : ''; };
    var holOn = on && !note.ignoreHolidays;
    // her look
    var look;
    if (holOn) look = { name: on.name, from: 'holiday', why: on.name.replace(/-/g, ' ') + ' (holiday, ' + on.from + ' to ' + on.to + ')' };
    else if (note.look && looks[note.look]) look = { name: note.look, from: 'note', why: 'this Note\'s own' };
    else {
      var cl = byCats(J.categories || {}, looks);
      look = cl ? { name: cl.v, from: 'category', cat: cl.c, why: 'from ' + cl.c + (rank[cl.c] ? ' (priority ' + rank[cl.c] + ')' : '') }
        : J.defaults && J.defaults.look && looks[J.defaults.look] ? { name: J.defaults.look, from: 'default', why: 'the site default' }
        : up ? { name: up.name, from: 'default', why: 'the holiday coming up' } : { name: 'curls', from: 'default', why: 'her own curls' };
    }
    // her backdrop
    var bd = null, dflt = J.defaults && J.defaults.backdrop;
    if (holOn && on.backdrop && bds[on.backdrop]) bd = { name: on.backdrop, from: 'holiday', why: on.name.replace(/-/g, ' ') + ' (holiday)' };
    else if (note.backdrop && bds[note.backdrop]) bd = { name: note.backdrop, from: 'note', why: 'this Note\'s own' };
    else {
      var cb = byCats(J.categoryBackdrops || {}, bds, J.categoryBackdropChoices);
      if (cb) bd = { name: cb.v, from: 'category', cat: cb.c, choices: cb.list.length, why: 'from ' + cb.c + (rank[cb.c] ? ' (priority ' + rank[cb.c] + ')' : '') + fits(cb) };
      else if (dflt && bds[dflt]) bd = { name: dflt, from: 'default', why: 'the site default' };
    }
    // who narrates it
    var nar, nc = byCats(J.categoryNarrators || {}, NARRATORS), dn = J.defaults && J.defaults.narrator;
    if (note.narrator && NARRATORS[note.narrator]) nar = { name: note.narrator, from: 'note', why: 'this Note\'s own' };
    else if (nc) nar = { name: nc.v, from: 'category', cat: nc.c, why: 'from ' + nc.c + (rank[nc.c] ? ' (priority ' + rank[nc.c] + ')' : '') };
    else if (dn && NARRATORS[dn]) nar = { name: dn, from: 'default', why: 'the site default' };
    else nar = { name: 'glazyarray', from: 'default', why: 'GlazyArray, the show\'s narrator' };
    // the scene behind A.L.T.A.'s tank
    var tks = {}; (J.tankBackdrops || []).forEach(function (b) { tks[b.name] = b; });
    var tk = null, tc = byCats(J.categoryTanks || {}, tks, J.categoryTankChoices), dt = J.defaults && J.defaults.tank;
    if (note.tank && tks[note.tank]) tk = { name: note.tank, file: tks[note.tank].file, v: tks[note.tank].v, from: 'note', why: 'this Note\'s own' };
    else if (tc) tk = { name: tc.v, file: tks[tc.v].file, v: tks[tc.v].v, from: 'category', cat: tc.c, choices: tc.list.length, why: 'from ' + tc.c + fits(tc) };
    else if (dt && tks[dt]) tk = { name: dt, file: tks[dt].file, v: tks[dt].v, from: 'default', why: 'the site default' };
    return { look: look, backdrop: bd, narrator: nar, tank: tk, holiday: on ? on.name : null };
  }
  var NARRATORS = { glazyarray: 'GlazyArray', alta: 'A.L.T.A.', marley: 'Robot Marley' };
  var api = { pick: pick, fit: fit, mmdd: mmdd, NARRATORS: NARRATORS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GAResolve = api;
})(this);
