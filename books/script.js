(function () {
  const cfg = window.SITE_CONFIG;

  // ── Header (static parts) ──────────────────────────────
  document.title = cfg.pageTitle || cfg.siteTitle;
  document.getElementById("site-title").textContent = cfg.siteTitle;
  document.getElementById("site-subtitle").textContent = cfg.siteSubtitle;

  // ── Minimal RFC4180 CSV parser ──────────────────────────
  // Handles quoted fields, escaped "" quotes, commas/newlines inside
  // quoted fields, and \r\n line endings — which is what Google Sheets'
  // CSV export actually produces. Returns an array of row-arrays; the
  // caller is responsible for treating row 0 as headers.
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else { inQuotes = false; }
        } else {
          field += c;
        }
      } else {
        if (c === '"') inQuotes = true;
        else if (c === ",") { row.push(field); field = ""; }
        else if (c === "\r") { /* skip, \n handles the break */ }
        else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
        else field += c;
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter((r) => r.length > 1 || r[0] !== "");
  }

  function rowsToBooks(rows) {
    if (!rows.length) return [];
    const headers = rows[0].map((h) => h.trim());
    return rows.slice(1).map((r) => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (r[i] || "").trim(); });
      return {
        id: obj.id,
        title: obj.title,
        series: obj.series,
        status: obj.status,
        blurb: obj.blurb,
        coverBW: obj.coverBW,
        coverColor: obj.coverColor,
        photosUrl: obj.photosUrl,
        driveUrl: obj.driveUrl,
        amazonUrl: obj.amazonUrl,
        dateAdded: obj.dateAdded,
        assets: {
          metadata: (obj.metadataReady || "").toUpperCase() === "TRUE",
          interiorPdf: (obj.interiorPdfReady || "").toUpperCase() === "TRUE",
        },
      };
    }).filter((b) => b.id);
  }

  // ── State ────────────────────────────────────────────
  let allBooks = [];        // full dataset, sorted most-recent-first
  let statusFilter = "all";
  let seriesFilter = "all";
  let searchQuery = "";
  let visibleCount = cfg.pageSize || 24;
  let usingLiveData = false;

  function sortByRecency(books) {
    // Most recently added first. Books with no dateAdded sort after all
    // dated books, but keep their original relative order among
    // themselves (stable sort) rather than being shuffled.
    return books
      .map((b, i) => ({ b, i }))
      .sort((x, y) => {
        const dx = x.b.dateAdded, dy = y.b.dateAdded;
        if (dx && dy) return dx < dy ? 1 : dx > dy ? -1 : x.i - y.i;
        if (dx && !dy) return -1;
        if (!dx && dy) return 1;
        return x.i - y.i;
      })
      .map((p) => p.b);
  }

  function initFromBooks(books) {
    allBooks = sortByRecency(books);

    const published = allBooks.filter((b) => b.status === "published").length;
    const pending = allBooks.length - published;
    document.getElementById("stats").innerHTML = `
      <div><strong>${allBooks.length}</strong>titles catalogued</div>
      <div><strong>${published}</strong>published</div>
      <div><strong>${pending}</strong>in the works</div>
      ${usingLiveData ? "" : `<div class="stats-note">⚠ showing bundled data — live sheet unavailable</div>`}
    `;

    const seriesSelect = document.getElementById("series-select");
    seriesSelect.innerHTML = '<option value="all">All series</option>';
    const seriesList = [...new Set(allBooks.map((b) => b.series).filter(Boolean))].sort();
    seriesList.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      seriesSelect.appendChild(opt);
    });

    render();
  }

  // Every field comes from the Google Sheet, which more people than us can edit, so nothing from it is
  // trusted: text is escaped before it goes into the page, and links must be plain http(s) addresses.
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  function safeUrl(v) {
    const u = String(v || "").trim();
    return /^https?:\/\//i.test(u) ? esc(u) : "";
  }
  function safeSrc(v) {   // a cover: an http(s) address or a relative path like covers/name.jpg
    const u = String(v || "").trim();
    return /^https?:\/\//i.test(u) || /^[\w./-]+$/.test(u) && !/^\/\//.test(u) ? esc(u) : "";
  }

  function cardHTML(book) {
    const photosUrl = safeUrl(book.photosUrl), driveUrl = safeUrl(book.driveUrl), amazonUrl = safeUrl(book.amazonUrl);
    const status = book.status === "published" ? "published" : "pending";
    const title = esc(book.title);
    const links = [];
    if (photosUrl) links.push(`<a href="${photosUrl}" target="_blank" rel="noopener">Full gallery ↗</a>`);
    // Production links (Drive folders) only when the catalog is used internally (config.showProduction).
    if (cfg.showProduction && driveUrl) links.push(`<a href="${driveUrl}" target="_blank" rel="noopener">Drive folder ↗</a>`);
    if (amazonUrl) links.push(`<a href="${amazonUrl}" target="_blank" rel="noopener">Amazon ↗</a>`);

    const assets = book.assets || { metadata: false, interiorPdf: false };
    const assetBadges = !cfg.showProduction ? "" : `
      <span class="asset-pill ${assets.metadata ? "ready" : "not-ready"}" title="${assets.metadata ? "Listing metadata confirmed" : "Listing metadata not yet confirmed"}">
        ${assets.metadata ? "✓" : "○"} Metadata
      </span>
      <span class="asset-pill ${assets.interiorPdf ? "ready" : "not-ready"}" title="${assets.interiorPdf ? "Interior print PDF confirmed" : "Interior print PDF not yet confirmed"}">
        ${assets.interiorPdf ? "✓" : "○"} Interior PDF
      </span>
    `;

    return `
      <article class="card">
        <div class="card-image" data-toggle>
          <span class="badge ${status}">${status === "published" ? "Published" : "In progress"}</span>
          <img class="img-color" src="${safeSrc(book.coverColor)}" alt="${title} — colored" loading="lazy">
          <img class="img-bw" src="${safeSrc(book.coverBW)}" alt="${title} — line art" loading="lazy">
          <span class="hint">tap to color</span>
        </div>
        <div class="card-body">
          <div class="series">${esc(book.series)}</div>
          <h3>${title}</h3>
          <p>${esc(book.blurb)}</p>
          <div class="asset-pills">${assetBadges}</div>
          ${links.length ? `<div class="card-links">${links.join("")}</div>` : ""}
        </div>
      </article>
    `;
  }

  function getFiltered() {
    const q = searchQuery.trim().toLowerCase();
    return allBooks.filter((b) => {
      const statusOk = statusFilter === "all" || b.status === statusFilter;
      const seriesOk = seriesFilter === "all" || b.series === seriesFilter;
      const searchOk = !q ||
        (b.title || "").toLowerCase().includes(q) ||
        (b.series || "").toLowerCase().includes(q) ||
        (b.blurb || "").toLowerCase().includes(q);
      return statusOk && seriesOk && searchOk;
    });
  }

  function render() {
    const grid = document.getElementById("grid");
    const filtered = getFiltered();
    const toShow = filtered.slice(0, visibleCount);

    grid.innerHTML = toShow.length
      ? toShow.map(cardHTML).join("")
      : `<div class="empty-state">Nothing here yet — try a different filter or search.</div>`;

    grid.querySelectorAll("[data-toggle]").forEach((el) => {
      el.addEventListener("click", () => el.classList.toggle("colored"));
    });

    const loadMoreRow = document.getElementById("load-more-row");
    const loadMoreBtn = document.getElementById("load-more-btn");
    const loadMoreCount = document.getElementById("load-more-count");
    const remaining = filtered.length - toShow.length;
    if (remaining > 0) {
      loadMoreRow.style.display = "flex";
      loadMoreBtn.textContent = `Load more (${Math.min(cfg.pageSize || 24, remaining)})`;
      loadMoreCount.textContent = `Showing ${toShow.length} of ${filtered.length}`;
    } else {
      loadMoreRow.style.display = filtered.length ? "flex" : "none";
      loadMoreCount.textContent = filtered.length ? `Showing all ${filtered.length}` : "";
      loadMoreBtn.style.display = remaining > 0 ? "inline-block" : "none";
    }
  }

  function resetPaging() {
    visibleCount = cfg.pageSize || 24;
  }

  // ── Controls ────────────────────────────────────────────
  document.querySelectorAll(".filter-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-pill").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      statusFilter = btn.dataset.status;
      resetPaging();
      render();
    });
  });

  document.getElementById("series-select").addEventListener("change", (e) => {
    seriesFilter = e.target.value;
    resetPaging();
    render();
  });

  let searchDebounce;
  document.getElementById("search-input").addEventListener("input", (e) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      searchQuery = e.target.value;
      resetPaging();
      render();
    }, 150);
  });

  document.getElementById("load-more-btn").addEventListener("click", () => {
    visibleCount += cfg.pageSize || 24;
    render();
  });

  // ── Load data: try the live Sheet first, fall back to bundled data.js ──
  function boot() {
    const sheetUrl = cfg.catalogSheetUrl;
    if (!sheetUrl) {
      usingLiveData = false;
      initFromBooks(window.CATALOG || []);
      return;
    }
    fetch(sheetUrl)
      .then((res) => {
        if (!res.ok) throw new Error("Sheet fetch failed: " + res.status);
        return res.text();
      })
      .then((text) => {
        const rows = parseCSV(text);
        const books = rowsToBooks(rows);
        if (!books.length) throw new Error("Sheet returned no rows");
        usingLiveData = true;
        initFromBooks(books);
      })
      .catch((err) => {
        console.warn("Falling back to bundled data.js —", err.message);
        usingLiveData = false;
        initFromBooks(window.CATALOG || []);
      });
  }

  boot();
})();
