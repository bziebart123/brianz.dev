# TFTDuos App

TFT duo coaching/analysis sub-app in the portfolio monorepo.

## Architecture

- `client/`: Vite + React + Evergreen UI
- `server/`: Express API (Riot integration + analytics helpers)

## Local Development

From repo root:

- `npm run dev:tftduos:client`
- `npm run dev:tftduos:server`

From `apps/tftduos`:

- `npm run dev:client`
- `npm run dev:server`
- `npm run build`
- `npm start`

From `apps/tftduos/client`:

- `npm run test`
- `npm run test:watch`
- `npm run test:coverage`

## Environment

Client env vars (see `client/.env.example`):

- `VITE_API_BASE_URL`
- Riot game names/tags/regions (`VITE_RIOT_*`)

Server env vars (see `.env.example` and server code):

- `RIOT_API_KEY` (required)
- `ALLOWED_ORIGINS`

## Current Product Behavior

- History uses duo team placement rank `1..4` (derived from partner groups/lobby data).
- KPI includes `Team Top 2` (top-half) and team win rate.
- Match cards show:
  - Team chip + LP estimate chip
  - Set/Patch/Date
  - Both player boards as exactly 10 slots
  - Empty placeholders for unused board slots
  - Champion star strips (filled stars only)
- Trait icons are tier-colored with distinct bronze/silver/gold/prismatic styles.
- UI text/icons are scaled up for readability.
- Left sidebar keeps the Refresh Data action anchored at the viewport bottom while upper sidebar content scrolls independently.
- Mobile layout uses a filter drawer (left sidebar becomes a slide-in panel with overlay and close action) opened from a top `Menu` button.
- On mobile breakpoints, History banner/KPI/player grids stack into a single column for readable vertical flow.
- Mobile drawer controls use plain ASCII glyphs (`<`, `X`) to avoid missing-symbol fallback (`?`) on constrained font stacks.
- Sidebar now includes a `Release` panel showing `major.minor` version and recent release notes sourced from recent git commit subjects.
- Global shell `zoom` scaling was removed; text sizing now comes from `TEXT_SCALE` in `client/src/config/constants.js` (currently `1.45`), applied to typography/UI text surfaces (headings, tabs, buttons, selects, badges) while layout dimensions stay stable.
- Main content (`History`, `Analysis`, `Coaching`) now has an additional dedicated text scale (`--bz-content-text-scale` in `client/src/theme.css`) so right-panel readability can be increased without changing sidebar or layout geometry.
- `History` now enforces larger, consistent placement/LP chip text and uses larger champion unit slots while keeping rows single-line (desktop clips overflow; mobile allows touch horizontal scroll without showing scrollbars).
- Player stat badges in `History` (`#placement`, `Lvl`, `Dmg`) now use tighter padding and a slightly smaller font than LP/team chips for clearer visual hierarchy.
- Champion unit slots in `History` are tuned to remain larger but fit without row scrollbars, and sidebar filter dropdown text is slightly reduced to avoid vertical clipping.
- Analysis tab is now a dashboard-style view with:
  - Team KPI strip (avg placement, top2/win rates, volatility, decision grade, rescue/clutch)
  - Full-width trend graph box (team placement + both player damage trends)
  - Team trend visuals (placement distribution + momentum)
  - Patch performance table derived from filtered matches
  - Meta pressure (traits/units in current lobbies) plus suggested adjustments
  - Individual player breakdown cards (placement/damage/level consistency and top trait/unit profiles), rendered side-by-side on desktop
- Several analysis metrics are extrapolated client-side from filtered match payloads (for example momentum, volatility, patch ranking, and per-player consistency).
- Timeline auto-default selection now prioritizes `30` days before shorter windows.

## Testing

- Test runner: Vitest + Testing Library (client)
- Config: `client/vitest.config.js`
- Test setup: `client/src/test/setup.js`
- Initial UI coverage includes History page rendering behavior:
  - `client/src/components/tabs/HistoryTab.test.jsx`

CI:

- GitHub workflow: `.github/workflows/ci.yml`
- Runs on push to `main` and executes client tests.
- Recommended Render frontend build command:
  - `npm ci && npm run test && npm run build`

## Notes

- If changing match presentation rules, also update:
  - `client/src/utils/tft.js`
  - `client/src/components/tabs/HistoryTab.jsx`
  - `.github/copilot-instructions.md`
- Legacy root runtime files were removed; use only `apps/tftduos/client` and `apps/tftduos/server` paths for dev/deploy.
- `client/src/hooks/useDuoAnalysis.js` keeps an identity-stable empty `matches` list and skips redundant manifest resets to prevent React effect loops (`Maximum update depth exceeded`) before payload data loads.
- `client/vite.config.js` now injects build-time release metadata:
  - `__TFTDUOS_VERSION__` from `client/package.json` (`major.minor`)
  - `__TFTDUOS_RELEASE_NOTES__` from recent `git log` commit subjects
