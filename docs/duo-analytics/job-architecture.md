# Job and Worker Architecture

## Pipeline

1. `ingest-match-job`
- Pull Riot shared matches and participant snapshots.
- Upsert into `duo_match`.

2. `ingest-event-job`
- Accept tracker/journal/comms payloads.
- Normalize and write to `duo_event` + `duo_round_snapshot`.

3. `compute-metrics-job`
- Read recent matches + events.
- Compute formulas in `metrics-formulas.md`.
- Upsert `duo_metric_daily`.

4. `build-playbook-job`
- Generate top EV openers, plans, and banned behaviors.
- Store in `duo_playbook_snapshot`.

5. `weekly-goals-job`
- Monday UTC: assign two goals using weakest high-impact metrics.

6. `patch-diff-job`
- On patch change:
  - Compare pre/post patch duo outcomes.
  - Generate patch-lens recommendations.

## Service Boundaries

- API service:
  - Read/write endpoints.
  - Fast cached queries for dashboard.
- Worker service:
  - Batch compute and feature extraction.
  - Retry-safe idempotent jobs.
- Optional comms processor:
  - Voice upload processing and feature extraction to event stream.

## Queue Topics

- `duo.match.sync`
- `duo.events.ingest`
- `duo.metrics.recompute`
- `duo.playbook.refresh`
- `duo.patch.refresh`

Each message key:
- `duoId`
- `matchId` (optional)
- `patch` (optional)
- `triggeredAt`

## Reliability

- Idempotency key:
  - `duoId + matchId + source + sequence`.
- Late event handling:
  - Recompute rolling 14-day window for affected duo.
- Backfill mode:
  - Bulk queue historical matches per duo.

## Data Quality Rules

- Reject unknown `event_type` unless flagged as experimental.
- Validate stage bounds (`2-1` to endgame).
- Clamp impossible values (negative gold/hp).
- Emit coverage diagnostics for missing mandatory signals.
