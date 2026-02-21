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

## Environment

Client env vars (see `client/.env.example`):

- `VITE_API_BASE_URL`
- Riot game names/tags/regions (`VITE_RIOT_*`)

Server env vars (see `../.env.example` and server code):

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

## Notes

- If changing match presentation rules, also update:
  - `client/src/utils/tft.js`
  - `client/src/components/tabs/HistoryTab.jsx`
  - `.github/copilot-instructions.md`
