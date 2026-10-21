/* Home page */
(() => {
  BB.mountChrome("home");
  const $ = BB.$;
  let featured = [], idx = 0, timer = null;

  function pickFeatured() {
    featured = BB.items.filter(x => x.trend).sort((a, b) => b.trend - a.trend).slice(0, 5);
    if (!featured.length) featured = BB.items.slice(0, 5);
  }
  function showHero(i, user) {
    idx = (i + featured.length) % featured.length;
    const it = featured[idx];
    const art = $("heroArt");
    BB.setBackdrop(art, it);
    art.classList.remove("swap"); void art.offsetWidth; art.classList.add("swap");
    const poster = $("heroPoster");
    poster.onerror = () => { poster.onerror = null; poster.src = BB.generatedArt(it); };
    poster.src = BB.posterOf(it); poster.alt = `${it.title} poster`;
    const rt = BB.fmtRuntime(it.runtime);
    $("heroContent").innerHTML = `
      <div class="eyebrow"><span class="live-dot"></span> ${idx === 0 ? "FEATURED TONIGHT" : "TRENDING ON BLACKBOX"}</div>
      <h1>${BB.esc(it.title)}</h1>
      <div class="hero-meta">${it.rating ? `<span class="rating">★ ${it.rating}</span>` : ""}<span>${it.year || "TBA"}</span>${rt ? `<span>${rt}</span>` : ""}<span class="tag">${it.type === "series" ? "SERIES" : "MOVIE"}</span></div>
      <div class="chips">${it.genres.slice(0, 3).map(g => `<a class="chip" href="${BB.genreUrl(it.type === "series" ? "series" : "movies", g)}">${BB.esc(g)}</a>`).join("")}</div>
      <p class="hero-description">${BB.esc(it.description)}</p>
      <div class="hero-buttons">
        <a class="btn btn-primary" href="/watch.html?id=${encodeURIComponent(it.id)}" data-id="${BB.esc(it.id)}">▶ Play</a>
        <a class="btn btn-glass" href="/preview.html?id=${encodeURIComponent(it.id)}" data-id="${BB.esc(it.id)}">ⓘ More info</a>
      </div>`;
    $("heroContent").querySelectorAll("[data-id]").forEach(a => a.addEventListener("click", () => BB.writeJson(`blackbox-title-${it.id}`, it)));
    $("heroDots").querySelectorAll("button").forEach((b, n) => { b.classList.toggle("on", n === idx); b.setAttribute("aria-selected", n === idx); });
    clearInterval(timer); timer = setInterval(() => showHero(idx + 1), 8000);
  }
  function heroDots() {
    $("heroDots").replaceChildren(...featured.map((f, n) => { const b = document.createElement("button"); b.type = "button"; b.role = "tab"; b.setAttribute("aria-label", `Show ${f.title}`); b.addEventListener("click", () => showHero(n)); return b; }));
  }

  function section(overline, title, href, linkText, content, id) {
    const s = document.createElement("section"); s.className = "content-section"; if (id) s.id = id;
    s.innerHTML = `<div class="section-heading"><div><p class="section-overline">${overline}</p><h2>${title}</h2></div>${href ? `<a href="${href}" class="view-all">${linkText} <span>→</span></a>` : ""}</div>`;
    s.append(content); return s;
  }
  function renderRows() {
    const rows = [];
    const trending = [...BB.items].sort((a, b) => b.trend - a.trend || Number(b.rating) - Number(a.rating)).slice(0, 10);
    rows.push(section("WHAT EVERYONE'S WATCHING", "Trending now", "/trending", "See all trending", BB.row(trending, { ranked: true })));
    const movies = BB.items.filter(x => x.type === "movie");
    ["Horror", "Comedy", "Action", "Sci-Fi", "Animation", "Romance"].forEach(g => {
      const list = movies.filter(x => x.genres.includes(g)).sort((a, b) => Number(b.rating) - Number(a.rating)).slice(0, 12);
      if (list.length >= 3) rows.push(section("MOVIES", g, BB.genreUrl("movies", g), `All ${g.toLowerCase()} movies`, BB.row(list)));
    });
    const series = BB.items.filter(x => x.type === "series").sort((a, b) => b.trend - a.trend || Number(b.rating) - Number(a.rating)).slice(0, 12);
    if (series.length) rows.push(section("ONE MORE EPISODE?", "Binge-worthy series", "/series", "All series", BB.row(series)));
    const mine = BB.items.filter(x => BB.isSaved(x.id));
    if (mine.length) rows.push(section("SAVED FOR LATER", "My list", "/my-list", "Open My List", BB.row(mine)));
    $("homeRows").replaceChildren(...rows);
  }
  function renderTiles() {
    const movieCount = BB.items.filter(x => x.type === "movie").length, seriesCount = BB.items.length - movieCount;
    const tiles = [
      ["/movies", "Movies", `${movieCount} titles`, 352], ["/series", "Series", `${seriesCount} titles`, 205], ["/trending", "Trending", "Most watched now", 28], ["/my-list", "My List", `${BB.saved.size} saved`, 285]
    ].map(([href, name, sub, hue]) => `<a class="tile" href="${href}" style="--h:${hue}"><strong>${name}</strong><span>${sub}</span><i>→</i></a>`).join("");
    const genres = BB.genreList(BB.items.filter(x => x.type === "movie")).filter(([g]) => g !== "More Titles").slice(0, 12)
      .map(([g, n]) => `<a class="chip chip-lg" href="${BB.genreUrl("movies", g)}">${BB.esc(g)} <small>${n}</small></a>`).join("");
    $("categoryTiles").innerHTML = tiles + `<div class="chip-strip">${genres}</div>`;
  }
  function render() {
    if (!BB.items.length) {
      $("hero").hidden = true; $("homeRows").replaceChildren(); document.querySelector("#catHeading").closest("section").hidden = true;
      $("homeRows").innerHTML = `<section class="content-section"><div class="empty"><h2>${BB.status === "ready" ? "No playable titles right now" : "Loading catalogue…"}</h2><p>BlackBox only shows titles that have a playable VidAPI source.</p></div></section>`;
      return;
    }
    $("hero").hidden = false; document.querySelector("#catHeading").closest("section").hidden = false;
    pickFeatured(); heroDots(); showHero(idx % Math.max(featured.length, 1)); renderTiles(); renderRows(); }
  render();
  document.addEventListener("bb:catalog", render);
  document.addEventListener("bb:saved", () => renderRows());
  BB.refresh();
})();
