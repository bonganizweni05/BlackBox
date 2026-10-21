# BlackBox — local movie discovery and player

A dark maroon-red, Netflix-inspired discovery interface with dedicated title previews and a separate media-player page. Runs on localhost.

## Start
1. Install Node.js LTS from https://nodejs.org/ if it is not already installed.
2. Extract the ZIP.
3. Double-click `start.bat`.
4. Open http://localhost:4173 if the browser does not open automatically.

The first launch installs the Express dependency. Internet is needed for that first install and for online catalogue/artwork/player requests.

## Navigation
- **Home, Trending, Movies, Series and My List are dedicated pages** (`/trending`, `/movies`, `/series`, `/my-list`). Tapping a tab opens that page directly; nothing scrolls down the home page.
- Movies and Series are organised into genre rows (Action, Comedy, Horror, Sci-Fi and so on). "See all" or a genre chip opens that genre as a full grid.
- Every category page has a filter side panel: genre (multi-select), release decade, minimum rating, sort order, and a type switch where it applies. On phones it opens as a bottom sheet.
- Search (`/search?q=`) works from the header on every page; on a category page it narrows that category live.
- Select any card for its title page (metadata, genres, "More like this"), then **Watch Now** for the player page.
- My List is stored locally in the browser.

## What is shown
Any title with a playable `vaplayer.ru` source is shown. If VidAPI (or TMDB enrichment) doesn't supply a poster, year, rating, genre or synopsis, the card uses a generated poster, "TBA", "NR", a "More Titles" genre or a short generated description. Titles with no playback source are dropped. If nothing qualifies, the site says so.

Optional: copy `.env.example` to `.env` and set `TMDB_API_KEY` so missing posters, genres, ratings and synopses are filled in with real data. Visit `/api/status` to see how many titles were kept or dropped, and why.

Series use `https://vaplayer.ru/embed/tv/{id}/{season}/{episode}`; the player page has season and episode controls. The server looks for a VidAPI series feed (a few likely paths are tried); if yours differs, set `VIDAPI_SERIES_FEED` in `.env`, e.g. `https://vidapi.ru/xyz/latest/page-{page}.json`. A valid URL does not guarantee the stream starts; that depends on the provider.

## App install (PWA)
BlackBox is an installable app: use "Install app" in the footer, or your browser's install option (Chrome/Edge: address-bar icon; iPhone: Share → Add to Home Screen). Code files are always fetched fresh when online, posters are cached, and the app opens offline with what was already loaded.

## Player: no scroll, ad shield
The player page is locked to the screen (no page scroll). Details open in a side panel, and there is a Fullscreen button. **Ad shield** (on by default) sandboxes the player so it can't open popups or redirect the page. It cannot remove ads drawn inside the video itself. If a title won't play with the shield on, switch it off for that session.

## Structure
`public/core.js` shared data, cards and header; `app.js` home; `browse.html` + `browse.js` category pages; `preview.html`/`watch.html` + `detail-pages.js`; `styles.css`, `detail-pages.css`.

## VidAPI and playback
The catalogue endpoint used by this project is `https://vidapi.ru/movies/latest/page-1.json`; the player URL uses an IMDb/TMDb identifier or an official `vaplayer.ru` embed URL when present. Actual video playback cannot be guaranteed by the interface alone. Provider availability, valid IDs, domain permissions, network/region limits, and content rights still apply. A player frame appearing does not prove that a video has started.

Only connect streams you are authorized to access. This is an independent prototype and is not affiliated with Netflix.


## Deploy to Netlify

1. Upload this project to a Git repository, or deploy the `site` folder using Netlify's supported project import flow.
2. In Netlify, set **Base directory** to `site` if the repository contains the parent folder; leave it blank if the repository root is already this folder.
3. Netlify detects `netlify.toml`. The static site is published from `public`; `/api/*` is handled by a Netlify Function.
4. In **Site configuration → Environment variables**, add `TMDB_API_KEY` with your TMDB API key. Optionally add `VIDAPI_SERIES_FEED` if you know the exact series-feed URL (include `{page}` where the page number belongs).
5. Trigger a new deploy after adding or changing environment variables.

For local use, copy `.env.example` to `.env` and put your real key after `TMDB_API_KEY=`. The generated `.env` in this package intentionally has a blank value because no key was supplied. Keep `.env` private; do not commit it or put the key in browser JavaScript. Netlify uses its Environment Variables settings, not the local `.env` file, for production secrets.

The serverless API function uses the existing Express routes. Netlify Functions are subject to execution time and memory limits; upstream VidAPI/TMDB availability and playable stream permissions are not guaranteed by deployment itself.
