# Site Performance - Render Meta Dashboard

`site-performance` is a static frontend that visualizes Render service performance by calling the existing shared backend (`apps/backend`).

## Architecture

- Frontend: `apps/site-performance/client` (Vite + React)
- Backend API source: shared brianz backend route namespace (`/api/site-performance/*`)
- No dedicated `apps/site-performance/server` required

## Local development

From repo root:

- `npm run dev:brianz:backend`
- `npm run dev:site-performance:client`

By default, the Site Performance frontend proxies `/api` to `http://localhost:3001` via Vite.

## Site Performance frontend env vars

See `apps/site-performance/client/.env.example`:

- `VITE_API_BASE_URL` (optional; defaults to same-origin `/api`)

## Shared backend env vars

The shared backend (`apps/backend`) must include:

- `RENDER_API_KEY` (required for Site Performance metrics)
- `RENDER_API_BASE_URL` (optional, default: `https://api.render.com/v1`)
- `RENDER_DASHBOARD_SERVICE_IDS` (optional comma-separated service IDs to scope dashboard)

## API route

`GET /api/site-performance/render/overview`

Query params:

- `hours` (1-168, default `24`)
- `resolutionSeconds` (30-3600, default `300`)

Response includes:

- tracked services
- summary KPIs (request count, bandwidth, CPU, memory)
- raw metric rollups by endpoint/resource
- warnings for partial metric failures
- no public dashboard deep links in UI (service list is informational only)
