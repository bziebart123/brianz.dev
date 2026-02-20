# Metric Formulas

## 1) Synergy Fingerprint

- `sender_receiver_balance`:
  - For each Stage 3 snapshot, mark stabilizer as player with higher `board_power` and lower HP loss trend.
  - Score = `100 - abs(stabilizer_share_a - stabilizer_share_b) * 100`.
- `carry_support_pattern`:
  - Carry proxy = (`3_star_count` + `damage_share` weighted 60/40).
  - Support proxy = utility units + frontline item density + gift-out frequency.
- `board_timing_alignment`:
  - Spike round = first round where `board_power_z >= +1.0` vs own trailing 5-round mean.
  - Alignment = average absolute round distance between A/B spike rounds.
- `when_you_win_patterns`:
  - Mine frequent itemsets from top-4 games:
    - `carry_split`, `low_trait_conflict`, `staggered_rolls`, `early_gift_to_bleeding_partner`.
  - Keep top 3 by confidence and support.

## 2) Gift Efficiency / ROI

- `gift_win_rate_delta(stage, type)`:
  - `win_rate_with_gift(stage,type) - win_rate_without_gift(stage,type)`.
- `gift_roi` per event:
  - Base value:
    - Unit gift: +1 if upgraded to 2-star within 2 rounds, +2 if 3-star later.
    - Item gift: +1 if slammed within 1 round, +2 if on final carry.
    - Gold gift: +1 if converts into spike (`board_power_z >= +1` in next 2 rounds).
  - Penalty:
    - -1 if benched >3 rounds.
    - -1 if gifted while target marked stable and actor unstable.
- `over_gifting_rate`:
  - `% gifts where partner_state='stable' and actor_state='bleeding'`.

## 3) Rescue / Bailout

- `rescue_attempt_rate`:
  - `rescue_arrival_events / rounds_where_partner_bleeding`.
- `rescue_flip_rate`:
  - `% rescue rounds where predicted loss -> actual win`.
- `missed_bailout_count`:
  - Rounds where partner had:
    - HP <= threshold,
    - actor board surplus >= threshold,
    - no gift/no rescue sent.
- `clutch_index`:
  - `wins_with_bottom2_stage4plus / games_with_bottom2_stage4plus`.

## 4) Duo Economy Coordination

- `roll_overlap_rate`:
  - `% games with both players roll_down in same stage window`.
- `stagger_quality`:
  - 100 baseline.
  - -20 each unplanned same-stage double roll.
  - +10 when one stabilizes while other greed-econs and both reach target thresholds.
- `component_coordination`:
  - Penalize dual hoarding and contested carry component usage.
- `econ_coordination_score`:
  - Weighted blend: roll overlap (40), stagger quality (35), component planning (25).

## 5) Decision Quality (Process Grade)

- `slam_vs_greed_grade`:
  - Detect holdable-vs-playable component mistakes using board HP trend and slam opportunities.
- `roll_discipline_grade`:
  - Penalize roll below planned floor without explicit emergency condition.
- `pivot_quality_grade`:
  - Too-late pivot:
    - contested line signal + low hit probability + no branch swap by 4-1.
  - Too-early pivot:
    - abandons high-EV line before negative evidence.
- `augment_fit_grade`:
  - Fit model score between augment and declared board direction.
- `decision_quality_grade`:
  - Weighted sum:
    - Slam/Greed 25
    - Roll discipline 30
    - Pivot quality 25
    - Augment fit 20

## 6) Text Replay Coach

- Stage checkpoints generated from highest-EV branch among observed state transitions.
- Output:
  - Stage 2 opener choice.
  - Stage 3 role assignment.
  - Stage 4 roll/gift assignment.
  - If/Then branches keyed to miss conditions by 4-1.

## 7) Chemistry / Weekly Goals

- `chemistry_score`:
  - Decision latency, interrupt rate, plan adherence, roll stagger adherence.
- Weekly goal adherence:
  - `actual / target` capped at 100%.

## 8) Nemesis + Context

- `nemesis_score(comp_x)`:
  - Smoothed underperformance against comp archetype relative to baseline lobby expectation.
- `expected_vs_actual`:
  - Model expected placement from lobby strength + opener quality + econ state.
  - Track residual by lobby tempo bucket.
