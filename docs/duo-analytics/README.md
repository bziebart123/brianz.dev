# Duo Analytics Implementation Pack

This folder turns the feature set into build-ready artifacts:

- `schema.sql`: event-first relational schema for Double Up analytics.
- `metrics-formulas.md`: explicit scoring formulas and leak detection logic.
- `api-contracts.md`: ingestion/query endpoints and payload contracts.
- `job-architecture.md`: pipeline and worker responsibilities.
- `sprint-backlog.md`: execution plan with release gates.

The current server returns a starter scorecard at `analysisV2` in:

- `GET /api/tft/duo-history`

`analysisV2` is coverage-aware and marks metrics as `needs_*` until round-level events are ingested.
