from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any


def as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def read_field(event: dict[str, Any] | None, field_name: str, fallback: Any = None) -> Any:
    if isinstance(event, dict) and field_name in event:
        return event[field_name]
    payload = event.get("payload") if isinstance(event, dict) else None
    if isinstance(payload, dict) and field_name in payload:
        return payload[field_name]
    return fallback


def clamp(value: float, min_value: float = 0, max_value: float = 100) -> float:
    if not isinstance(value, (int, float)):
        return min_value
    return max(min_value, min(max_value, float(value)))


def pct(numerator: int | float, denominator: int | float) -> float | None:
    if not denominator:
        return None
    return (float(numerator) / float(denominator)) * 100.0


def count_three_stars(units: list[dict[str, Any]]) -> int:
    return sum(1 for unit in as_list(units) if int(unit.get("tier") or 0) >= 3)


def item_count(units: list[dict[str, Any]]) -> int:
    total = 0
    for unit in as_list(units):
        total += len(as_list(unit.get("items")))
    return total


def top_traits(participant: dict[str, Any] | None, limit: int = 3) -> list[str]:
    rows = [
        trait
        for trait in as_list((participant or {}).get("traits"))
        if int((trait or {}).get("style") or 0) > 0
    ]
    rows.sort(
        key=lambda trait: (
            -int((trait or {}).get("style") or 0),
            -int((trait or {}).get("numUnits") or 0),
        )
    )
    out: list[str] = []
    for trait in rows[:limit]:
        name = str((trait or {}).get("name") or "").strip()
        if name:
            out.append(name)
    return out


def compute_baseline_features(match: dict[str, Any]) -> dict[str, Any]:
    player_a = match.get("playerA") or {}
    player_b = match.get("playerB") or {}
    duo_placement = max(int(player_a.get("placement") or 8), int(player_b.get("placement") or 8))
    same_team = bool(match.get("sameTeam"))
    won = same_team and duo_placement <= 2
    top4 = same_team and duo_placement <= 4

    a_three_stars = count_three_stars(as_list(player_a.get("units")))
    b_three_stars = count_three_stars(as_list(player_b.get("units")))
    a_items = item_count(as_list(player_a.get("units")))
    b_items = item_count(as_list(player_b.get("units")))
    a_damage = float(player_a.get("totalDamageToPlayers") or 0)
    b_damage = float(player_b.get("totalDamageToPlayers") or 0)

    a_top_traits = top_traits(player_a)
    b_top_traits = top_traits(player_b)

    return {
        "sameTeam": same_team,
        "won": won,
        "top4": top4,
        "duoPlacement": duo_placement,
        "carryByThreeStarA": a_three_stars > b_three_stars,
        "carryByThreeStarB": b_three_stars > a_three_stars,
        "carryByDamageA": a_damage > b_damage,
        "carryByDamageB": b_damage > a_damage,
        "utilityA": a_items >= 8 and a_damage < b_damage,
        "utilityB": b_items >= 8 and b_damage < a_damage,
        "bothLevel8Plus": int(player_a.get("level") or 0) >= 8 and int(player_b.get("level") or 0) >= 8,
        "duoDamageGap": abs(a_damage - b_damage),
        "traitOverlap": len([name for name in a_top_traits if name in b_top_traits]),
    }


