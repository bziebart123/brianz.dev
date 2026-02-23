# Site Performance - 40K Companion Console

`site-performance` is now a static frontend companion app for Warhammer 40,000 play sessions. It keeps the same portfolio visual language and centers the UX on a terminal-style quick-reference workflow for forgotten rules and turn sequencing.

## Architecture

- Frontend: `apps/site-performance/client` (Vite + React)
- No backend dependency required for core terminal references
- No dedicated `apps/site-performance/server` required

## Local development

From repo root:

- `npm run dev:site-performance:client`
- Local dev URL is pinned to `http://localhost:4174` (`strictPort` enabled in `apps/site-performance/client/vite.config.js`).

## Site Performance frontend env vars

See `apps/site-performance/client/.env.example`:

- `VITE_API_BASE_URL` (currently unused by the 40K console, kept for compatibility)

## UI notes

- `apps/site-performance/client/src/theme.css` now includes a denser animated starfield/glow background layer (`body::before`/`body::after`) behind dashboard content (brighter specks + drift motion) to better match the broader portfolio aesthetic while preserving panel readability.
- Main app view is a full terminal panel in `apps/site-performance/client/src/App.jsx`.
- Styling in `apps/site-performance/client/src/theme.css` mirrors the portfolio terminal chrome (gradient shell, luminous border, terminal header/body/prompt treatment).
- The terminal supports command-driven quick refs (`help`, `phases`, `command-points`, `scoring`, `terrain`, `save-sequence`, `factions`, `checklist`, `clear`, `boot`).
