const express = require("express");
const path = require("path");
try { process.loadEnvFile(path.join(__dirname, ".env")); } catch { /* .env is optional */ }
const app = express();
const PORT = Number(process.env.PORT || 4173);
const CATALOG_TTL_MS = 5 * 60 * 1000;
const catalogCache = new Map();
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "payment=(), usb=(), geolocation=()");
  // Only the VidAPI player may be framed, so no other site can be embedded or redirected into the page.
  res.setHeader("Content-Security-Policy", "frame-src https://vaplayer.ru; object-src 'none'; base-uri 'self'; form-action 'self'");
  if (req.path === "/sw.js") res.setHeader("Service-Worker-Allowed", "/");
  next();
});
app.use(express.static(path.join(__dirname, "public"), {
  etag: true,
  maxAge: "1h",
  setHeaders(res, filePath) {
    if (/\.(html|js|css)$/.test(filePath)) res.setHeader("Cache-Control", "no-cache");
  }
}));

function asImageUrl(value, size = "w500") {
  if (!value) return "";
  const text = String(value);
  if (/^https?:\/\//i.test(text)) return text;
  return `https://image.tmdb.org/t/p/${size}${text.startsWith("/") ? text : `/${text}`}`;
}
const GENRE_IDS = {28:"Action",12:"Adventure",16:"Animation",35:"Comedy",80:"Crime",99:"Documentary",18:"Drama",10751:"Family",14:"Fantasy",36:"History",27:"Horror",10402:"Music",9648:"Mystery",10749:"Romance",878:"Sci-Fi",10770:"TV Movie",53:"Thriller",10752:"War",37:"Western",10759:"Action",10765:"Sci-Fi",10768:"War"};
function extractGenres(item) {
  const raw = item.genres || item.genre || item.genre_ids || [];
  const list = Array.isArray(raw) ? raw : String(raw).split(/[,|·/]/);
  return list.map(g => (g && typeof g === "object") ? (g.name || GENRE_IDS[g.id]) : (typeof g === "number" || /^\d+$/.test(String(g)) ? GENRE_IDS[Number(g)] : String(g).trim())).filter(Boolean);
}
function makePlaybackUrl(item, embedId, type) {
  const supplied = String(item.embed_url || item.embedUrl || "");
  if (supplied.startsWith("https://vaplayer.ru/embed/")) return supplied;
  if (!embedId) return "";
  return type === "series"
    ? `https://vaplayer.ru/embed/tv/${encodeURIComponent(embedId)}/1/1?color=ed1838&autoplay=0`
    : `https://vaplayer.ru/embed/movie/${encodeURIComponent(embedId)}?color=ed1838&autoplay=0`;
}
function normalizePayload(payload, page, forceType) {
  const source = Array.isArray(payload) ? payload : (payload.items || payload.results || payload.movies || payload.data || []);
  return source.map((item, index) => {
    const imdb = String(item.imdb_id || item.imdbId || item.movie_imdb_id || "");
    const tmdb = String(item.tmdb_id || item.tmdbId || item.movie_tmdb_id || item.id || "");
    const embedId = imdb.startsWith("tt") ? imdb : tmdb;
    const poster = item.poster_url || item.poster_path || item.poster || item.image || "";
    const backdrop = item.backdrop_url || item.backdrop_path || item.backdrop || "";
    const type = forceType || String(item.type || item.media_type || "movie").toLowerCase();
    const normType = type === "tv" || type === "show" || type === "series" ? "series" : "movie";
    const playbackUrl = makePlaybackUrl(item, embedId, normType);
    return {
      id: (normType === "series" ? "tv-" : "") + String(embedId || item.id || `vidapi-${page}-${index}`),
      title: item.title || item.name || item.movie_title || "Untitled",
      year: Number(String(item.release_date || item.year || "").slice(0, 4)) || "",
      rating: item.rating != null && Number(item.rating) > 0 ? Number(item.rating).toFixed(1) : (item.vote_average ? Number(item.vote_average).toFixed(1) : ""),
      genres: extractGenres(item),
      runtime: Number(item.runtime || item.duration || 0) || 0,
      type: normType,
      embedId: String(embedId || ""),
      seasons: Number(item.number_of_seasons || item.seasons || 0) || 0,
      tmdbId: /^\d+$/.test(tmdb) ? tmdb : "",
      imdbId: imdb.startsWith("tt") ? imdb : "",
      description: item.overview || item.description || "",
      image: asImageUrl(poster),
      backdrop: asImageUrl(backdrop, "original") || asImageUrl(poster, "original"),
      playbackUrl,
      row: type === "series" || type === "tv" ? "series" : (index < 5 ? "trending" : "originals")
    };
  });
}

// ---- Optional TMDB enrichment (set TMDB_API_KEY in .env) to fill gaps in the VidAPI feed ----
const TMDB_KEY = process.env.TMDB_API_KEY || "";
const tmdbCache = new Map();
async function tmdbLookup(item) {
  const kind = item.type === "series" ? "tv" : "movie";
  const key = `${kind}:${item.tmdbId || item.imdbId}`;
  if (tmdbCache.has(key)) return tmdbCache.get(key);
  let detail = null;
  try {
    let id = item.tmdbId;
    if (!id && item.imdbId) {
      const f = await (await fetch(`https://api.themoviedb.org/3/find/${item.imdbId}?external_source=imdb_id&api_key=${TMDB_KEY}`, { signal: AbortSignal.timeout(6000) })).json();
      const hit = (f.movie_results || [])[0] || (f.tv_results || [])[0];
      id = hit && hit.id;
    }
    if (id) {
      const r = await fetch(`https://api.themoviedb.org/3/${kind}/${id}?api_key=${TMDB_KEY}`, { signal: AbortSignal.timeout(6000) });
      if (r.ok) detail = await r.json();
    }
  } catch (e) { /* leave gaps; validation will drop the title */ }
  tmdbCache.set(key, detail);
  return detail;
}
async function enrich(item) {
  if (!TMDB_KEY || (item.image && item.description && item.genres.length && item.year && item.rating)) return item;
  const d = await tmdbLookup(item);
  if (!d) return item;
  return {
    ...item,
    title: item.title === "Untitled" ? (d.title || d.name || item.title) : item.title,
    year: item.year || Number(String(d.release_date || d.first_air_date || "").slice(0, 4)) || "",
    rating: item.rating || (d.vote_average ? Number(d.vote_average).toFixed(1) : ""),
    genres: item.genres.length ? item.genres : (d.genres || []).map(g => g.name),
    runtime: item.runtime || d.runtime || (d.episode_run_time || [])[0] || 0,
    description: item.description || d.overview || "",
    image: item.image || asImageUrl(d.poster_path),
    backdrop: item.backdrop || asImageUrl(d.backdrop_path, "original")
  };
}

// A title is shown whenever it has a playback source.
function missingFields(i) {
  // Only a playback source is mandatory; missing metadata gets display fallbacks in the browser.
  return /^https:\/\/vaplayer\.ru\/embed\//.test(i.playbackUrl || "") ? [] : ["playbackUrl"];
}
const dropStats = { kept: 0, dropped: 0, reasons: {} };
async function buildCatalog(payload, page, forceType) {
  const items = await Promise.all(normalizePayload(payload, page, forceType).map(enrich));
  const kept = [];
  items.forEach(i => {
    const miss = missingFields(i);
    if (miss.length) { dropStats.dropped++; miss.forEach(m => dropStats.reasons[m] = (dropStats.reasons[m] || 0) + 1); }
    else { dropStats.kept++; kept.push(i); }
  });
  return kept;
}
app.get("/api/status", (_req, res) => res.json({ tmdbEnrichment: !!TMDB_KEY, ...dropStats }));

// Series feed location. Set VIDAPI_SERIES_FEED (use {page}) if you know the exact URL;
// otherwise a few likely paths are tried once and the first that works is remembered.
const SERIES_CANDIDATES = [process.env.VIDAPI_SERIES_FEED, "https://vidapi.ru/tvshows/latest/page-{page}.json", "https://vidapi.ru/series/latest/page-{page}.json", "https://vidapi.ru/tv/latest/page-{page}.json", "https://vidapi.ru/shows/latest/page-{page}.json"].filter(Boolean);
let seriesFeed = null;
async function fetchJson(url) {
  const r = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
async function fetchFeed(kind, page) {
  if (kind !== "series") return fetchJson(`https://vidapi.ru/movies/latest/page-${page}.json`);
  if (seriesFeed) return fetchJson(seriesFeed.replace("{page}", page));
  for (const template of SERIES_CANDIDATES) {
    try {
      const payload = await fetchJson(template.replace("{page}", page));
      const list = Array.isArray(payload) ? payload : (payload.items || payload.results || payload.movies || payload.data || payload.shows || []);
      if (list.length) { seriesFeed = template; console.log("VidAPI series feed found:", template); return payload; }
    } catch { /* try next candidate */ }
  }
  throw new Error("No VidAPI series feed found. Set VIDAPI_SERIES_FEED in .env (use {page}).");
}

app.get("/api/catalog", async (req, res) => {
  const page = Math.max(1, Math.min(100, Number.parseInt(req.query.page || "1", 10) || 1));
  const kind = req.query.kind === "series" ? "series" : "movies";
  const cacheKey = `${kind}:${page}`;
  const cached = catalogCache.get(cacheKey);
  if (cached && Date.now() - cached.savedAt < CATALOG_TTL_MS) {
    res.setHeader("X-Catalog-Cache", "HIT");
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=240");
    return res.json(cached.data);
  }
  try {
    const payload = await fetchFeed(kind, page);
    const data = { page: payload.page || page, total: payload.total || null, items: await buildCatalog(payload, page, kind === "series" ? "series" : undefined) };
    if (!data.items.length) { console.warn(`No playable ${kind} on page ${page}`, JSON.stringify(dropStats)); return res.json(data); }
    catalogCache.set(cacheKey, { savedAt: Date.now(), data });
    res.setHeader("X-Catalog-Cache", "MISS");
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=240");
    return res.json(data);
  } catch (error) {
    console.error(`VidAPI ${kind} error:`, error.message);
    if (cached) { res.setHeader("X-Catalog-Cache", "STALE"); return res.json(cached.data); }
    return res.status(502).json({ error: `VidAPI ${kind} is unavailable right now` });
  }
});

// Dedicated category pages
const CATEGORY_ROUTES = ["/movies", "/series", "/trending", "/my-list", "/search"];
app.get(CATEGORY_ROUTES, (_req, res) => { res.setHeader("Cache-Control", "no-cache"); res.sendFile(path.join(__dirname, "public", "browse.html")); });

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
if (require.main === module) {
  app.listen(PORT, "127.0.0.1", () => console.log(`BlackBox is running at http://localhost:${PORT}`));
}

module.exports = app;
