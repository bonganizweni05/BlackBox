/* BlackBox shared core: catalogue, genres, cards, header/footer, saved list */
(() => {
  const CACHE_KEY = "blackbox-catalog-v4";
  const LIST_KEY = "blackbox-list";
  const CACHE_TTL = 10 * 60 * 1000;
  const TMDB = "https://image.tmdb.org/t/p/";

  const GENRE_IDS = {28:"Action",12:"Adventure",16:"Animation",35:"Comedy",80:"Crime",99:"Documentary",18:"Drama",10751:"Family",14:"Fantasy",36:"History",27:"Horror",10402:"Music",9648:"Mystery",10749:"Romance",878:"Sci-Fi",10770:"TV Movie",53:"Thriller",10752:"War",37:"Western",10759:"Action",10765:"Sci-Fi",10768:"War"};
  const GENRE_HUE = {Action:8,Comedy:42,Horror:352,"Sci-Fi":205,Drama:285,Thriller:18,Animation:168,Romance:332,Crime:28,Fantasy:262,Mystery:232,Documentary:130,Adventure:96,Family:52,History:36,War:14,Music:300,Western:30};
  const PRIORITY = ["Action","Comedy","Horror","Sci-Fi","Thriller","Drama","Animation","Romance","Crime","Fantasy","Mystery","Adventure"];
  const NAV = [["home","Home","/"],["trending","Trending","/trending"],["movies","Movies","/movies"],["series","Series","/series"],["my-list","My List","/my-list"]];

  const $ = id => document.getElementById(id);
  const readJson = (k, f) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch { return f; } };
  const writeJson = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  const hash = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };

  const demo = []; // Demo titles removed: only titles with full metadata + a VidAPI playback source are shown.

  /* ---------- normalising ---------- */
  function splitGenres(g) {
    if (!g) return [];
    const list = Array.isArray(g) ? g : String(g).split(/[·,|/]/);
    const out = [];
    list.forEach(x => {
      let name = typeof x === "object" && x ? (x.name || GENRE_IDS[x.id]) : (typeof x === "number" ? GENRE_IDS[x] : String(x).trim());
      if (!name) return;
      name = String(name).replace(/^Science Fiction$/i, "Sci-Fi").replace(/^Sci-?Fi$/i, "Sci-Fi");
      if (/^(series|movie|tv|show)$/i.test(name)) return;
      name = name.charAt(0).toUpperCase() + name.slice(1);
      if (!out.includes(name)) out.push(name);
    });
    return out;
  }
  function normalise(x, i = 0) {
    const type = /^(tv|show|series)$/i.test(String(x.type || "")) ? "series" : "movie";
    const genres = splitGenres(x.genres && x.genres.length ? x.genres : x.genre);
    const yearNum = Number(String(x.year || "").slice(0, 4)) || 0;
    const ratingNum = Number(x.rating);
    const item = {
      ...x,
      id: String(x.id ?? x.tmdbId ?? `t${i}`),
      title: x.title || "Untitled",
      type,
      year: yearNum || "",
      rating: ratingNum > 0 ? ratingNum.toFixed(1) : "",
      runtime: Number(x.runtime) || 0,
      genres: genres.length ? genres : ["More Titles"],
      trend: Number(x.trend) || 0
    };
    item.genre = item.genres.join(" · ");
    item.description = x.description || `${item.title} is a ${item.genres[0] === "More Titles" ? "" : item.genres[0].toLowerCase() + " "}${type}${item.year ? " from " + item.year : ""}. Press play to watch it now.`;
    return item;
  }
  const fmtRuntime = m => !m ? "" : (m >= 75 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);
  function metaLine(item) {
    const rt = fmtRuntime(item.runtime);
    return [item.year || "TBA", rt ? rt + (item.type === "series" ? "/ep" : "") : ""].filter(Boolean).join(" · ");
  }

  /* ---------- generated thumbnails (guarantee every card has artwork) ---------- */
  function wrap(text, max, lines) {
    const words = String(text).split(/\s+/); const out = []; let cur = "";
    words.forEach(w => { if ((cur + " " + w).trim().length > max && cur) { out.push(cur); cur = w; } else cur = (cur + " " + w).trim(); });
    if (cur) out.push(cur);
    if (out.length > lines) { out.length = lines; out[lines - 1] = out[lines - 1].replace(/.{0,2}$/, "…"); }
    return out;
  }
  const artCache = new Map();
  function generatedArt(item, wide = false) {
    const key = item.id + (wide ? "w" : "p");
    if (artCache.has(key)) return artCache.get(key);
    const g = item.genres[0];
    const h = GENRE_HUE[g] ?? hash(g);
    const h2 = (h + 40) % 360;
    const W = wide ? 1280 : 400, H = wide ? 720 : 600;
    const lines = wrap(item.title, wide ? 22 : 12, 4);
    const size = wide ? 84 : (lines.length > 2 ? 40 : 48);
    const startY = wide ? H / 2 - ((lines.length - 1) * size * 0.55) : H - 90 - (lines.length - 1) * size * 1.05;
    const tspans = lines.map((l, i) => `<tspan x="${wide ? 90 : 32}" dy="${i ? size * 1.08 : 0}">${esc(l)}</tspan>`).join("");
    const textLayer = `<text x="32" y="56" fill="#fff" fill-opacity=".7" font-family="Inter,Arial,sans-serif" font-size="18" letter-spacing="4" font-weight="700">${esc(g.toUpperCase())}</text><text x="32" y="${startY}" fill="#fff" font-family="Inter,Arial,sans-serif" font-weight="800" font-size="${size}">${tspans}</text><text x="32" y="${H - 30}" fill="#fff" fill-opacity=".65" font-family="Inter,Arial,sans-serif" font-size="18" letter-spacing="2">${esc(item.year || "")}${item.type === "series" ? "  ·  SERIES" : ""}</text>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h},62%,26%)"/><stop offset="1" stop-color="hsl(${h2},55%,9%)"/></linearGradient><radialGradient id="b" cx=".8" cy=".1" r=".8"><stop offset="0" stop-color="hsl(${h},90%,60%)" stop-opacity=".45"/><stop offset="1" stop-color="hsl(${h},90%,60%)" stop-opacity="0"/></radialGradient><linearGradient id="c" x1="0" y1=".4" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#a)"/><rect width="${W}" height="${H}" fill="url(#b)"/><g opacity=".09" stroke="#fff" stroke-width="2">${Array.from({ length: 14 }, (_, i) => `<line x1="${-H + i * (W / 8)}" y1="${H}" x2="${i * (W / 8)}" y2="0"/>`).join("")}</g><circle cx="${W * .74}" cy="${H * .3}" r="${H * .2}" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="3"/><rect width="${W}" height="${H}" fill="url(#c)"/>${wide ? "" : textLayer}</svg>`;
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    artCache.set(key, url);
    return url;
  }
  const posterOf = item => item.image || item.backdrop || generatedArt(item);
  const backdropOf = item => item.backdrop || item.image || generatedArt(item, true);

  /* ---------- state ---------- */
  const BB = { demo, GENRE_HUE, items: [], saved: new Set(readJson(LIST_KEY, [])), readJson, writeJson, esc, $, normalise, metaLine, fmtRuntime, generatedArt, posterOf, backdropOf };

  // Any title with a playable VidAPI source is displayed; missing details get fallbacks.
  const isComplete = it => /^https:\/\/vaplayer\.ru\/embed\//.test(it.playbackUrl || "");
  function build(apiItems) {
    const seen = new Set(); const list = [];
    const add = (x, i) => {
      const item = normalise(x, i);
      if (!isComplete(item)) return;
      const k = item.title.toLowerCase() + item.year;
      if (seen.has(item.id) || seen.has(k)) return;
      seen.add(item.id); seen.add(k); list.push(item);
    };
    (apiItems || []).forEach((x, i) => add({ ...x, trend: x.trend || Math.max(95 - i, 40) }, i));
    demo.forEach((x, i) => add(x, 1000 + i));
    BB.items = list;
    return list;
  }
  build(readJson(CACHE_KEY, { items: [] }).items);

  BB.find = id => {
    const stored = readJson(`blackbox-title-${id}`, null);
    return BB.items.find(x => x.id === String(id)) || (stored ? normalise(stored) : null);
  };
  BB.genreList = (items = BB.items) => {
    const map = new Map();
    items.forEach(x => x.genres.forEach(g => map.set(g, (map.get(g) || 0) + 1)));
    const rank = g => { const i = PRIORITY.indexOf(g); return i < 0 ? 99 : i; };
    return [...map.entries()].sort((a, b) => rank(a[0]) - rank(b[0]) || b[1] - a[1] || a[0].localeCompare(b[0]));
  };
  BB.setBackdrop = (el, item) => {
    const wide = BB.generatedArt(item, true);
    el.style.backgroundImage = `url("${wide}")`;
    const src = item.backdrop || item.image;
    if (!src) return;
    const probe = new Image();
    probe.onload = () => { el.style.backgroundImage = `url("${src.replace(/["\\]/g, "")}")`; };
    probe.src = src;
  };
  BB.genreUrl = (cat, genre) => `/${cat}?genre=${encodeURIComponent(genre)}`;
  BB.isSaved = id => BB.saved.has(String(id));
  BB.toggleSaved = id => {
    id = String(id);
    BB.saved.has(id) ? BB.saved.delete(id) : BB.saved.add(id);
    writeJson(LIST_KEY, [...BB.saved]);
    document.dispatchEvent(new CustomEvent("bb:saved", { detail: { id } }));
  };

  let loading = null;
  BB.refresh = () => {
    if (loading) return loading;
    const cached = readJson(CACHE_KEY, null);
    if (cached && Date.now() - Number(cached.savedAt || 0) < CACHE_TTL) { BB.status = "ready"; return Promise.resolve(false); }
    const calls = ["movies", "series"].flatMap(kind => [1, 2, 3].map(p => [kind, p]));
    loading = Promise.all(calls.map(([kind, p]) => fetch(`/api/catalog?page=${p}&kind=${kind}`, { headers: { Accept: "application/json" } }).then(r => r.ok ? r.json() : null).catch(() => null)))
      .then(pages => {
        const items = pages.flatMap(p => (p && Array.isArray(p.items)) ? p.items : []);
        if (!items.length) { BB.status = "ready"; document.dispatchEvent(new CustomEvent("bb:catalog")); return false; }
        writeJson(CACHE_KEY, { savedAt: Date.now(), items });
        build(items); BB.status = "ready";
        document.dispatchEvent(new CustomEvent("bb:catalog"));
        return true;
      }).finally(() => { loading = null; });
    return loading;
  };

  /* ---------- cards ---------- */
  BB.card = (item, opts = {}) => {
    const card = document.createElement("article");
    card.className = "card" + (opts.rank ? " has-rank" : "");
    card.dataset.id = item.id;
    const href = `/preview.html?id=${encodeURIComponent(item.id)}`;
    const rating = item.rating ? `★ ${item.rating}` : "NR";
    const meta = metaLine(item);
    card.innerHTML = `
      <a class="card-link" href="${href}" aria-label="${esc(item.title)}, ${esc(meta)}">
        <div class="card-art">
          <img alt="${esc(item.title)} poster" loading="lazy" decoding="async">
          <span class="badge badge-rating">${esc(rating)}</span>
          ${item.type === "series" ? '<span class="badge badge-type">SERIES</span>' : ""}
          ${opts.rank ? `<span class="rank">${opts.rank}</span>` : ""}
          <div class="card-hover"><span class="card-play" aria-hidden="true">▶</span><span class="card-hover-text">View details</span></div>
        </div>
        <div class="card-body">
          <h3 class="card-title">${esc(item.title)}</h3>
          <p class="card-meta">${esc(meta)}</p>
          <p class="card-genres">${item.genres.slice(0, 2).map(esc).join(" · ")}</p>
        </div>
      </a>
      <button class="save-btn" type="button"></button>`;
    const img = card.querySelector("img");
    const fallback = () => { if (img.dataset.fb) return; img.dataset.fb = "1"; img.src = generatedArt(item); };
    img.addEventListener("error", fallback);
    img.addEventListener("load", () => { if (img.naturalWidth < 20) fallback(); });
    img.src = posterOf(item);
    card.querySelector(".card-link").addEventListener("click", () => writeJson(`blackbox-title-${item.id}`, item));
    const btn = card.querySelector(".save-btn");
    const paint = () => { const s = BB.isSaved(item.id); btn.textContent = s ? "✓" : "+"; btn.classList.toggle("on", s); btn.setAttribute("aria-label", s ? `Remove ${item.title} from My List` : `Add ${item.title} to My List`); btn.title = s ? "Remove from My List" : "Add to My List"; };
    paint();
    btn.addEventListener("click", () => { BB.toggleSaved(item.id); paint(); });
    return card;
  };
  BB.row = (items, opts = {}) => {
    const wrapEl = document.createElement("div"); wrapEl.className = "row-wrap";
    const row = document.createElement("div"); row.className = "card-row";
    items.forEach((x, i) => row.append(BB.card(x, opts.ranked ? { rank: i + 1 } : {})));
    const mk = (dir, label) => { const b = document.createElement("button"); b.type = "button"; b.className = `row-arrow ${dir < 0 ? "prev" : "next"}`; b.setAttribute("aria-label", label); b.textContent = dir < 0 ? "‹" : "›"; b.addEventListener("click", () => row.scrollBy({ left: dir * row.clientWidth * .85, behavior: "smooth" })); return b; };
    wrapEl.append(mk(-1, "Scroll left"), row, mk(1, "Scroll right"));
    return wrapEl;
  };
  BB.grid = items => { const g = document.createElement("div"); g.className = "card-grid"; items.forEach(x => g.append(BB.card(x))); return g; };

  /* ---------- chrome ---------- */
  BB.mountChrome = (active) => {
    const header = document.createElement("header");
    header.className = "topbar"; header.id = "topbar";
    const q = new URLSearchParams(location.search).get("q") || "";
    header.innerHTML = `
      <a class="brand" href="/" aria-label="BlackBox home"><span class="brand-box">blackbox</span></a>
      <nav class="main-nav" aria-label="Main navigation">${NAV.map(([key, label, href]) => `<a href="${href}" ${key === active ? 'class="active" aria-current="page"' : ""}>${label}${key === "my-list" ? '<span class="nav-count" id="navCount" hidden></span>' : ""}</a>`).join("")}</nav>
      <form class="search" action="/search" method="get" role="search">
        <input id="searchInput" name="q" type="search" placeholder="Search titles, genres…" aria-label="Search titles" autocomplete="off" value="${esc(q)}">
        <button class="icon-button" type="submit" aria-label="Search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></button>
      </form>`;
    document.body.prepend(header);
    const onScroll = () => header.classList.toggle("scrolled", scrollY > 10);
    onScroll(); addEventListener("scroll", onScroll, { passive: true });
    const count = () => { const n = $("navCount"); if (!n) return; n.textContent = BB.saved.size; n.hidden = !BB.saved.size; };
    count(); document.addEventListener("bb:saved", count);

    const footer = document.createElement("footer");
    footer.className = "site-footer";
    footer.innerHTML = `<a class="brand footer-brand" href="/"><span class="brand-box">blackbox</span></a><nav class="footer-nav">${NAV.slice(1).map(([, l, h]) => `<a href="${h}">${l}</a>`).join("")}</nav><span class="footer-right">Local movie discovery · ${new Date().getFullYear()}</span>`;
    document.body.append(footer);
  };

  BB.status = "loading";
  /* ---------- PWA: service worker + install button ---------- */
  if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  let installEvent = null;
  addEventListener("beforeinstallprompt", e => {
    e.preventDefault(); installEvent = e;
    const nav = document.querySelector(".footer-nav"); if (!nav || $("installBtn")) return;
    const b = document.createElement("button"); b.id = "installBtn"; b.type = "button"; b.className = "link-btn"; b.textContent = "⬇ Install app";
    b.addEventListener("click", async () => { installEvent.prompt(); await installEvent.userChoice.catch(() => {}); installEvent = null; b.remove(); });
    nav.append(b);
  });
  addEventListener("appinstalled", () => { const b = $("installBtn"); if (b) b.remove(); });
  window.BB = BB;
})();
