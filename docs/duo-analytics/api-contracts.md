# API Contracts

## 1) Ingestion

### `POST /api/duo/events/batch`

Purpose:
- Store round-level events from local tracker, overlay, or manual client tags.

Request:

```json
{
  "duoId": "uuid",
  "matchId": "NA1_1234567890",
  "events": [
    {
      "type": "gift_sent",
      "stageMajor": 3,
      "stageMinor": 2,
      "actorSlot": "A",
      "targetSlot": "B",
      "payload": {
        "giftType": "item",
        "giftCode": "bf_sword",
        "partnerState": "bleeding"
      }
    }
  ]
}
```

Response:

```json
{
  "ok": true,
  "inserted": 42
}
```

### `POST /api/duo/journal`

Purpose:
- Capture 10-second post-game intent and execution tags.

Request:

```json
{
  "matchId": "NA1_1234567890",
  "planAt32": "tempo",
  "executed": false,
  "tags": ["panic_roll", "missed_gift"]
}
```

## 2) Query

### `GET /api/tft/duo-history`

Existing route; now includes:
- `analysisV2` scorecard scaffold.

### `GET /api/duo/scorecard?duoId=<uuid>&window=30d`

Purpose:
- Return fully computed analytics with confidence and coverage fields.

Response (shape):

```json
{
  "generatedAt": "2026-02-20T20:30:00Z",
  "dataCoverage": {
    "riotMatchPayload": true,
    "roundTimelineEvents": true,
    "giftEvents": true,
    "commsSignals": false,
    "intentTags": true
  },
  "synergyFingerprint": {},
  "giftEfficiency": {},
  "rescueIndex": {},
  "econCoordination": {},
  "decisionQuality": {},
  "coachingReplay": {},
  "playbook": {},
  "weeklyGoals": []
}
```

### `GET /api/duo/playbook?duoId=<uuid>`

Purpose:
- Return latest personalized playbook snapshot and banned behaviors.

### `GET /api/duo/highlights?duoId=<uuid>&weekStart=YYYY-MM-DD`

Purpose:
- Return shareable milestones and timeline highlights.

## 3) Admin/Workers

### `POST /internal/jobs/recompute-duo`

Purpose:
- Queue recomputation after new events or patch updates.

Request:

```json
{
  "duoId": "uuid",
  "reason": "new_events"
}
```
