/* Title preview + player pages */
(() => {
  const $ = BB.$;
  const page = document.body.dataset.page;
  const id = new URLSearchParams(location.search).get("id") || "redline";
  let item = null;

  const catOf = it => it.type === "series" ? "series" : "movies";
  const setHtml = (el, html) => { el.innerHTML = html; };

  function showMissing() {
    BB.mountChrome("");
    if (page === "preview") {
      $("previewTitle").textContent = "Title not found";
      $("previewDescription").textContent = "This title isn't in the current catalogue. Head back and pick another one.";
      $("previewFullDescription").textContent = "Choose a card on any BlackBox page to open its preview.";
      $("watchNow").disabled = true; $("previewSave").disabled = true;
    } else {
      $("playerTitle").textContent = "Title not found";
      $("playerStatus").textContent = "Title not found";
      $("playerHint").textContent = "Return to browse and select a title first.";
    }
  }

  function setupPreview() {
    BB.mountChrome(item.type === "series" ? "series" : "movies");
    document.title = `${item.title} · BlackBox`;
    $("backLink").href = `/${catOf(item)}`;
    $("backLink").querySelector("span").textContent = `Back to ${item.type === "series" ? "series" : "movies"}`;
    $("previewTitle").textContent = item.title;
    $("previewType").textContent = item.type.toUpperCase();
    const rt = BB.fmtRuntime(item.runtime);
    const meta = [item.rating ? ["preview-rating", `★ ${item.rating}`] : ["", "NR"], ["", item.year || "TBA"], rt ? ["", rt + (item.type === "series" ? " / episode" : "")] : null].filter(Boolean);
    $("previewMeta").replaceChildren(...meta.map(([cls, text]) => { const s = document.createElement("span"); s.textContent = text; if (cls) s.className = cls; return s; }));
    $("previewGenres").replaceChildren(...item.genres.map(g => { const a = document.createElement("a"); a.className = "chip"; a.href = BB.genreUrl(catOf(item), g); a.textContent = g; return a; }));
    $("previewDescription").textContent = item.description;
    $("previewFullDescription").textContent = item.description;
    BB.setBackdrop($("previewBackdrop"), item);
    const poster = $("previewPoster");
    poster.onerror = () => { poster.onerror = null; poster.src = BB.generatedArt(item); };
    poster.src = BB.posterOf(item); poster.alt = `${item.title} poster`;
    $("previewFacts").replaceChildren(...[["Release year", item.year || "TBA"], ["Rating", item.rating ? `★ ${item.rating} / 10` : "Not rated"], ["Genres", item.genre], ["Format", item.type === "series" ? "Series" : "Movie"], ["Runtime", rt ? rt + (item.type === "series" ? " per episode" : "") : "—"]].map(([label, value]) => {
      const d = document.createElement("div"); d.className = "fact-item"; const n = document.createElement("span"); n.textContent = label; const v = document.createElement("strong"); v.textContent = value; d.append(n, v); return d;
    }));
    $("previewNote").textContent = item.playbackUrl ? "A playback source is attached. The provider may still apply availability or domain limits." : "This is a catalogue title without a playback source. Watch Now opens the player, which will tell you if nothing can be played.";
    const paint = () => { $("previewSave").textContent = BB.isSaved(item.id) ? "✓ In My List" : "＋ My List"; };
    paint();
    $("previewSave").addEventListener("click", () => { BB.toggleSaved(item.id); paint(); });
    $("watchNow").addEventListener("click", () => { BB.writeJson(`blackbox-title-${item.id}`, item); location.href = `/watch.html?id=${encodeURIComponent(item.id)}`; });
    const similar = BB.items.filter(x => x.id !== item.id && x.type === item.type).map(x => ({ x, s: x.genres.filter(g => item.genres.includes(g)).length })).filter(o => o.s).sort((a, b) => b.s - a.s || Number(b.x.rating) - Number(a.x.rating)).slice(0, 12).map(o => o.x);
    if (similar.length) {
      $("similarSection").hidden = false;
      $("similarRow").replaceChildren(BB.row(similar));
      const g = item.genres[0]; $("similarLink").href = BB.genreUrl(catOf(item), g); $("similarTitle").textContent = `More ${g === "More Titles" ? "like this" : g.toLowerCase()} ${item.type === "series" ? "series" : "movies"}`;
    }
  }

  function renderPlayer() {
    BB.mountChrome(item.type === "series" ? "series" : "movies");
    document.title = `Now playing: ${item.title} · BlackBox`;
    $("playerTitle").textContent = item.title;
    $("playerMeta").textContent = [item.year || "TBA", item.genre, item.rating ? `★ ${item.rating}` : "NR", BB.fmtRuntime(item.runtime)].filter(Boolean).join(" · ");
    $("playerAboutTitle").textContent = item.title;
    $("playerDescription").textContent = item.description;
    const previewUrl = `/preview.html?id=${encodeURIComponent(item.id)}`;
    $("backToPreview").href = previewUrl; $("playerInfoLink").href = previewUrl;
    const stage = $("mediaStage");
    let src = item.playbackUrl;
    const shieldOn = () => BB.readJson("blackbox-shield", true) !== false;
    const paintShield = () => { const on = shieldOn(); const b = $("shieldToggle"); b.textContent = `🛡 Ad shield: ${on ? "ON" : "OFF"}`; b.setAttribute("aria-pressed", on); b.classList.toggle("on", on); };
    paintShield();
    $("shieldToggle").addEventListener("click", () => { BB.writeJson("blackbox-shield", !shieldOn()); paintShield(); attach(); });
    // Belt and braces: nothing on this page may open windows or navigate the tab away.
    window.open = () => null;
    $("fullscreenBtn").addEventListener("click", () => { const el = $("mediaShell"); document.fullscreenElement ? document.exitFullscreen() : (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el); });
    const drawer = open => { $("infoDrawer").hidden = !open; };
    $("infoToggle").addEventListener("click", () => drawer($("infoDrawer").hidden));
    $("infoClose").addEventListener("click", () => drawer(false));
    addEventListener("keydown", k => { if (k.key === "Escape") drawer(false); });
    const isTv = item.type === "series" && item.embedId;
    if (isTv) {
      $("episodePicker").hidden = false;
      const s = $("seasonInput"), e = $("episodeInput");
      const go = () => {
        s.value = Math.max(1, Number(s.value) || 1); e.value = Math.max(1, Number(e.value) || 1);
        src = `https://vaplayer.ru/embed/tv/${encodeURIComponent(item.embedId)}/${s.value}/${e.value}?color=ed1838&autoplay=0`;
        $("playerMeta").textContent = [`S${s.value} · E${e.value}`, item.genre, item.rating ? `★ ${item.rating}` : ""].filter(Boolean).join(" · ");
        attach();
      };
      $("playEp").addEventListener("click", go);
      $("prevEp").addEventListener("click", () => { if (Number(e.value) > 1) { e.value = Number(e.value) - 1; go(); } });
      $("nextEp").addEventListener("click", () => { e.value = Number(e.value) + 1; go(); });
      [s, e].forEach(i => i.addEventListener("keydown", k => { if (k.key === "Enter") go(); }));
    }
    function attach() {
      stage.replaceChildren();
      if (!item.playbackUrl) {
        setHtml($("mediaStatusLabel"), '<span class="media-status-dot"></span> NO SOURCE');
        const empty = document.createElement("div"); empty.className = "player-empty";
        empty.innerHTML = '<div class="player-empty-icon">▶</div><p></p><small></small>';
        empty.querySelector("p").textContent = "No playable source is attached to this title.";
        empty.querySelector("small").textContent = "Titles loaded from VidAPI with a valid playback URL will stream here. Demo cards are for interface testing.";
        stage.append(empty);
        $("playbackHelp").textContent = "This title has catalogue artwork and metadata, but no authorised playback URL.";
        return;
      }
      setHtml($("mediaStatusLabel"), '<span class="media-status-dot"></span> LOADING PROVIDER PLAYER');
      const frame = document.createElement("iframe");
      frame.className = "media-frame"; frame.src = src; frame.title = `${item.title} media player`;
      frame.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media"; frame.allowFullscreen = true;
      // Ad shield: a sandbox without allow-popups / allow-top-navigation stops popup ads and "jump" redirects of the page.
      if (shieldOn()) frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-presentation");
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      frame.addEventListener("load", () => setHtml($("mediaStatusLabel"), '<span class="media-status-dot"></span> PLAYER FRAME LOADED'), { once: true });
      stage.append(frame);
      $("playbackHelp").textContent = (shieldOn() ? "Ad shield is on: popups and page redirects from the player are blocked. If the video won't load, turn the shield off and reload. " : "Ad shield is OFF: the player may open popups or redirect. ") + "BlackBox can't confirm the video has started; playback depends on the provider, region and title ID.";
    }
    attach();
    $("reloadPlayer").addEventListener("click", attach);
  }

  item = BB.find(id);
  const start = () => { if (!item) return showMissing(); page === "preview" ? setupPreview() : renderPlayer(); };
  if (item) start();
  else BB.refresh().then(() => { item = BB.find(id); start(); }).catch(() => { item = null; start(); });
})();
