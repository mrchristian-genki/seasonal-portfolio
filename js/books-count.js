/* LIVE BOOK COUNT. The Books copy ("… coloring books and counting", "See all …") reads the same
   Google Sheet as the catalog at christiangehrke.com/books/, so the two always agree. Any element
   with data-books gets the number:
     data-books="total"      every row in the sheet (what the catalog calls "titles catalogued")
     data-books="published"  rows with status "published"
     data-books="pending"    everything else ("in the works")
   Add data-books-cap to start a sentence with it. Under 100 it is spelled out ("Sixty-eight"),
   100 and up as digits ("101"). The words in the HTML are the fallback if the sheet can't load.
   The last count is kept in this browser for 6 hours, so most visits show it instantly with no
   fetch; after that it shows the kept count and refreshes in the background. */
(function () {
  var SHEET = 'https://docs.google.com/spreadsheets/d/1zDCpabR6-vp0m-nZH7Nn9NVOOfmhS2BJ0jJ3PIoOWD8/export?format=csv';
  var KEY = 'booksCount', FRESH = 6 * 3600e3;
  var els = document.querySelectorAll('[data-books]');
  if (!els.length) return;

  var ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
    'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  var TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  function words(n) {
    if (n >= 100) return String(n);
    if (n < 20) return ONES[n];
    return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  }

  function apply(c) {
    els.forEach(function (el) {
      var n = c[el.getAttribute('data-books')];
      if (typeof n !== 'number' || !(n > 0)) return;
      var w = words(n);
      if (el.hasAttribute('data-books-cap')) w = w.charAt(0).toUpperCase() + w.slice(1);
      el.textContent = w;
    });
  }

  // Count rows the same way the catalog does: a quote-aware CSV walk (blurbs hold commas and line
  // breaks), skipping the header row and any row with no title.
  function count(text) {
    var rows = [], row = [], f = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
      else if (ch === '"') q = true;
      else if (ch === ',') { row.push(f); f = ''; }
      else if (ch === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
      else if (ch !== '\r') f += ch;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    var head = (rows.shift() || []).map(function (h) { return h.trim(); });
    var ti = head.indexOf('title'), si = head.indexOf('status');
    if (ti < 0) return null;
    var c = { total: 0, published: 0, pending: 0 };
    rows.forEach(function (r) {
      if (!(r[ti] || '').trim()) return;
      c.total++;
      if ((r[si] || '').trim().toLowerCase() === 'published') c.published++; else c.pending++;
    });
    return c.total ? c : null;
  }

  var kept = null;
  try { kept = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  if (kept && kept.c) apply(kept.c);
  if (kept && Date.now() - kept.t < FRESH) return;

  function load() {
    fetch(SHEET).then(function (r) { if (!r.ok) throw 0; return r.text(); }).then(function (t) {
      var c = count(t);
      if (!c) return;
      apply(c);
      try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), c: c })); } catch (e) {}
    }).catch(function () { /* keep the words already on the page */ });
  }
  // Wait until the page has loaded so the 30 KB sheet never competes with the scene.
  if (document.readyState === 'complete') load(); else addEventListener('load', load);
})();
