# Copilot Repository Instructions

This monorepo hosts a personal portfolio site and multiple sub-apps.

## Primary Product Direction

- Root domain (`brianz.dev`) serves the portfolio hub.
- Subdomains serve app experiences (currently `tftduos`).
- Goal is demo-ready, maintainable apps with push-to-deploy on Render.

## Canonical Project Structure

- `portfolio/`: static portfolio site.
- `apps/tftduos/client`: Vite + React + Evergreen UI frontend.
- `apps/backend`: Node + Express shared API backend for Riot/TFT data + site performance metrics.
- Root legacy app/server files were removed; use `portfolio/` and `apps/*` paths only.

## Deployment Model (Render)

- Portfolio: Render Static Site from `portfolio/`.
- TFT frontend: Render Static Site from `apps/tftduos/client`.
- Shared backend: Render Web Service from `apps/backend`.
- Frontend calls backend via `VITE_API_BASE_URL`.

## Environment Variables

Frontend (`apps/tftduos/client`):

- `VITE_API_BASE_URL`
- `VITE_RIOT_GAME_NAME_A`
- `VITE_RIOT_TAG_LINE_A`
- `VITE_RIOT_GAME_NAME_B`
- `VITE_RIOT_TAG_LINE_B`
- `VITE_RIOT_ROUTING_REGION`
- `VITE_RIOT_PLATFORM_REGION`

Backend (`apps/backend`):

- `RIOT_API_KEY`
- `ALLOWED_ORIGINS`
- Optional rate-limit/debug vars in server code.

Never hardcode secrets.

## TFTDuos Current UX/Data Decisions

- Hardcoded duo identities come from frontend env vars.
- Team placement in History is duo-team rank (`1..4`), not individual (`1..8`).
- KPI uses `Team Top 2` as top-half finish.
- Match history cards show:
  - team placement chip + LP estimate chip
  - set/patch/date (date only)
  - per-player units as 10 board slots (empty placeholders shown)
  - per-unit filled stars only (`*`, `**`, `***`).
- Trait icon backgrounds are tier-coded (bronze/silver/gold/prismatic).
- UI is intentionally scaled up for accessibility/readability.

## Coding Conventions For This Repo

- Prefer small focused components/hooks/utils over large files.
- Keep UI changes in `client/src/components`, logic in `client/src/utils`/hooks.
- Keep backend API logic in `apps/backend/index.js` and `apps/backend/lib/*`.
- Validate with builds after meaningful changes:
  - `npm --prefix apps/tftduos/client run build`
  - `node --check apps/backend/index.js`

## When Making Changes

- Preserve existing accessibility/readability choices unless asked otherwise.
- Avoid reverting unrelated existing edits.
- Keep docs in sync when behavior changes:
  - `README.md`
  - `apps/tftduos/README.md`
  - this file.
