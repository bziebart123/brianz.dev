# Portfolio + Apps Monorepo (Render)

This repo is now organized for Render with a root portfolio site and app subdomains.

## Project Goal

Create a personal portfolio site at the root domain and host multiple sub-apps on subdomains for sharing and demos.

- Portfolio: `brianz.dev`
- Sub-apps: `tftduos.brianz.dev`, `site-performance.brianz.dev`, etc.
- Deploy model: GitHub push -> Render auto-deploy, no manual server management

## Structure

```txt
/portfolio          # Static site for brianz.dev
/apps/site-performance          # Site Performance dashboard (frontend-only, shared backend API)
  /client           # Vite React app
/apps/backend       # brianz backend (shared Express API service)
/apps/tftduos       # TFTDuos app sources
  /client           # Vite React app
```

## TFTDuos Deployment Model (recommended)

- Frontend: Render **Static Site** (subdomain `tftduos.brianz.dev`)
- Backend: Render **Web Service** (API only, e.g. `backend.brianz.dev` or Render URL)
- Frontend calls backend via `VITE_API_BASE_URL`
- Riot API key stays only on backend via `RIOT_API_KEY`

## Local commands

From repo root:

- `npm run build:portfolio`
- `npm run build:tftduos`
- `npm run build:site-performance`
- `npm run dev:tftduos:client`
- `npm run dev:brianz:backend`
- `npm run dev:tftduos:server` (alias for backward compatibility)
- `npm run dev:site-performance:client`

From `apps/tftduos`:

- `npm run build`
- `npm start`

From `apps/tftduos/client`:

- `npm run test`
- `npm run test:watch`
- `npm run test:coverage`

## Render setup

### Portfolio hub (Static Site)

- Service type: `Static Site`
- Root Directory: `portfolio`
- Build Command: `npm ci && npm run build`
- Publish Directory: `dist`
- Domains: `brianz.dev` and optional `www.brianz.dev`

### TFTDuos Frontend (Static Site)

- Service type: `Static Site`
- Root Directory: `apps/tftduos/client`
- Build Command: `npm ci && npm run test && npm run build`
- Publish Directory: `dist`
- Domain: `tftduos.brianz.dev`
- Env vars:
  - `VITE_API_BASE_URL=https://<your-brianz-backend-service>.onrender.com`
  - `VITE_RIOT_GAME_NAME_A`, `VITE_RIOT_TAG_LINE_A`, `VITE_RIOT_GAME_NAME_B`, `VITE_RIOT_TAG_LINE_B`
  - `VITE_RIOT_ROUTING_REGION`, `VITE_RIOT_PLATFORM_REGION`

### brianz Backend (Web Service)

- Service type: `Web Service`
- Root Directory: `apps/backend`
- Build Command: `npm ci`
- Start Command: `npm start`
- Domain: `backend.brianz.dev` (recommended) or keep Render URL
- Env vars:
  - `RIOT_API_KEY=<your key>`
  - `ALLOWED_ORIGINS=https://tftduos.brianz.dev,https://site-performance.brianz.dev,https://brianz.dev,https://www.brianz.dev`
  - `OPENAI_API_KEY=<optional, enables AI coaching brief>`
  - `OPENAI_MODEL=gpt-4o-mini` (optional)
  - `OPENAI_TIMEOUT_MS=15000` (optional)
  - `OPENAI_WEB_SEARCH_ENABLED=1` (optional; enables web-backed meta lookup during AI brief generation)
  - `RENDER_API_KEY=<required for Site Performance dashboard>`
  - `RENDER_API_BASE_URL=https://api.render.com/v1` (optional)
  - `RENDER_DASHBOARD_SERVICE_IDS=<optional comma-separated service IDs>`

### Site Performance Frontend (Static Site)

- Service type: `Static Site`
- Root Directory: `apps/site-performance/client`
- Build Command: `npm ci && npm run build`
- Publish Directory: `dist`
- Domain: `site-performance.brianz.dev`
- Env vars:
  - `VITE_API_BASE_URL=https://<your-brianz-backend-service>.onrender.com`

## Standard Render Commands

For backend Web Service apps in this repo:

- Build Command: `npm ci`
- Start Command: `npm start`

For static sites:

- Build Command: `npm ci && npm run test && npm run build`
- Publish Directory: `dist`

## CI / Test Gate

