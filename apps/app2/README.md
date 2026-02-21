# app2 - Render Meta Dashboard

`app2` is a static frontend that visualizes Render service performance by calling the existing shared backend (`apps/tftduos/server`).

## Architecture

- Frontend: `apps/app2/client` (Vite + React)
- Backend API source: shared TFT backend route namespace (`/api/app2/*`)
- No dedicated `apps/app2/server` required

## Local development

From repo root:

- `npm run dev:tftduos:server`
- `npm run dev:app2:client`

By default, app2 frontend proxies `/api` to `http://localhost:3001` via Vite.

## App2 frontend env vars

See `apps/app2/client/.env.example`:

- `VITE_API_BASE_URL` (optional; defaults to same-origin `/api`)

## Shared backend env vars

The shared backend (`apps/tftduos/server`) must include:

- `RENDER_API_KEY` (required for app2 metrics)
- `RENDER_API_BASE_URL` (optional, default: `https://api.render.com/v1`)
- `RENDER_DASHBOARD_SERVICE_IDS` (optional comma-separated service IDs to scope dashboard)

## API route

`GET /api/app2/render/overview`

Query params:

- `hours` (1-168, default `24`)
- `resolutionSeconds` (30-3600, default `300`)

Response includes:

- tracked services
- summary KPIs (request count, bandwidth, CPU, memory)
- raw metric rollups by endpoint/resource
- warnings for partial metric failures
