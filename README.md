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
/apps/site-performance          # Site Performance 40K companion app (frontend-only terminal UX)
  /client           # Vite React app
/apps/backend       # brianz backend (shared FastAPI service)
/apps/tftduos       # TFTDuos app sources
  /client           # Vite React app
```

## TFTDuos Deployment Model (recommended)

- Frontend: Render **Static Site** (subdomain `tftduos.brianz.dev`)
- Backend: Render **Web Service** (API only, canonical public API domain: `api.brianz.dev`)
- Frontend calls backend via `VITE_API_BASE_URL`
- Riot API key stays only on backend via `RIOT_API_KEY`

## Local commands

From repo root:

- `npm run dev:all` (starts portfolio + backend + TFTDuos client + Site Performance client together, then auto-opens local URLs in your default browser)
- `npm run verify:local` (runs TFT client tests + backend syntax check + all builds)
- `npm run build:portfolio`
- `npm run build:tftduos`
- `npm run build:site-performance`
- `npm run dev:portfolio` (builds and serves portfolio at `http://localhost:8080`)
- `npm run open:local:hosts` (manually open all local app/API URLs in default browser)
- `npm run dev:tftduos:client`
- `npm run dev:brianz:backend` (starts FastAPI on `http://localhost:3001`)
- `npm run dev:tftduos:server` (alias for backward compatibility)
- `npm run dev:site-performance:client`
- Site Performance local URL: `http://localhost:4174` (pinned in Vite config)
- Portfolio SFX audition page: `http://localhost:8080/sfx-lab.html` (if portfolio dev server is running)

From `apps/tftduos`:

- `npm run build`
- `npm start`

From `apps/tftduos/client`:

- `npm run test`
- `npm run test:watch`
- `npm run test:coverage`

Windows PowerShell note:

- If script execution policy blocks `npm`, use `npm.cmd` (for example `npm.cmd run dev:all`).

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
  - `VITE_API_BASE_URL=https://api.brianz.dev`
  - `VITE_RIOT_GAME_NAME_A`, `VITE_RIOT_TAG_LINE_A`, `VITE_RIOT_GAME_NAME_B`, `VITE_RIOT_TAG_LINE_B`
  - `VITE_RIOT_ROUTING_REGION`, `VITE_RIOT_PLATFORM_REGION`

### brianz Backend (Web Service)

- Service type: `Web Service`
- Root Directory: `apps/backend`
- Build Command: `python -m pip install -r requirements.txt`
- Start Command: `python main.py`
- Domain: `api.brianz.dev` (recommended canonical API domain)
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
  - `DEBUG_TFT_PAYLOAD=1` (optional; includes per-player sync diagnostics in `/api/tft/duo-history` to verify incremental match-id pulls)

### Site Performance Frontend (Static Site)

- Service type: `Static Site`
- Root Directory: `apps/site-performance/client`
- Build Command: `npm ci && npm run build`
- Publish Directory: `dist`
- Domain: `site-performance.brianz.dev`
- Env vars:
  - `VITE_API_BASE_URL=https://api.brianz.dev`

## Standard Render Commands

For backend Web Service apps in this repo:

- Build Command: `python -m pip install -r requirements.txt`
- Start Command: `python main.py`

For static sites:

- Build Command: `npm ci && npm run test && npm run build`
- Publish Directory: `dist`

## CI / Test Gate

