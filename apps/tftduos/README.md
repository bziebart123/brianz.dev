# TFTDuos App

TFT duo coaching/analysis sub-app in the portfolio monorepo.

## Architecture

- `client/`: Vite + React + Evergreen UI
- `server/`: Express API (Riot integration + analytics helpers)

## Local Development

From repo root:

- `npm run dev:tftduos:client`
- `npm run dev:tftduos:server`

From `apps/tftduos`:

- `npm run dev:client`
- `npm run dev:server`
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
- Mobile layout uses a filter drawer (left sidebar becomes a slide-in panel with overlay and close action) opened from a top `Menu` button.
- On mobile breakpoints, History banner/KPI/player grids stack into a single column for readable vertical flow.
- Mobile drawer controls use plain ASCII glyphs (`<`, `X`) to avoid missing-symbol fallback (`?`) on constrained font stacks.
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
- Rescue/Clutch KPI now includes explicit in-card counts (`rescue events / total events`, `clutch wins / rescues`, `flips / rescues`) so missing clutch signal can be diagnosed without hovering.
- Several analysis metrics are extrapolated client-side from filtered match payloads (for example momentum, volatility, patch ranking, and per-player consistency).
- Coaching tab now uses a dashboard-style command center with:
  - Team KPI strip (`Decision Grade`, `Top2`, `Win Rate`, `Recent Avg`, `Momentum`, `Events Logged`)
  - Dynamic team priorities generated from filtered metrics (`decisionGrade`, leak count, momentum, rescue/clutch, gift ROI, roll stagger guidance)
  - Per-player action plans with individualized strengths, reps, and near-term targets
  - Trend + pressure visualization and prioritized fix queue
  - Stage-based dynamic plan from scorecard replay fields and branches
  - Journal + Quick Event panels preserved for feedback-loop logging
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
- Runs on push to `main` and executes client tests.
- Recommended Render frontend build command:
  - `npm ci && npm run test && npm run build`

## Notes

- If changing match presentation rules, also update:
  - `client/src/utils/tft.js`
  - `client/src/components/tabs/HistoryTab.jsx`
  - `.github/copilot-instructions.md`
- Legacy root runtime files were removed; use only `apps/tftduos/client` and `apps/tftduos/server` paths for dev/deploy.
- `client/src/hooks/useDuoAnalysis.js` keeps an identity-stable empty `matches` list and skips redundant manifest resets to prevent React effect loops (`Maximum update depth exceeded`) before payload data loads.
- `client/vite.config.js` now injects build-time release metadata:
  - `__TFTDUOS_VERSION__` as `major.minor.build`:
    - `major.minor` from `client/package.json`
    - `build` from current commit epoch (`git show -s --format=%ct HEAD`), fallback: UTC build timestamp when git metadata is unavailable
  - `__TFTDUOS_RELEASE_NOTES__` from recent GitHub commits API (repo slug resolved from render/git env), with `git log` fallback and final static fallback notes if both are unavailable
