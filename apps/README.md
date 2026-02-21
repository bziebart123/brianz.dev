# Apps Index

This folder contains deployable sub-apps for the portfolio domain.

## Current apps
- `tftduos/` -> TFT Duo coaching app (`tftduos.yourname.com`)
- `site-performance/` -> Render Meta Dashboard frontend (`site-performance.yourname.com`) using shared backend `/api/site-performance/*` routes from `apps/backend`
- `backend/` -> shared brianz backend API service for TFTDuos + Site Performance

## App layout convention
Each app should use:
- `client/` for frontend
- `server/` for backend (if needed)
- root app `package.json` exposing:
  - `build`
  - `start`


