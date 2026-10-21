/* Dedicated category pages: /movies /series /trending /my-list /search */
(() => {
  const $ = BB.$;
  const CATS = {
    movies: { title: "Movies", overline: "EVERY GENRE, ONE PLACE", sub: "Organised by genre. Pick a category or use the filters to narrow it down.", hue: 352, byGenre: true, pick: x => x.type === "movie" },
    series: { title: "Series", overline: "ONE MORE EPISODE?", sub: "Binge-worthy shows sorted by genre.", hue: 205, byGenre: true, pick: x => x.type === "series" },
    trending: { title: "Trending now", overline: "WHAT EVERYONE'S WATCHING", sub: "The most-watched movies and series right now.", hue: 28, pick: () => true, defaultSort: "popular" },
    "my-list": { title: "My List", overline: "SAVED FOR LATER", sub: "Titles you've saved on this device.", hue: 285, pick: x => BB.isSaved(x.id), defaultSort: "title" },
    search: { title: "Search", overline: "FIND SOMETHING", sub: "", hue: 262, pick: () => true, defaultSort: "popular" }
  };
  const path = location.pathname.replace(/\/+$/, "").replace(/\.html$/, "").split("/").pop();
  const params = new URLSearchParams(location.search);
  const catKey = CATS[path] ? path : (CATS[params.get("c")] ? params.get("c") : "movies");
  const cat = CATS[catKey];
  const SORTS = { popular: "Most popular", rating: "Top rated", newest: "Newest first", oldest: "Oldest first", title: "Title A–Z" };
  const YEARS = [["", "Any"], ["2020", "2020s"], ["2010", "2010s"], ["2000", "2000s"], ["old", "Before 2000"]];
  const RATINGS = [["0", "Any"], ["6", "6+"], ["7", "7+"], ["8", "8+"]];
  const TYPES = [["all", "All"], ["movie", "Movies"], ["series", "Series"]];
  const defaultSort = cat.defaultSort || "popular";

  const state = {
    genres: new Set((params.get("genre") || "").split(",").map(s => s.trim()).filter(Boolean)),
    year: params.get("year") || "", rating: params.get("rating") || "0", sort: params.get("sort") || defaultSort,
    type: params.get("type") || "all", q: params.get("q") || ""
  };

  function syncUrl() {
    const p = new URLSearchParams();
    if (state.genres.size) p.set("genre", [...state.genres].join(","));
    if (state.year) p.set("year", state.year);
    if (state.rating !== "0") p.set("rating", state.rating);
    if (state.sort !== defaultSort) p.set("sort", state.sort);
    if (state.type !== "all") p.set("type", state.type);
    if (state.q) p.set("q", state.q);
    if (!CATS[path]) p.set("c", catKey);
    history.replaceState(null, "", location.pathname + (p.toString() ? "?" + p : ""));
  }
  const filtersActive = () => state.genres.size || state.year || state.rating !== "0" || state.q || state.sort !== defaultSort || state.type !== "all";
  const sorters = {
    popular: (a, b) => b.trend - a.trend || Number(b.rating) - Number(a.rating),
    rating: (a, b) => Number(b.rating) - Number(a.rating),
    newest: (a, b) => (b.year || 0) - (a.year || 0),
    oldest: (a, b) => (a.year || 9999) - (b.year || 9999),
    title: (a, b) => a.title.localeCompare(b.title)
  };
  function matches(x, skipGenre) {
    if (state.type !== "all" && x.type !== state.type) return false;
    if (!skipGenre && state.genres.size && ![...state.genres].every(g => x.genres.includes(g))) return false;
    if (state.rating !== "0" && !(Number(x.rating) >= Number(state.rating))) return false;
    if (state.year) {
      const y = Number(x.year) || 0;
      if (state.year === "old" ? !(y && y < 2000) : !(y >= Number(state.year) && y < Number(state.year) + 10)) return false;
    }
    if (state.q) { const q = state.q.toLowerCase(); if (!`${x.title} ${x.genre} ${x.year} ${x.type} ${x.description}`.toLowerCase().includes(q)) return false; }
    return true;
  }
  const base = () => BB.items.filter(cat.pick);

  /* ---------- sidebar ---------- */
  function seg(el, options, key, onPick) {
    el.replaceChildren(...options.map(([v, label]) => {
      const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.className = state[key] === v ? "on" : "";
      b.addEventListener("click", () => { state[key] = v; onPick(); }); return b;
    }));
  }
  function renderFilters() {
    $("typeGroup").hidden = !(catKey === "trending" || catKey === "my-list" || catKey === "search");
    seg($("typeSeg"), TYPES, "type", update);
    seg($("yearSeg"), YEARS, "year", update);
    seg($("ratingSeg"), RATINGS, "rating", update);
    const sel = $("sortSelect");
    if (!sel.options.length) { Object.entries(SORTS).forEach(([v, l]) => sel.add(new Option(l, v))); sel.addEventListener("change", () => { state.sort = sel.value; update(); }); }
    sel.value = state.sort;
    const pool = base().filter(x => matches(x, true));
    const genres = BB.genreList(pool);
    $("genreList").replaceChildren(...genres.map(([g, n]) => {
      const label = document.createElement("label"); label.className = "check";
      const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = state.genres.has(g);
      cb.addEventListener("change", () => { cb.checked ? state.genres.add(g) : state.genres.delete(g); update(); });
      const name = document.createElement("span"); name.textContent = g;
      const count = document.createElement("small"); count.textContent = n;
      label.append(cb, name, count); return label;
    }));
    if (!genres.length) $("genreList").innerHTML = '<p class="muted">No genres yet.</p>';
  }
  function renderStrip() {
    const genres = BB.genreList(base().filter(x => matches(x, true))).filter(([g]) => g !== "More Titles");
    const all = document.createElement("button"); all.type = "button"; all.className = "chip chip-lg" + (!state.genres.size ? " on" : ""); all.textContent = "All";
    all.addEventListener("click", () => { state.genres.clear(); update(); });
    const chips = genres.map(([g, n]) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "chip chip-lg" + (state.genres.has(g) ? " on" : "");
      b.innerHTML = `${BB.esc(g)} <small>${n}</small>`;
      b.addEventListener("click", () => { state.genres.size === 1 && state.genres.has(g) ? state.genres.clear() : (state.genres.clear(), state.genres.add(g)); update(); });
      return b;
    });
    $("genreStrip").replaceChildren(all, ...chips);
  }
  function renderActive() {
    const tags = [];
    state.genres.forEach(g => tags.push([g, () => state.genres.delete(g)]));
    if (state.year) tags.push([YEARS.find(y => y[0] === state.year)[1], () => state.year = ""]);
    if (state.rating !== "0") tags.push([`★ ${state.rating}+`, () => state.rating = "0"]);
    if (state.q) tags.push([`"${state.q}"`, () => { state.q = ""; $("searchInput").value = ""; }]);
    if (state.type !== "all") tags.push([TYPES.find(t => t[0] === state.type)[1], () => state.type = "all"]);
    $("activeFilters").replaceChildren(...tags.map(([label, undo]) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "tag-chip"; b.innerHTML = `${BB.esc(label)} <span aria-hidden="true">✕</span>`; b.setAttribute("aria-label", `Remove filter ${label}`);
      b.addEventListener("click", () => { undo(); update(); }); return b;
    }));
    const n = tags.length; $("filterBadge").textContent = n; $("filterBadge").hidden = !n;
  }

  /* ---------- results ---------- */
  function emptyState() {
    const d = document.createElement("div"); d.className = "empty";
    if (!BB.items.length) d.innerHTML = `<h2>${BB.status === "ready" ? "No playable titles right now" : "Loading catalogue…"}</h2><p>BlackBox only shows titles with a playable VidAPI source.</p>`;
    else if (catKey === "my-list" && !BB.saved.size) d.innerHTML = `<h2>Your list is empty</h2><p>Tap the <b>+</b> on any title to save it here.</p><a class="btn btn-primary" href="/movies">Browse movies</a>`;
    else d.innerHTML = `<h2>No titles match</h2><p>Try removing a filter or searching for something else.</p>`;
    if (filtersActive()) { const b = document.createElement("button"); b.className = "btn btn-glass"; b.type = "button"; b.textContent = "Reset filters"; b.addEventListener("click", reset); d.append(b); }
    return d;
  }
  function renderResults() {
    const list = base().filter(x => matches(x)).sort(sorters[state.sort]);
    const body = $("resultsBody");
    $("resultsCount").textContent = `${list.length} ${list.length === 1 ? "title" : "titles"}`;
    if (!list.length) { body.replaceChildren(emptyState()); return; }
    if (cat.byGenre && !filtersActive()) {
      const groups = BB.genreList(list);
      body.replaceChildren(...groups.map(([g, n]) => {
        const items = list.filter(x => x.genres.includes(g)).sort(sorters.rating);
        const s = document.createElement("section"); s.className = "genre-section"; s.id = "g-" + g.toLowerCase().replace(/[^a-z]+/g, "-");
        s.innerHTML = `<div class="section-heading"><div><p class="section-overline">${n} ${n === 1 ? "TITLE" : "TITLES"}</p><h2>${BB.esc(g)}</h2></div><button type="button" class="view-all">See all <span>→</span></button></div>`;
        s.querySelector(".view-all").addEventListener("click", () => { state.genres = new Set([g]); update(); scrollTo({ top: 0, behavior: "smooth" }); });
        s.append(BB.row(items)); return s;
      }));
      return;
    }
    const wrap = document.createElement("div");
    wrap.append(BB.grid(list));
    body.replaceChildren(wrap);
  }
  function renderBanner() {
    let title = cat.title, sub = cat.sub;
    if (catKey === "search") { title = state.q ? `Results for “${state.q}”` : "Search"; sub = state.q ? "" : "Type a title, genre or year in the search box."; }
    else if (state.genres.size === 1 && cat.byGenre) { title = `${[...state.genres][0]} ${cat.title}`; sub = `All ${[...state.genres][0].toLowerCase()} ${cat.title.toLowerCase()} in the BlackBox catalogue.`; }
    $("bannerTitle").textContent = title; $("bannerSub").textContent = sub; $("bannerOverline").textContent = cat.overline;
    $("banner").style.setProperty("--h", state.genres.size === 1 ? (BB.GENRE_HUE[[...state.genres][0]] ?? cat.hue) : cat.hue);
    document.title = `${title} · BlackBox`;
  }
  function update() { syncUrl(); renderBanner(); renderFilters(); renderStrip(); renderActive(); renderResults(); }
  function reset() { state.genres.clear(); state.year = ""; state.rating = "0"; state.sort = defaultSort; state.type = "all"; state.q = ""; $("searchInput").value = ""; update(); }

  BB.mountChrome(catKey === "search" ? "" : catKey);
  $("searchInput").addEventListener("input", e => { clearTimeout(update.t); update.t = setTimeout(() => { state.q = e.target.value.trim(); update(); }, 120); });
  document.querySelector(".search").addEventListener("submit", e => { e.preventDefault(); state.q = $("searchInput").value.trim(); update(); });
  $("resetFilters").addEventListener("click", reset);
  const drawer = open => document.body.classList.toggle("drawer-open", open);
  $("openFilters").addEventListener("click", () => drawer(true));
  ["closeFilters", "scrim", "applyFilters"].forEach(id => $(id).addEventListener("click", () => drawer(false)));
  document.addEventListener("keydown", e => { if (e.key === "Escape") drawer(false); });
  document.addEventListener("bb:catalog", update);
  document.addEventListener("bb:saved", () => { if (catKey === "my-list") update(); });
  update();
  BB.refresh();
})();
