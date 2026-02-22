# TFTDuos App

TFT duo coaching/analysis sub-app in the portfolio monorepo.

## Architecture

- `client/`: Vite + React + Evergreen UI
- Shared backend lives at `apps/backend/`: brianz backend Express API (Riot integration + analytics helpers)

## Local Development

From repo root:

- `npm run dev:tftduos:client`
- `npm run dev:brianz:backend` (`npm run dev:tftduos:server` still works as an alias)

From `apps/tftduos`:

- `npm run dev:client`
- `npm run dev:server` (starts `apps/backend`)
- `npm run build`
- `npm start`

From `apps/tftduos/client`:

- `npm run test`
- `npm run test:watch`
- `npm run test:coverage`

## Environment

Client env vars (see `client/.env.example`):

- `VITE_API_BASE_URL`
- Riot game names/tags/regions (`VITE_RIOT_*`)

Server env vars (see `.env.example` and server code):

- `RIOT_API_KEY` (required)
- `ALLOWED_ORIGINS`
- `OPENAI_API_KEY` (optional, enables live AI coaching brief generation)
- `OPENAI_MODEL` (optional, default `gpt-4o-mini`)
- `OPENAI_TIMEOUT_MS` (optional request timeout, default `15000`)
- `OPENAI_WEB_SEARCH_ENABLED` (optional, default `1`; enables OpenAI web search tool for live meta lookups)
- `RENDER_API_KEY` (required for Site Performance dashboard routes)
- `RENDER_API_BASE_URL` (optional, default `https://api.render.com/v1`)
- `RENDER_DASHBOARD_SERVICE_IDS` (optional comma-separated Render service IDs to scope Site Performance dashboard)

## Current Product Behavior

- History uses duo team placement rank `1..4` (derived from partner groups/lobby data).
- KPI includes `Team Top 2` (top-half) and team win rate.
- Match cards show:
  - Team chip + LP estimate chip
  - Set/Patch/Date
  - Both player boards as exactly 10 slots
  - Empty placeholders for unused board slots
  - Champion star strips (filled stars only)
- Trait icons are tier-colored with distinct bronze/silver/gold/prismatic styles.
- UI text/icons are scaled up for readability.
- Left sidebar keeps the Refresh Data action anchored at the viewport bottom while upper sidebar content scrolls independently.
- Mobile layout uses a filter drawer (left sidebar becomes a slide-in panel with overlay and close action) opened from a top hamburger icon button.
- On mobile breakpoints, History banner/KPI/player grids stack into a single column for readable vertical flow.
- Mobile drawer controls use icon/text controls (home icon + `X`) for compact header layout on small screens.
- Sidebar now includes a `Release` panel showing `major.minor` version and recent release notes sourced from recent git commit subjects.
- Global shell `zoom` scaling was removed; text sizing now comes from `TEXT_SCALE` in `client/src/config/constants.js` (currently `1.45`), applied to typography/UI text surfaces (headings, tabs, buttons, selects, badges) while layout dimensions stay stable.
- Main content (`History`, `Analysis`, `Coaching`) now has an additional dedicated text scale (`--bz-content-text-scale` in `client/src/theme.css`) so right-panel readability can be increased without changing sidebar or layout geometry.
- `History` now enforces larger, consistent placement/LP chip text and uses larger champion unit slots while keeping rows single-line (desktop clips overflow; mobile allows touch horizontal scroll without showing scrollbars).
- Player stat badges in `History` (`#placement`, `Lvl`, `Dmg`) now use tighter padding and a slightly smaller font than LP/team chips for clearer visual hierarchy.
- Champion unit slots in `History` are tuned to remain larger but fit without row scrollbars, and sidebar filter dropdown text is slightly reduced to avoid vertical clipping.
- Analysis tab is now a dashboard-style view with:
  - Team KPI strip (avg placement, top2/win rates, avg team damage, decision grade, rescue/clutch)
  - KPI cards are auto-tinted green/red based on metric-specific "good vs weak" thresholds for fast scanning
  - Full-width team rank trend chart (cumulative estimated LP/rank score from filtered placements) with labeled y-axis and date-labeled x-axis range
  - Momentum and Recent Avg chips retained from team placement history
  - Team trend visuals (placement distribution + momentum)
  - Patch performance table derived from filtered matches
  - Gift Intelligence section using event-derived `gift_sent` metrics (early/item/ROI/waste) when available
  - Meta pressure (traits/units in current lobbies) plus suggested adjustments
  - Individual player breakdown cards (placement/damage/level consistency, per-player damage trend graph with date range labels, top trait/unit profiles), rendered side-by-side on desktop
  - `Blame Game` section (positioned ahead of Meta Pressure) with individual worst-stat awards (placement liability, variance, low-impact losses, econ emergency, damage passenger)
  - Blame awards use tactician/chibi icons only; tie outcomes show both players' tacticians side-by-side so no award appears iconless
  - Blame award cards use a fixed hierarchy: top row `icon + title`, then description and short verdict lines below
  - Detailed per-player award numbers now live in hover tooltips on each blame card (visible card shows only the verdict)
  - On desktop, the 5 blame awards render in a single row; mobile still stacks for readability
