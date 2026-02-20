# Project Context For Codex

## Primary Goal
Build and maintain a **personal portfolio hub with sub-apps**:
- root domain: portfolio site
- subdomains: individual apps for experiments/fun that can be shared with others

## Product Intent
- The repo is a platform for multiple personal apps.
- `tftduos` (TFT Duo coach) is one sub-app inside that platform.
- Keep apps deployable, presentable, and easy to demo.

## Current Architecture
- Monorepo layout:
  - `portfolio/` -> static portfolio hub (Render Static Site, root domain)
  - `apps/tftduos/` -> TFT app split into frontend + backend services
  - `apps/tftduos/client/` -> Vite + React + Evergreen UI frontend
  - `apps/tftduos/server/` -> Node + Express backend API (`/api` routes)
- Canonical frontend entry:
  - `apps/tftduos/client/src/App.jsx`
- `src/App.jsx` at repo root is a re-export shim for editor convenience.

## Deployment Intent
- Root domain serves portfolio (`brianz.dev`, optional `www`).
- Subdomains serve apps (`tftduos.brianz.dev`, `app2.brianz.dev`, etc.).
- Deploys should be GitHub push -> Render auto deploy.
- TFTDuos should deploy as:
  - frontend Static Site (`apps/tftduos/client`)
  - backend Web Service (`apps/tftduos/server`)

## Data And Config
- Frontend Riot IDs/regions come from client env vars:
  - `VITE_API_BASE_URL`
  - `VITE_RIOT_GAME_NAME_A`
  - `VITE_RIOT_TAG_LINE_A`
  - `VITE_RIOT_GAME_NAME_B`
  - `VITE_RIOT_TAG_LINE_B`
  - `VITE_RIOT_ROUTING_REGION`
  - `VITE_RIOT_PLATFORM_REGION`
- Server Riot key comes from:
  - `apps/tftduos/.env` (`RIOT_API_KEY`)
  - `ALLOWED_ORIGINS` for CORS allowlist
- Never hardcode secrets.

## UI/UX Priorities
- Keep the layout clean and readable.
- Maintain larger text/icon scale for low-vision usability.
- Left rail filters (timeline/set/patch) must reliably affect displayed data.
- Coaching tab should remain analysis-rich and actionable.

## Engineering Priorities
- Prefer separation of concerns (small files, focused components/hooks/utils).
- Avoid regressions in filtering, API integration, and coaching workflows.
- Validate with builds after meaningful changes.

## Git And Deploy Workflow
1. Keep `.gitignore` excluding `node_modules`, `.env`, and build artifacts.
2. Commit/push to GitHub from repo root.
3. Render services should be connected to this repo with auto-deploy enabled.
4. Production secrets must be configured in Render Environment settings, not local `.env`.
5. DNS in Porkbun must match exactly what Render Custom Domains requests.

## What To Optimize Next
1. Better coaching insight quality (more actionable, less generic).
2. Stable and transparent filtering behavior.
3. Maintainable code structure (continue splitting large modules when needed).
4. Reliable Render deployment workflow.

