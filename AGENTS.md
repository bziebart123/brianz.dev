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
  - `apps/site-performance/client/` -> Render meta dashboard frontend (Vite + React)
  - `apps/backend/` -> Node + Express brianz backend API (`/api/tft*`, `/api/duo*`, `/api/coach*`, `/api/site-performance*`)
  - `apps/tftduos/` -> TFT frontend app sources
  - `apps/tftduos/client/` -> Vite + React + Evergreen UI frontend
- Canonical frontend entry:
  - `apps/tftduos/client/src/App.jsx`
- Root-level legacy app/server files have been removed; do not add alternate root runtimes.

## Deployment Intent
- Root domain serves portfolio (`brianz.dev`, optional `www`).
- Subdomains serve apps (`tftduos.brianz.dev`, `site-performance.brianz.dev`, etc.).
- Deploys should be GitHub push -> Render auto deploy.
- TFTDuos should deploy as:
  - frontend Static Site (`apps/tftduos/client`)
  - backend Web Service (`apps/backend`)
- Site Performance should deploy as:
  - frontend Static Site (`apps/site-performance/client`)
  - shared backend remains `apps/backend` (no separate Site Performance backend service)

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

## Documentation Maintenance (Required)
- Any meaningful code change must include documentation updates in the same task/PR.
- Do not treat docs as optional or "later" work.
- At minimum, evaluate and update these files when relevant:
  - `README.md` (repo-level architecture/deploy/workflow changes)
  - `apps/tftduos/README.md` (app behavior, commands, env, UX/data rules)
  - `AGENTS.md` (project goals, priorities, conventions)
- For UI/behavior changes, document:
  - what changed
  - where it changed (path-level)
  - any new assumptions/configuration
- For API/data model changes, document:
  - endpoint/contract changes
  - new env vars or required settings
  - migration/backward-compat notes if applicable
- Before finishing, run this checklist:
  1. Code updated
  2. Tests/build verified (or explicitly noted why not run)
  3. Relevant docs updated
  4. Final response includes a brief docs-change summary

## Git And Deploy Workflow
1. Keep `.gitignore` excluding `node_modules`, `.env`, and build artifacts.
2. Commit/push to GitHub from repo root.
3. Render services should be connected to this repo with auto-deploy enabled.
4. Production secrets must be configured in Render Environment settings, not local `.env`.
5. DNS in Porkbun must match exactly what Render Custom Domains requests.

## Branching And Publish Rules (Required)
- Never make code/doc changes directly on `main`.
- Every change must be done on a feature branch.
- Branch naming convention:
  - `feature/<short-description>` for features
  - `fix/<short-description>` for bug fixes
  - `docs/<short-description>` for docs-only changes
- After each meaningful change set, create a commit immediately (small, atomic commits).
- Do not leave working changes uncommitted unless explicitly requested.
- When user says `publish`, interpret it as:
  1. ensure feature branch is up to date and clean
  2. merge feature branch into `main`
  3. push `main` to origin
- If merge conflicts occur during publish, resolve them and continue unless user requests manual intervention.

## What To Optimize Next
1. Better coaching insight quality (more actionable, less generic).
2. Stable and transparent filtering behavior.
3. Maintainable code structure (continue splitting large modules when needed).
4. Reliable Render deployment workflow.