- Analysis page labels/KPIs/sections now include hover tooltips describing what each metric means and how key scores are computed.
- `/api/tft/duo-history` now returns `rankContext` with ladder snapshot metadata: `region`, `platform`, `snapshotAt`, `queuePopulation` hints, and `ladderMeta` (`topTraits`, `topChampions`, sampled top-player count).
- `rankContext` is cached briefly server-side and built from official TFT ladder routes (apex leagues + tier/division entries pages) to reduce latency while keeping snapshot context current.
- Analysis and Coaching tabs surface `rankContext` as **Regional Meta Pressure** so duo trends and action plans can be compared against regional high-ELO ladder pressure.
- Rescue/Clutch KPI now includes explicit in-card counts (`rescue events / total events`, `clutch wins / rescues`, `flips / rescues`) so missing clutch signal can be diagnosed without hovering.
- Several analysis metrics are extrapolated client-side from filtered match payloads (for example momentum, volatility, patch ranking, and per-player consistency).
- Coaching tab now uses an AI-first layout:
  - Compact high-signal KPI strip (`Decision Grade`, `Team Top2`, `Team Win`, `Rescue/Clutch`)
  - Primary full-width `AI Coach Brief` panel (summary, team actions, meta/build deltas, model/source badges)
  - `Individual Action Plans` section directly below AI output (one card per player, AI-driven when available)
  - Less auxiliary box density to keep coaching readable and execution-focused
- Coaching text now replaces recognized champion/trait mentions with inline TFT icons (summary/actions/meta/win conditions/5-game plan/player actions and champion build rows), using mention matching against the current filtered match trait+unit pool.
- GPT-generated coaching lines now render with larger body text/icon sizes for readability, and displayed model text sanitizes `TFT##_*` tokens (for example `TFT16_Ahri`) into clean names (for example `Ahri`).
- Coaching GPT text/icon sizing now responds to viewport width (keeps larger desktop readability while scaling down on mobile), and long generated lines are forced to wrap to prevent card overflow on narrow screens.
- History mobile overflow hardening:
  - player cards now explicitly allow shrink (`min-width: 0`) inside the history grid.
  - long player names now wrap instead of forcing horizontal overflow.
  - champion board rows now render as a 2-row mobile grid (5 slots per row) to keep full board visibility inside the card without right-edge overflow.
  - champion star strips under unit icons now use stronger dedicated typography so 1/2/3-star markers remain legible.
- Mobile filter drawer now uses an opaque background layer (no see-through app content), with Sidebar relying on CSS-driven backgrounds instead of an inline transparent background override.
- Coaching page now waits for AI briefing before rendering the full content area and shows a full-page GPT loading state during generation.
- AI coaching now includes a deterministic findings engine (server-side) that computes:
  - top improvement areas
  - repeatable win conditions
  - a next-5-games checklist
  - champion + item build conversion signals from recent matches
- Champion build analysis is inferred from each player's core units and attached item names in your recent games, then surfaced as `Champion Build Signals` in the coaching brief.
- AI coaching request payload is now compacted client-side (most recent 32 minimal match records) to avoid large-timeline network/request-size failures when generating the brief.
- AI coaching responses are now cached per duo/filter in local storage and automatically reused until a newer shared match appears in that filtered view (manual `Refresh AI` still forces regeneration).
- Sidebar/coaching/history warnings and errors now use high-contrast custom banners for readability, and refresh actions use a dedicated CTA button style.
- Coaching recommendations are rule-driven and data-adaptive (not hardcoded static text), and become more specific as event sample size grows.
- Coaching now includes an `AI Coach Brief` card that calls `POST /api/coach/llm-brief` with current filtered metrics/match summaries and returns:
  - headline + summary
  - meta comparison bullets (your tendencies vs inferred current patch/lobby pressure)
  - explicit `Meta vs Your Builds` deltas generated from your recent traits/units/items and current web/meta context
  - team-level actions
  - per-player focus/actions
  - patch context note (explicitly states whether balance conclusions are inferred)
  - confidence + model metadata + source list
