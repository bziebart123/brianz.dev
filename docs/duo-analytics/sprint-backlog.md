# Sprint Backlog

## Sprint 1 (2 weeks): Foundation + MVP Scores

1. Build event-first tables from `schema.sql`.
2. Add ingestion endpoint for journal + event tags.
3. Persist `analysisV2` response shape and coverage flags.
4. Implement:
   - Synergy fingerprint v1
   - Gift ROI v1
   - Econ coordination v1
   - Decision leaks v1
5. Ship basic scorecard panel in UI.

Exit criteria:
- Can compute scorecard for any duo with at least 20 shared games.
- Missing data is surfaced explicitly, not silently ignored.

## Sprint 2 (2 weeks): Coaching + Playbook

1. Text replay generator with stage checkpoints + if/then branches.
2. Personalized playbook snapshot builder.
3. Weekly chemistry goals and adherence tracking.
4. Milestone/highlight generation.

Exit criteria:
- Every analyzed duo receives:
  - 3 leaks
  - 2 goals
  - 1 playbook snapshot

## Sprint 3 (2 weeks): Context + Meta Adaptation

1. Lobby strength model and expected-vs-actual.
2. Nemesis comp detection and adjustment hints.
3. Patch-lens coaching deltas from historical duo data.

Exit criteria:
- Scorecard includes expected placement model and patch adaptation section.

## Sprint 4 (optional): Comms Layer

1. Voice upload + local processing path.
2. Decision latency and interrupt metrics.
3. Phrase-to-loss correlation (opt-in only).

Exit criteria:
- Comms metrics contribute to chemistry score when enabled.

## Definition of Done

1. All metrics include:
   - Formula source
   - Confidence
   - Coverage flags
2. Backtest report:
   - Correlation of each metric with placement outcomes.
3. No silent failures for missing event streams.