def compute_synergy_fingerprint(matches: list[dict[str, Any]]) -> dict[str, Any]:
    features = [compute_baseline_features(match) for match in matches]
    same_team = [feature for feature in features if feature["sameTeam"]]
    wins = [feature for feature in features if feature["won"]]

    damage_carry_a = sum(1 for feature in same_team if feature["carryByDamageA"])
    damage_carry_b = sum(1 for feature in same_team if feature["carryByDamageB"])
    three_star_carry_a = sum(1 for feature in same_team if feature["carryByThreeStarA"])
    three_star_carry_b = sum(1 for feature in same_team if feature["carryByThreeStarB"])
    support_a = sum(1 for feature in same_team if feature["utilityA"])
    support_b = sum(1 for feature in same_team if feature["utilityB"])

    if damage_carry_a > damage_carry_b:
        likely_stabilizer = "playerA"
    elif damage_carry_b > damage_carry_a:
        likely_stabilizer = "playerB"
    else:
        likely_stabilizer = "balanced"

    if three_star_carry_a > three_star_carry_b:
        carry_pattern = "playerA-carry-playerB-support"
    elif three_star_carry_b > three_star_carry_a:
        carry_pattern = "playerB-carry-playerA-support"
    else:
        carry_pattern = "mixed-carry"

    pattern_catalog = [
        {
            "key": "carry_split_damage",
            "label": "One clear carry and one utility board",
            "hitRate": pct(sum(1 for feature in wins if feature["duoDamageGap"] >= 10), len(wins)),
        },
        {
            "key": "high_cap_boards",
            "label": "Both players hit level 8+",
            "hitRate": pct(sum(1 for feature in wins if feature["bothLevel8Plus"]), len(wins)),
        },
        {
            "key": "low_trait_conflict",
            "label": "Lower trait overlap between partners",
            "hitRate": pct(sum(1 for feature in wins if feature["traitOverlap"] <= 1), len(wins)),
        },
    ]
    pattern_catalog = [entry for entry in pattern_catalog if entry["hitRate"] is not None]
    pattern_catalog.sort(key=lambda entry: float(entry["hitRate"]), reverse=True)

    return {
        "senderReceiver": {
            "likelyPrimaryStabilizer": likely_stabilizer,
            "confidence": clamp(abs(damage_carry_a - damage_carry_b) * 12.5),
        },
        "carrySupport": {
            "carryPattern": carry_pattern,
            "threeStarShareA": pct(three_star_carry_a, len(same_team)),
            "threeStarShareB": pct(three_star_carry_b, len(same_team)),
            "utilityShareA": pct(support_a, len(same_team)),
            "utilityShareB": pct(support_b, len(same_team)),
        },
        "boardTimingAlignment": {
            "status": "needs_round_events",
            "reason": "Riot match payload does not expose per-stage board power spikes for Double Up.",
        },
        "giftUsageStyle": {
            "status": "needs_gift_events",
            "reason": "Gift timing/type requires round-level ingestion from in-client tracker or user tags.",
        },
        "whenYouWinPatterns": pattern_catalog[:3],
        "sampleSize": {
            "sharedGames": len(matches),
            "sameTeamGames": len(same_team),
            "wins": len(wins),
        },
    }


def compute_gift_efficiency(event_log: list[dict[str, Any]]) -> dict[str, Any]:
    gifts = [event for event in as_list(event_log) if event.get("type") == "gift_sent"]
    if not gifts:
        return {
            "status": "needs_gift_events",
            "metrics": None,
            "notes": ["No gift events ingested yet. Add event stream or manual tags to unlock ROI scoring."],
        }

    early_gifts = [gift for gift in gifts if int(read_field(gift, "stageMajor", -1) or -1) <= 2]
    late_gifts = [gift for gift in gifts if int(read_field(gift, "stageMajor", -1) or -1) >= 4]
    unit_gifts = [gift for gift in gifts if read_field(gift, "giftType") == "unit"]
    item_gifts = [gift for gift in gifts if read_field(gift, "giftType") == "item"]
    converted_carry = sum(1 for gift in gifts if read_field(gift, "outcome") == "became_carry")
    benched = sum(1 for gift in gifts if read_field(gift, "outcome") == "benched")

    return {
        "status": "ok",
        "metrics": {
            "earlyGiftRate": pct(len(early_gifts), len(gifts)),
            "lateGiftRate": pct(len(late_gifts), len(gifts)),
            "unitGiftRate": pct(len(unit_gifts), len(gifts)),
            "itemGiftRate": pct(len(item_gifts), len(gifts)),
            "giftROI": pct(converted_carry, len(gifts)),
            "benchWasteRate": pct(benched, len(gifts)),
        },
        "overGiftingAlerts": sum(1 for gift in gifts if read_field(gift, "partnerState") == "stable"),
    }


def compute_rescue_index(event_log: list[dict[str, Any]]) -> dict[str, Any]:
    rescues = [event for event in as_list(event_log) if event.get("type") == "rescue_arrival"]
    total_events = len(as_list(event_log))
    if not rescues:
        return {
            "status": "needs_round_events",
            "rescueRate": None,
            "missedBailouts": None,
            "clutchIndex": None,
            "rescueEvents": 0,
            "totalEvents": total_events,
            "clutchWins": 0,
            "successfulFlips": 0,
        }

    flips = [
        rescue
        for rescue in rescues
        if read_field(rescue, "roundOutcomeBefore") == "loss_likely"
        and read_field(rescue, "roundOutcomeAfter") == "won"
    ]
    clutch_wins = [
        rescue
        for rescue in rescues
        if int(read_field(rescue, "stageMajor", 0) or 0) >= 4
        and read_field(rescue, "teammateAtRisk") is True
        and read_field(rescue, "roundOutcomeAfter") == "won"
    ]

    return {
        "status": "ok",
        "rescueRate": pct(len(rescues), total_events),
        "missedBailouts": sum(1 for event in as_list(event_log) if event.get("type") == "missed_bailout"),
        "clutchIndex": pct(len(clutch_wins), len(rescues)),
        "successfulFlipRate": pct(len(flips), len(rescues)),
        "rescueEvents": len(rescues),
        "totalEvents": total_events,
        "clutchWins": len(clutch_wins),
        "successfulFlips": len(flips),
    }


