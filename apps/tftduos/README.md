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
