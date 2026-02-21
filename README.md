# Portfolio + Apps Monorepo (Render)

This repo is now organized for Render with a root portfolio site and app subdomains.

## Project Goal

Create a personal portfolio site at the root domain and host multiple sub-apps on subdomains for sharing and demos.

- Portfolio: `brianz.dev`
- Sub-apps: `tftduos.brianz.dev`, `app2.brianz.dev`, etc.
- Deploy model: GitHub push -> Render auto-deploy, no manual server management

## Structure

```txt
/portfolio          # Static site for brianz.dev
/apps/tftduos       # TFTDuos app sources
  /client           # Vite React app
  /server           # Express API service
```

## TFTDuos Deployment Model (recommended)

- Frontend: Render **Static Site** (subdomain `tftduos.brianz.dev`)
- Backend: Render **Web Service** (API only, e.g. `tftduos-api.onrender.com`)
- Frontend calls backend via `VITE_API_BASE_URL`
- Riot API key stays only on backend via `RIOT_API_KEY`

## Local commands

From repo root:

- `npm run build:portfolio`
- `npm run build:tftduos`
- `npm run dev:tftduos:client`
- `npm run dev:tftduos:server`

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

### TFTDuos (Web Service)

### TFTDuos Frontend (Static Site)

- Service type: `Static Site`
- Root Directory: `apps/tftduos/client`
- Build Command: `npm ci && npm run test && npm run build`
- Publish Directory: `dist`
- Domain: `tftduos.brianz.dev`
- Env vars:
  - `VITE_API_BASE_URL=https://<your-tftduos-api-service>.onrender.com`
  - `VITE_RIOT_GAME_NAME_A`, `VITE_RIOT_TAG_LINE_A`, `VITE_RIOT_GAME_NAME_B`, `VITE_RIOT_TAG_LINE_B`
  - `VITE_RIOT_ROUTING_REGION`, `VITE_RIOT_PLATFORM_REGION`

### TFTDuos API (Web Service)

- Service type: `Web Service`
- Root Directory: `apps/tftduos/server`
- Build Command: `npm ci`
- Start Command: `npm start`
- Domain: optional custom API domain (or keep Render URL)
- Env vars:
  - `RIOT_API_KEY=<your key>`
  - `ALLOWED_ORIGINS=https://tftduos.brianz.dev,https://brianz.dev,https://www.brianz.dev`

## Standard Render Commands

For backend Web Service apps in this repo:

- Build Command: `npm ci`
- Start Command: `npm start`

For static sites:

- Build Command: `npm ci && npm run test && npm run build`
- Publish Directory: `dist`

## CI / Test Gate

- GitHub Actions workflow: `.github/workflows/ci.yml`
- Trigger: push to `main`
- Current job runs `apps/tftduos/client` tests with Vitest.
- Render deployment should use test-inclusive build commands so a failing test blocks publish.
- `portfolio` and `apps/tftduos/server` currently include placeholder `test` scripts (exit 0) so
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
- TFTDuos client builds now embed release metadata (major/minor + recent commit subjects) for in-app release notes display.

## AI Context Files

For new IDE sessions and AI tools (including GitHub Copilot), start with:

- `.github/copilot-instructions.md` (repo-wide Copilot context/instructions)
- `AGENTS.md` (Codex-specific project direction)
- `apps/tftduos/README.md` (current app behavior and implementation notes)

