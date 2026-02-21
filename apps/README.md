# Apps Index

This folder contains deployable sub-apps for the portfolio domain.

## Current apps
- `tftduos/` -> TFT Duo coaching app (`tftduos.yourname.com`)
- `app2/` -> Render Meta Dashboard frontend (`app2.yourname.com`) using shared backend `/api/app2/*` routes from `apps/tftduos/server`

## App layout convention
Each app should use:
- `client/` for frontend
- `server/` for backend (if needed)
- root app `package.json` exposing:
  - `build`
  - `start`

