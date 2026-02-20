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
/apps/tftduos       # Web Service for tftduos.brianz.dev
  /client           # Vite React app
  /server           # Express API + static hosting of client/dist
```

## TFTDuos Deployment Model (single Render Web Service)

- Build: client is built to `apps/tftduos/client/dist`
- Start: Node server in `apps/tftduos/server/index.js`
- API routes: mounted under `/api`
- Static hosting: serves `../client/dist`
- SPA fallback: non-`/api` routes return `index.html`
- Port: uses `process.env.PORT`

## Local commands

From repo root:

- `npm run build:portfolio`
- `npm run build:tftduos`
- `npm run dev:tftduos:client`
- `npm run dev:tftduos:server`

From `apps/tftduos`:

- `npm run build`
- `npm start`

## Render setup

### Portfolio hub (Static Site)

- Service type: `Static Site`
- Root Directory: `portfolio`
- Build Command: `npm ci && npm run build`
- Publish Directory: `dist`
- Domains: `brianz.dev` and optional `www.brianz.dev`

### TFTDuos (Web Service)

- Service type: `Web Service`
- Root Directory: `apps/tftduos`
- Build Command: `npm ci && npm run build`
- Start Command: `npm start`
- Domain: `tftduos.brianz.dev`
- Env vars: configure in Render dashboard (`RIOT_API_KEY`, etc.)

## Standard Render Commands

For Web Service apps in this repo, keep commands consistent:

- Build Command: `npm ci && npm run build`
- Start Command: `npm start`

For static portfolio:

- Build Command: `npm ci && npm run build`
- Publish Directory: `dist`

## DNS (Porkbun)

Use exactly what Render Custom Domains asks for:

- Apex/root domain (`brianz.dev`): Render-provided apex records (A/ALIAS/ANAME per Render)
- Subdomain (`tftduos.brianz.dev`): typically CNAME to Render target
- `www`: usually CNAME if used

## Notes

- `.gitignore` includes `node_modules`, `.env`, and `dist` outputs.
- Existing legacy root app files are still present, but canonical deploy targets are now under `portfolio` and `apps/tftduos`.