def compute_econ_coordination(event_log: list[dict[str, Any]]) -> dict[str, Any]:
    rolls = [event for event in as_list(event_log) if event.get("type") == "roll_down"]
    if not rolls:
        return {
            "status": "needs_round_events",
            "coordinationScore": None,
            "staggerSuggestions": [],
        }

    roll_by_stage: dict[str, int] = {}
    for roll in rolls:
        stage_major = read_field(roll, "stageMajor", "?")
        stage_minor = read_field(roll, "stageMinor", "?")
        key = f"{stage_major}-{stage_minor}"
        roll_by_stage[key] = roll_by_stage.get(key, 0) + 1

    overlap_stages = [stage for stage, count in roll_by_stage.items() if count > 1]
    overlap_penalty = len(overlap_stages) * 18

    return {
        "status": "ok",
        "coordinationScore": clamp(100 - overlap_penalty),
        "overlapStages": overlap_stages,
        "staggerSuggestions": [
            "Default: one player rolls on 3-2, partner rolls on 4-1.",
            "If both low HP at 3-5, call emergency dual roll only with explicit cap target.",
        ],
    }


def compute_decision_quality(matches: list[dict[str, Any]], event_log: list[dict[str, Any]]) -> dict[str, Any]:
    same_team_matches = [match for match in matches if bool(match.get("sameTeam"))]
    low_results = [
        match
        for match in same_team_matches
        if max(int((match.get("playerA") or {}).get("placement") or 8), int((match.get("playerB") or {}).get("placement") or 8)) >= 6
    ]
    top_results = [
        match
        for match in same_team_matches
        if max(int((match.get("playerA") or {}).get("placement") or 8), int((match.get("playerB") or {}).get("placement") or 8)) <= 4
    ]

    event_count = len(as_list(event_log))
    has_decision_events = event_count > 0
    leaks: list[dict[str, str]] = []
    panic_roll_count = sum(1 for event in as_list(event_log) if read_field(event, "tag") == "panic_roll")
    missed_gift_count = sum(1 for event in as_list(event_log) if read_field(event, "tag") == "missed_gift")
    unplanned_low_gold_rolls = sum(
        1
        for event in as_list(event_log)
        if event.get("type") == "roll_down" and int(read_field(event, "goldAfter", 99) or 99) < 20
    )

    if not has_decision_events and low_results:
        leaks.append(
            {
                "leak": "Insufficient process data",
                "whyItMatters": "Outcome-only data can hide correct decisions in bad variance spots.",
                "doInstead": "Capture roll, slam, gift, and pivot tags each stage.",
            }
        )

    if len(low_results) > len(top_results):
        leaks.append(
            {
                "leak": "Late board stabilization pattern",
                "whyItMatters": "Bottom placements outnumber top finishes in same-team games.",
                "doInstead": "Assign one stabilizer by Stage 3 and lock a roll stage before carousel.",
            }
        )

    if unplanned_low_gold_rolls > 0 or panic_roll_count > 0:
        leaks.append(
            {
                "leak": "Roll discipline leaks",
                "whyItMatters": "Low-gold emergency rolls are frequent and often reduce cap options later.",
                "doInstead": "Set explicit roll floors and only break with pre-declared emergency trigger.",
            }
        )

    if missed_gift_count > 0:
        leaks.append(
            {
                "leak": "Missed bailout gifting windows",
                "whyItMatters": "Skipping gifts when partner is bleeding usually compounds HP losses.",
                "doInstead": "Pre-commit bailout trigger: send item/unit when partner <40 HP and your board is stable.",
            }
        )

    leaks.append(
        {
            "leak": "No augment fit signal logged",
            "whyItMatters": "Augment mismatch is a common hidden EV drain in duo lines.",
            "doInstead": "Log augment intent tag each augment armory and track fit score.",
        }
    )

    return {
        "grade": clamp(68 + (len(top_results) - len(low_results)) * 2 - panic_roll_count * 3 - missed_gift_count * 2),
        "leakCount": len(leaks),
        "biggestLeaks": leaks[:3],
        "evaluationMode": "process_plus_outcome" if has_decision_events else "outcome_with_coverage_warnings",
    }