- AI briefing payload now includes richer per-game build fingerprints (top traits and core units with item names per player) to reduce generic output and improve direct comp/item comparisons.
- Backend now uses OpenAI Responses API with optional `web_search_preview` tool so current patch build trends and balance context can be consulted during generation.
- `OPENAI_TIMEOUT_MS` is applied per provider request attempt (Responses with web search, Responses without web search, then Chat Completions fallback), so increasing it can help when live web/meta calls are slow.
- On timeout/error with web-enabled Responses, backend now automatically retries without web search before falling back to Chat Completions and finally deterministic coaching.
- LLM prompt guidance now explicitly frames the duo objective as rank climbing and requests:
  - rank-aware coaching
  - comparison against inferred current meta/build/item pressure
  - buff/nerf impact framing with uncertainty called out when patch-note specifics are not provided in payload
- If OpenAI is unavailable (missing key, timeout, provider failure), server returns a deterministic fallback brief so coaching remains functional.
- Coaching now includes additional inferred modules:
  - Tilt & streak detection banner with reset-rule recommendation
  - Playstyle fingerprints (per player + duo)
  - Win-condition miner ("when X + Y, Top2 rises to Z%")
  - Loss autopsy for the 3 worst filtered games with ranked factors + confidence
  - Contested meta pressure score with pivot guidance
  - Timing coach (level timing proxies + overlap-stage hints)
  - Duo coordination score + pre-game role split recommendation
- New optional `Wild Correlations` view:
  - Toggle in sidebar (`Enable Wild Correlations`) controls nav visibility and acts as serious-mode failsafe
  - Includes disclaimer, cosmic summary + copy action, cursed/blessed queue windows, generated nonsense takes, and transparent joke "method" labels
- Timeline auto-default selection now prioritizes `30` days before shorter windows.
- Quick event stage default for manual logging is now `4.1` to better align with late-stage clutch/rescue signal capture.
- Shared backend now also exposes Site Performance metrics routes:
  - `GET /api/site-performance/render/overview` (Render service/metric rollups for the Site Performance dashboard)

## Testing

- Test runner: Vitest + Testing Library (client)
- Config: `client/vitest.config.js`
- Test setup: `client/src/test/setup.js`
- Current coverage includes:
  - History tab rendering and board-slot behavior:
    - `client/src/components/tabs/HistoryTab.test.jsx`
  - Core TFT utility logic (placement mapping, KPI/meta summarization):
    - `client/src/utils/tft.test.js`
  - Coaching inference engine modules (tilt/fingerprints/win-conditions/autopsy/coordination/wild signals):
    - `client/src/utils/coachingIntel.test.js`
  - Coaching tab integration rendering for new intelligence sections:
    - `client/src/components/tabs/CoachingTab.test.jsx`
  - Wild Correlations tab integration rendering and generator interactions:
    - `client/src/components/tabs/WildCorrelationsTab.test.jsx`

CI:

- GitHub workflow: `.github/workflows/ci.yml`
- Runs on `pull_request` and `push` for `main`.
- Validates:
  - `apps/tftduos/client` tests + production build
  - `apps/backend` syntax (`node --check`)
  - `portfolio` static build (`npm run build:portfolio`)
- Recommended Render frontend build command:
  - `npm ci && npm run test && npm run build`

## Notes

- If changing match presentation rules, also update:
  - `client/src/utils/tft.js`
  - `client/src/components/tabs/HistoryTab.jsx`
  - `.github/copilot-instructions.md`
- Legacy root runtime files were removed; use `apps/tftduos/client` and `apps/backend` paths for dev/deploy.
- `client/src/hooks/useDuoAnalysis.js` keeps an identity-stable empty `matches` list and skips redundant manifest resets to prevent React effect loops (`Maximum update depth exceeded`) before payload data loads.
- Icon resilience hardening:
  - `client/src/hooks/useDuoAnalysis.js` now retries `/api/tft/icon-manifest` and `/api/tft/companion-manifest` with short exponential backoff and abort support.
  - Transient manifest failures no longer clear previously loaded icon/companion manifests, preventing post-deploy icon disappearance.
  - `client/src/components/IconWithLabel.jsx` and `client/src/components/PlayerBannerCard.jsx` now perform bounded delayed image retries with a retry query param to recover from temporary CDN misses.
- Coaching client-state cleanup (no user-facing behavior change):
  - `client/src/App.jsx` now passes only actively consumed `CoachingTab` props.
  - `client/src/hooks/useDuoAnalysis.js` removed unused client-side coaching journal/event state and handlers that were no longer rendered by UI.
- `client/vite.config.js` now injects build-time release metadata:
  - `__TFTDUOS_VERSION__` as `major.minor.build`:
    - `major.minor` from `client/package.json`
    - `build` from current commit epoch (`git show -s --format=%ct HEAD`), fallback: UTC build timestamp when git metadata is unavailable
  - `__TFTDUOS_RELEASE_NOTES__` from recent GitHub commits API (repo slug resolved from render/git env), with `git log` fallback and final static fallback notes if both are unavailable

