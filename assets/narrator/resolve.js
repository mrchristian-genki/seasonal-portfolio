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
   looks.json "tankBackdrops", files in assets/alta/backdrops/. NARRATORS are the ones with a player: GlazyArray (js/narrator.js) and A.L.T.A. (js/alta.js).

   So there is never nothing unless there is nothing at all. pick() also says where each came from, for the Studio.
   note = { look, backdrop, narrator, cats: [...], prefer, ignoreHolidays }; date = a Date (today by default). */
(function (root) {
  'use strict';
  function mmdd(d) { return ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function within(md, l) { return l.from <= l.to ? md >= l.from && md <= l.to : md >= l.from || md <= l.to; }   // a window may run over New Year
  function holidays(J) { return ((J && J.looks) || []).filter(function (l) { return l.from && l.to; }).sort(function (a, b) { return a.to < b.to ? -1 : 1; }); }
  function pick(J, note, date) {
    J = J || {}; note = note || {};
    var md = mmdd(date || new Date()), looks = {}, bds = {};
    (J.looks || []).forEach(function (l) { looks[l.name] = l; }); looks.curls = { name: 'curls' };
    (J.backdrops || []).forEach(function (b) { bds[b.name] = b; });
    var hol = holidays(J), on = hol.filter(function (l) { return within(md, l); }).sort(function (a, b) { return a.from < b.from ? 1 : -1; })[0] || null;
    var up = hol.filter(function (l) { return l.to >= md; })[0] || hol[0] || null;
    var rank = J.categoryRank || {}, stamp = J.categoryStamp || {}, cats = (note.cats || []).filter(Boolean);
    function byCats(map, have) {
      var c = cats.map(function (c, i) { return { c: c, v: map[c], i: i }; }).filter(function (x) { return x.v && have[x.v]; });
      c.sort(function (a, b) {
        return (b.c === note.prefer) - (a.c === note.prefer) || (rank[b.c] || 0) - (rank[a.c] || 0) ||
          (stamp[b.c] || '').localeCompare(stamp[a.c] || '') || a.i - b.i;
      });
      return c[0] || null;
    }
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
      var cb = byCats(J.categoryBackdrops || {}, bds);
      if (cb) bd = { name: cb.v, from: 'category', cat: cb.c, why: 'from ' + cb.c + (rank[cb.c] ? ' (priority ' + rank[cb.c] + ')' : '') };
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
    var tk = null, tc = byCats(J.categoryTanks || {}, tks), dt = J.defaults && J.defaults.tank;
    if (note.tank && tks[note.tank]) tk = { name: note.tank, file: tks[note.tank].file, v: tks[note.tank].v, from: 'note', why: 'this Note\'s own' };
    else if (tc) tk = { name: tc.v, file: tks[tc.v].file, v: tks[tc.v].v, from: 'category', cat: tc.c, why: 'from ' + tc.c };
    else if (dt && tks[dt]) tk = { name: dt, file: tks[dt].file, v: tks[dt].v, from: 'default', why: 'the site default' };
    return { look: look, backdrop: bd, narrator: nar, tank: tk, holiday: on ? on.name : null };
  }
  var NARRATORS = { glazyarray: 'GlazyArray', alta: 'A.L.T.A.' };
  var api = { pick: pick, mmdd: mmdd, NARRATORS: NARRATORS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GAResolve = api;
})(this);
