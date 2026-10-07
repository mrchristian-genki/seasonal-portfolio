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

   So there is never nothing unless there is nothing at all. pick() also says where each came from, for the Studio.
   note = { look, backdrop, cats: [...], prefer, ignoreHolidays }; date = a Date (today by default). */
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
    return { look: look, backdrop: bd, holiday: on ? on.name : null };
  }
  var api = { pick: pick, mmdd: mmdd };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GAResolve = api;
})(this);