- GitHub Actions workflow: `.github/workflows/ci.yml`
- Triggers: `pull_request` and `push` on `main`
- `verify-tftduos-client`: runs `apps/tftduos/client` tests and production build.
- `verify-brianz-backend`: runs `node --check apps/backend/index.js`.
- `verify-portfolio`: runs `npm run build:portfolio`.
- `verify-site-performance-client`: builds `apps/site-performance/client`.
- Render deployment should use test-inclusive build commands so a failing test blocks publish.
- `portfolio` and `apps/backend` currently include placeholder `test` scripts (exit 0) so
test-inclusive pipelines can run consistently until real tests are added.

## DNS (Porkbun)

Use exactly what Render Custom Domains asks for:

- Apex/root domain (`brianz.dev`): Render-provided apex records (A/ALIAS/ANAME per Render)
- Subdomain (`tftduos.brianz.dev`): typically CNAME to Render target
- API subdomain (optional): CNAME to API Render service target
- `www`: usually CNAME if used

## Notes

- `.gitignore` includes `node_modules`, `.env`, and `dist` outputs.
- Legacy root app files were removed. Active deploy targets are `portfolio` and `apps/tftduos/*`.
- TFTDuos client builds now embed release metadata (`major.minor.build` + recent commit subjects) for in-app release notes display, using commit-epoch build IDs and GitHub-API-first commit notes so local/prod stay consistent even with shallow clones.
- TFTDuos Analysis tab now renders a dashboard-style analytics view with a full-width team rank trend chart, team trend KPIs, patch performance, and per-player breakdowns from filtered match data.
- TFTDuos Coaching tab now renders a dynamic coaching command center with team priorities, individualized player plans, and a stage-based action workflow driven by filtered match + event data.
- TFTDuos backend now supports optional OpenAI-powered coaching synthesis (`/api/coach/llm-brief`) with deterministic fallback output when model access is unavailable.
- The AI coaching prompt is guided for rank-climb use and now supports web-backed meta lookup (via OpenAI Responses API web search tool), plus richer per-game build fingerprints for direct "your builds vs current meta" comparison with source visibility in UI.
- Coaching UX is now AI-first: compact KPI header, primary AI briefing section, per-player action plans below, and a full-page loading state while GPT coaching is being generated.
- Coaching backend now layers deterministic evidence (leaks, win-conditions, 5-game plan, champion+item build conversion signals) into the LLM prompt/response to reduce generic output and improve actionability.
- Coaching UI now uses high-contrast custom error/warning banners and compact AI payload requests to improve readability and reduce large-timeline AI network failures.
- Coaching AI responses are cached client-side by duo/filter and reused until a newer shared match is detected, reducing repeated OpenAI calls when no new duo games were played.
- Coaching data flow is now trimmed to the active UI surface: `App.jsx` only passes `CoachingTab` the props it renders, and `useDuoAnalysis` drops unused journal/event-only client state.
- `/api/tft/duo-history` now includes a compact `rankContext` snapshot (region/platform, apex ladder population hints, sampled challenger+ ladder meta traits/champions, snapshot timestamp) so duo trends can be compared against regional high-ELO pressure.
- `rankContext` ladder sampling now uses Riot's TFT tier/division entries route (`/tft/league/v1/entries/{queue}/{tier}/{division}`) and a short backend cache window to avoid repeated heavy ladder fetches on every duo-history request.
- Analysis + Coaching now render this `rankContext` as a Regional Meta Pressure context card to keep recommendations grounded in current ladder pressure.
- Site Performance now exists as a frontend-only Render Meta Dashboard (`apps/site-performance/client`) and consumes shared backend routes under `/api/site-performance/*` from `apps/backend`.
- TFTDuos now includes extended inference modules (tilt detection, fingerprints, win-condition mining, loss autopsy, contested pressure, timing coach, coordination scoring) and an optional Wild Correlations view gated by a sidebar settings toggle.
- TFTDuos client test suite now covers key utility inference logic and integration rendering for History, Coaching, and Wild Correlations tabs.

## AI Context Files

For new IDE sessions and AI tools (including GitHub Copilot), start with:

- `.github/copilot-instructions.md` (repo-wide Copilot context/instructions)
- `AGENTS.md` (Codex-specific project direction)
- `apps/tftduos/README.md` (current app behavior and implementation notes)