def build_data_coverage(event_log: list[dict[str, Any]]) -> dict[str, Any]:
    has_events = len(as_list(event_log)) > 0
    return {
        "riotMatchPayload": True,
        "roundTimelineEvents": has_events,
        "giftEvents": any(event.get("type") == "gift_sent" for event in as_list(event_log)),
        "commsSignals": any(event.get("type") == "comms_snapshot" for event in as_list(event_log)),
        "intentTags": any(event.get("type") == "intent_tag" for event in as_list(event_log)),
    }


def build_duo_scorecard(matches: list[dict[str, Any]] | None = None, event_log: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    matches = as_list(matches)
    event_log = as_list(event_log)
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "dataCoverage": build_data_coverage(event_log),
        "synergyFingerprint": compute_synergy_fingerprint(matches),
        "giftEfficiency": compute_gift_efficiency(event_log),
        "rescueIndex": compute_rescue_index(event_log),
        "econCoordination": compute_econ_coordination(event_log),
        "decisionQuality": compute_decision_quality(matches, event_log),
        "coachingReplay": {
            "status": "template_ready",
            "stage2": "Choose highest board strength opener from shops + slammable components.",
            "stage3": "Declare duo plan: one stabilizes, one greed econ unless both sub-55 HP.",
            "stage4": "Roll ownership: primary roller sends best-fit gift to partner.",
            "ifThenExamples": [
                "If no stable frontline by 4-1, pivot to 4-cost board and protect streak.",
                "If one player spikes 2-star carry early, partner greed to fast level and send utility gift.",
            ],
        },
    }


def build_personalized_playbook(matches: list[dict[str, Any]] | None = None, event_log: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    matches = as_list(matches)
    event_log = as_list(event_log)
    same_team_matches = [match for match in matches if bool(match.get("sameTeam"))]
    wins = [
        match
        for match in same_team_matches
        if max(int((match.get("playerA") or {}).get("placement") or 8), int((match.get("playerB") or {}).get("placement") or 8)) <= 4
    ]
    roll_events = [event for event in event_log if event.get("type") == "roll_down"]
    gift_events = [event for event in event_log if event.get("type") == "gift_sent"]

    top_openers: list[dict[str, Any]] = []
    for index, match in enumerate(wins[:5]):
        a_traits = top_traits(match.get("playerA") or {}, 2)
        b_traits = top_traits(match.get("playerB") or {}, 2)
        top_openers.append(
            {
                "id": f"{match.get('id') or 'match'}-{index}",
                "matchId": match.get("id"),
                "patch": match.get("patch"),
                "setNumber": match.get("setNumber"),
                "playerA": a_traits if a_traits else ["Flex"],
                "playerB": b_traits if b_traits else ["Flex"],
            }
        )

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "topOpeners": top_openers[:5],
        "stableGreedyPlan": "Default split: Player with stronger Stage 3 board stabilizes, partner greed-econs to Stage 4 roll.",
        "bothTempoPlan": "When both sub-60 HP by Stage 3-5, dual stabilize and convert to Top 4 line.",
        "bannedBehaviors": [
            "Both players hard rolling before 4-1 without emergency call.",
            "No gift sent in Stage 3 when one partner is bleeding.",
            "Both players holding same carry components without pivot assignment.",
        ],
        "signalSummary": {
            "rollEvents": len(roll_events),
            "giftEvents": len(gift_events),
            "sameTeamGames": len(same_team_matches),
        },
    }


def build_duo_highlights(matches: list[dict[str, Any]] | None = None, event_log: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    matches = as_list(matches)
    event_log = as_list(event_log)
    same_team_matches = [match for match in matches if bool(match.get("sameTeam"))]
    rescue_events = [event for event in event_log if event.get("type") == "rescue_arrival"]
    gifts = [event for event in event_log if event.get("type") == "gift_sent"]
    top2s = [
        match
        for match in same_team_matches
        if max(int((match.get("playerA") or {}).get("placement") or 8), int((match.get("playerB") or {}).get("placement") or 8)) <= 2
    ]

    highlights: list[str] = []
    if top2s:
        highlights.append(f"Reached Top 2 in {len(top2s)} same-team games in this window.")
    if rescue_events:
        highlights.append(f"Triggered {len(rescue_events)} rescue arrivals.")
    if gifts:
        highlights.append(f"Sent {len(gifts)} tracked gifts to support duo spikes.")
    if not highlights:
        highlights.append("No highlight events yet. Add journal/event tags to generate recaps.")

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "highlights": highlights,
    }