- GitHub Actions workflow: `.github/workflows/ci.yml`
- Triggers: `pull_request` and `push` on `main`
- `verify-tftduos-client`: runs `apps/tftduos/client` tests and production build.
- `verify-brianz-backend`: installs `apps/backend/requirements.txt` and runs `python -m py_compile apps/backend/main.py apps/backend/duo_analytics.py`.
- `verify-portfolio`: runs `npm run build:portfolio`.
- `verify-site-performance-client`: builds `apps/site-performance/client`.
- Render deployment should use test-inclusive build commands so a failing test blocks publish.
- `portfolio` currently includes a placeholder `test` script (exit 0) so test-inclusive pipelines can run consistently until real tests are added.

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
- TFTDuos backend now uses persisted per-player sync timestamps to call Riot TFT match-id time-window queries (`startTime`) before falling back to `start/count` pagination (including automatic fallback when time-window query support fails), reducing repeat API pulls while preserving first-load/backward-compatible pagination behavior.
- The AI coaching prompt is guided for rank-climb use and now supports web-backed meta lookup (via OpenAI Responses API web search tool), plus richer per-game build fingerprints for direct "your builds vs current meta" comparison with source visibility in UI.
- Coaching UX is now AI-first: compact KPI header, primary AI briefing section, per-player action plans below, and a full-page loading state while GPT coaching is being generated.
- Coaching view is now terminal-themed to match portfolio terminal behavior, including staged AI boot log lines during loading and a prompt-style footer around the AI brief module.
- Coaching terminal styling now uses the same core terminal visual system as portfolio (matching monospace typography scale, blue prompt/header palette, border/glow treatment, and terminal-like section cadence across KPI/meta/AI/action-plan surfaces).
- Coaching backend now layers deterministic evidence (leaks, win-conditions, 5-game plan, champion+item build conversion signals) into the LLM prompt/response to reduce generic output and improve actionability.
- Coaching UI now uses high-contrast custom error/warning banners and compact AI payload requests to improve readability and reduce large-timeline AI network failures.
- Coaching AI responses are cached client-side by duo/filter and reused until a newer shared match is detected, reducing repeated OpenAI calls when no new duo games were played.
- Coaching data flow is now trimmed to the active UI surface: `App.jsx` only passes `CoachingTab` the props it renders, and `useDuoAnalysis` drops unused journal/event-only client state.
- `/api/tft/duo-history` now includes a compact `rankContext` snapshot (region/platform, apex ladder population hints, sampled challenger+ ladder meta traits/champions, snapshot timestamp) so duo trends can be compared against regional high-ELO pressure.
- `rankContext` ladder sampling now uses Riot's TFT tier/division entries route (`/tft/league/v1/entries/{queue}/{tier}/{division}`) and a short backend cache window to avoid repeated heavy ladder fetches on every duo-history request.
- Analysis + Coaching now render this `rankContext` as a Regional Meta Pressure context card to keep recommendations grounded in current ladder pressure.
- Site Performance now exists as a frontend-only Render Meta Dashboard (`apps/site-performance/client`) and consumes shared backend routes under `/api/site-performance/*` from `apps/backend`.
- Shared backend (`apps/backend`) is API-only for the whole portfolio platform (no static frontend fallback from backend root); direct non-API paths return a generic 404.
- Backend runtime is now Python/FastAPI (`apps/backend/main.py`) and no longer requires Node for API execution.
- Legacy Node backend artifacts were removed from `apps/backend` (`index.js`, `lib/duoAnalytics.js`, backend `package.json`/`package-lock.json`) so backend deploy/runtime is Python-only.
- Python migration status: `/api/tft/*`, `/api/duo/*`, `/api/coach/llm-brief`, and `/api/site-performance/render/overview` are available; detailed Render metric rollups are currently returned as a simplified summary during migration.
- Backend API-only transition retains filesystem-backed analytics/cache persistence (`node:fs/promises`) so TFT requests do not fail with runtime `fs is not defined` errors.
- TFTDuos now includes extended inference modules (tilt detection, fingerprints, win-condition mining, loss autopsy, contested pressure, timing coach, coordination scoring) and an optional Wild Correlations view gated by a sidebar settings toggle.
- TFTDuos client test suite now covers key utility inference logic and integration rendering for History, Coaching, and Wild Correlations tabs.
- Portfolio landing (`portfolio/src/index.html`) now uses third-party 3D rendering (`three.js` + `GLTFLoader`) for the brain centerpiece, with vendored module assets in `portfolio/src/vendor/` and a local GLB model at `portfolio/src/assets/brainstem.glb` for reliable deploy/runtime loading.
- Portfolio 3D vendor dependencies are fully local-resolved (`GLTFLoader` + `utils/BufferGeometryUtils`) to prevent MIME/import failures from missing external module paths.
- A built-in procedural fallback brain mesh is rendered if the local GLB cannot be loaded, so the scene remains functional in degraded mode.
- Portfolio node constellation has been pulled closer to the brain center for tighter navigation focus, and a parent `Systems` node now expands `Render Meta` + `Backend` subnodes on hover/focus (tap-to-toggle on mobile).
- Portfolio landing now boots through a terminal-style intro ("MY BRAIN" protocol handshake + "Mapping out Brian's mind") and keeps that terminal docked at the bottom with message history plus a blinking prompt-style status line while generated star-map nodes come online.
- The docked terminal now spans the full lattice container width, uses a fixed height, and keeps boot/message history scrollable inside the terminal body.
- Clicking the `Backend` subnode (under `Systems`) toggles an expanded full-height terminal mode and prints the connected backend API manifest (health, TFT, duo, coach, and site-performance routes); `Esc` still collapses back to docked mode and the terminal header now includes a caret toggle control (`^` expand, `v` collapse) for touch/mobile users.
- Backend manifest output now streams line-by-line (terminal typing cadence), terminal expansion/collapse is animated from the docked bottom edge (no top-hop before expansion), and manifest routes print in fixed-width method/path columns so endpoint starts stay left-aligned.
- Every `Backend` click now appends a fresh manifest request block at the bottom of terminal history (timestamped), replaying line-by-line like a new backend call.
- `Render Meta` launcher subnode (under `Systems`) is terminal-native (no separate dashboard navigation from the portfolio node): it queries `/api/site-performance/render/overview` from the shared backend and streams service/summary output line-by-line into the same terminal stack.
- Backend and Render Meta terminal streams now prepend command-style execution lines (`run backend.manifest ...`, `run render.meta ...`) to reinforce terminal-call semantics.
- Portfolio `Contact` node now opens the same terminal in expanded contact-relay mode and exposes LinkedIn-only contact routing (no email prompts or mailto popups).
- When landing on portfolio from known app/subdomain hosts (`tftduos`, `site-performance`, and local app ports), boot handshake animation is skipped for immediate map access.
- Portfolio node/lattice initialization now completes before skip-boot rendering, fixing the mobile/return-home case where nodes could appear missing at top-left before layout sync.
- Terminal loading affordances are now explicit in both surfaces: portfolio prompt shows inline thinking state while Render Meta waits on API response, and TFT Coaching terminal shows inline thinking status during GPT generation/refresh waits.
- Portfolio scene suppresses ambient page caret/cursor artifacts in the lattice viewport while keeping terminal history selectable for copy.
- Portfolio launcher opens HTTP(S) app destinations in new tabs so the landing scene remains open while navigating.
- Portfolio visual tuning update: thicker lattice links, calmer pulse cadence, and lower-motion digital-brain drift for reduced visual fatigue.
- Portfolio brain centerpiece now runs on an ambient auto-rotation loop (no cursor tracking), and each brain load starts from a tiny scale before a rapid zoom-in to full size for a "target acquired" feel.
- Portfolio brain centerpiece now completes a smooth full 360-degree yaw cycle with center-locked single-axis spin (no tilt/roll drift) to keep the model visually anchored.
- Portfolio intro staging now uses a vertically centered half-height brain viewport, and the decorative background ring/glow circle has been removed for a cleaner hero scene.
- Portfolio entry transition now sinks the brain down behind the terminal (instead of zoom/fade out), keeps lattice links sourced from that docked brain position, and arranges primary navigation nodes in a centered top row once the map is active.
- Portfolio landing no longer uses browser speech synthesis voice prompts, and the sink transition keeps a stable docked brain transform in map mode to prevent bounce-back zoom/fade hops after click.
- Portfolio intro pipeline is now hard-locked to a single class path (`intro-locked` -> `intro-sinking` + `map-active`) with no legacy zoom/fade classes, removing transition-state hops during brain entry.
- Portfolio entry states now keep `.organism` explicitly visible in both `intro-sinking` and `map-active`, preventing the brief mid-transition fade-out before `ready` is applied.
- Brain docking now locks a single computed Y anchor during sink/map entry (instead of recalculating from terminal size), eliminating the slight pre-node upward nudge.
- Portfolio terminal header now uses `Cognitive Navigation Terminal` (without `SUBJECT`), displays a futuristic protocol label (`Protocol NX-7A19.442`), and hides the up/down caret while the intro is still brain-only (`intro-locked`).
- Portfolio map no longer uses `Systems`/`Render Meta`/`Backend` brain nodes; system telemetry is terminal-native through protocol/memory controls.
- `Memory Access` node now opens terminal data mode and streams the connected API route manifest (TFT, duo, coach, and site-performance endpoints).
- Access semantics are source-aware: protocol control emits `Protocol Access` language and loads Render telemetry (`run protocol.access ...`), while `Memory Access` emits `Subject Memory Access` language and loads API manifest data (`run subject.memory.access --scope api-manifest ...`).
- Terminal churn indicators now render inside terminal output lines (e.g., `> processing telemetry stream ...`) instead of only near the prompt underscore, making active fetch/processing states more obvious.
- Memory Access now uses the same in-output loading indicator pattern (`> processing api manifest ...`) before route-manifest lines stream, matching Protocol Access churn visibility.
- Portfolio background ambient glow now follows the brain position dynamically (instead of staying statically centered), so the faint halo remains directly behind the brain across intro and map states.
- Lattice links from the brain are now rendered brighter/thicker and their traveling data pulses move faster for stronger readability and livelier network motion.
- Portfolio now includes synthesized sci-fi UI SFX tuned for tight, percussive click feedback (short high-passed ticks on hover/focus plus a sharper press tick on click/tap), unlocked after first user gesture and rate-limited to stay subtle.
- Added `portfolio/src/sfx-lab.html`, a local click-sound audition page with six short WebAudio click profiles (A-F) and master volume so SFX can be selected before integrating into main UI interactions.
- Portfolio live UI SFX is now tuned to the auditioned `E - Tight Dual` profile (with a slightly stronger press tick) for tighter hover/click feedback.
- Portfolio node SFX hotspoting is now icon-scoped: star-node sounds fire from `.node-icon` hover/click (plus keyboard focus), avoiding early triggers from surrounding node padding.
- Portfolio includes a two-stage shake easter egg in map mode: sustained aggressive brain dragging triggers a caution warning, and heavier continued shaking escalates to a critical stabilization warning (both cooldown-gated to avoid log spam).
- Critical shake escalation now has an accompanying visual state: the brain-centered ambient glow blinks red while severe shaking continues, then smoothly fades back to the normal blue glow once motion settles/stops.
- Critical/red escalation sensitivity has been tuned slightly higher than the initial rollout so users must sustain stronger shake input before entering the critical state.
- Portfolio terminal output now auto-follows newest appended lines (including shake warnings and stream logs), so latest status stays visible at the bottom while preserving normal manual scroll behavior between new messages.
- Shake alerts now include explicit recovery behavior: after a longer cool-down, footer status switches to `stabalizing // subject returning to baseline`; once the alert glow fully decays, terminal history logs `Stabalizing complete...` and footer status settles to `stable // subject stability nominal`.
- Brain drag capture hit-testing is now constrained to the brain silhouette area (ellipse around the model) so map-mode rotation starts only when pointer-down occurs over the brain itself, not the wider glow/container region.
- In map mode, brain cursor affordance and brain-specific hover/click SFX now activate only while pointer is over the brain hit area (not the surrounding glow field).
- Brain hover SFX is now one-shot per hover entry (re-arms on leave), preventing rapid repeated hover ticks while moving within the same brain hit area.
- Portfolio terminal now emits subtle synthesized output SFX: each appended terminal line plays a short tick, and active loading/churn rows (`processing ...`) run a low-volume pulse until completion.
- Portfolio HUD now includes a mute toggle icon next to reboot; it mutes/unmutes all synthesized SFX (node/UI, brain interaction, terminal output/loading), persists preference via localStorage, and updates icon state for muted/unmuted.
- `portfolio/src/sfx-lab.html` now covers all current live sounds (UI hover/press + terminal line/loading) and adds alternate UI/terminal options for quick A/B testing before adopting new profiles.
- SFX Lab option sets now include higher-variance timbres (ceramic snap, analog button, radio chirp, servo tick, holo ping, crunch/noise textures, sonar, glitch-bit, tape relay) so UI and terminal sound direction can be chosen across distinct styles instead of minor variants.
- Live SFX mapping is now: UI hover=`Ceramic Snap`, UI press=`Crunch Dot`, terminal line output=`Sonar Pip`; terminal loading/churn loops are intentionally silent.
- Portfolio launcher node ordering now prioritizes app nodes first (`TFT Duos`, `Warhammer`) and groups utility nodes after (`Memory Access`, `Contact`, `Source`), with app nodes on `core` yellow styling and utility nodes on `meta` green styling (including hover state).
- Portfolio `Source` node icon now uses a GitHub mark, and app node glyphs were refreshed toward a TFT crest and Warhammer banner motif.
- App node glyphs are now intentionally generic/custom: TFT icon uses a yellow-only `TFT` crest (no blue accent), and Warhammer icon uses a simple `40K` text mark to avoid dependency on third-party trademark logo assets.
- Portfolio HUD now uses a reboot icon (top-right) to reload/reboot the interface, replacing the prior textual explore chip and superseding the old Home node.
- Portfolio brain is now draggable after map activation: click-drag rotates freely across axes, then releases back toward ambient rotation when pointer is released.
- Protocol control affordance now includes a soft internal pulse glow to emphasize that it is actionable.
- Portfolio node map now exposes a dedicated `Warhammer` launcher node that routes to the Site Performance 40K companion app (`site-performance.brianz.dev` in production, `localhost:4174` locally).
- TFTDuos + Site Performance frontends now share portfolio visual language tokens (thin luminous blue outlines, translucent navy cards, controlled glow/opacity) and starfield-backed atmospherics while preserving foreground readability.
- Starfield parity pass: TFTDuos and Site Performance now use denser/brighter star specks plus stronger background drift/twinkle motion so non-portfolio apps better match the portfolio launcher's ambient movement profile.
- Site Performance frontend has been refactored into a dedicated 40K Companion terminal app that mirrors the portfolio terminal styling and uses command-driven quick-reference responses for tabletop reminders.
- Portfolio launcher link assumptions:
  - production node links: `https://tftduos.brianz.dev` (TFT) and `https://api.brianz.dev` (shared backend + Render Meta terminal data source)
  - local host node links: `http://localhost:4173` (TFT), `http://localhost:4174` (Warhammer), and `http://localhost:3001` (shared backend + Render Meta terminal data source)
  - contact fallback: `https://www.linkedin.com/in/brian-ziebart/`

## AI Context Files

For new IDE sessions and AI tools (including GitHub Copilot), start with:

- `.github/copilot-instructions.md` (repo-wide Copilot context/instructions)
- `AGENTS.md` (Codex-specific project direction)
- `apps/tftduos/README.md` (current app behavior and implementation notes)
