function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function readField(event, fieldName, fallback = null) {
  if (event && Object.prototype.hasOwnProperty.call(event, fieldName)) {
    return event[fieldName];
  }
  if (event?.payload && Object.prototype.hasOwnProperty.call(event.payload, fieldName)) {
    return event.payload[fieldName];
  }
  return fallback;
}

function clamp(value, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function pct(numerator, denominator) {
  if (!denominator) return null;
  return (numerator / denominator) * 100;
}

function countThreeStars(units) {
  return asArray(units).filter((unit) => (unit.tier || 0) >= 3).length;
}

function itemCount(units) {
  return asArray(units).reduce((sum, unit) => sum + asArray(unit.items).length, 0);
}

function topTraits(participant, limit = 3) {
  return asArray(participant?.traits)
    .filter((trait) => (trait.style || 0) > 0)
    .sort((a, b) => (b.style || 0) - (a.style || 0) || (b.numUnits || 0) - (a.numUnits || 0))
    .slice(0, limit)
    .map((trait) => trait.name)
    .filter(Boolean);
}

function computeBaselineFeatures(match) {
  const playerA = match.playerA || {};
  const playerB = match.playerB || {};
  const duoPlacement = Math.max(playerA.placement || 8, playerB.placement || 8);
  const sameTeam = Boolean(match.sameTeam);
  const won = sameTeam && duoPlacement <= 2;
  const top4 = sameTeam && duoPlacement <= 4;

  const aThreeStars = countThreeStars(playerA.units);
  const bThreeStars = countThreeStars(playerB.units);
  const aItems = itemCount(playerA.units);
  const bItems = itemCount(playerB.units);
  const aDamage = Number(playerA.totalDamageToPlayers || 0);
  const bDamage = Number(playerB.totalDamageToPlayers || 0);

  return {
    sameTeam,
    won,
    top4,
    duoPlacement,
    carryByThreeStarA: aThreeStars > bThreeStars,
    carryByThreeStarB: bThreeStars > aThreeStars,
    carryByDamageA: aDamage > bDamage,
    carryByDamageB: bDamage > aDamage,
    utilityA: aItems >= 8 && aDamage < bDamage,
    utilityB: bItems >= 8 && bDamage < aDamage,
    bothLevel8Plus: (playerA.level || 0) >= 8 && (playerB.level || 0) >= 8,
    duoDamageGap: Math.abs(aDamage - bDamage),
    traitOverlap: topTraits(playerA).filter((trait) => topTraits(playerB).includes(trait)).length,
  };
}

function computeSynergyFingerprint(matches) {
  const features = matches.map(computeBaselineFeatures);
  const sameTeam = features.filter((feature) => feature.sameTeam);
  const wins = features.filter((feature) => feature.won);

  const damageCarryA = sameTeam.filter((feature) => feature.carryByDamageA).length;
  const damageCarryB = sameTeam.filter((feature) => feature.carryByDamageB).length;
  const threeStarCarryA = sameTeam.filter((feature) => feature.carryByThreeStarA).length;
  const threeStarCarryB = sameTeam.filter((feature) => feature.carryByThreeStarB).length;
  const supportA = sameTeam.filter((feature) => feature.utilityA).length;
  const supportB = sameTeam.filter((feature) => feature.utilityB).length;

  const senderReceiver = {
    likelyPrimaryStabilizer:
      damageCarryA > damageCarryB ? "playerA" : damageCarryB > damageCarryA ? "playerB" : "balanced",
    confidence: clamp(Math.abs(damageCarryA - damageCarryB) * 12.5),
  };

  const carrySupport = {
    carryPattern:
      threeStarCarryA > threeStarCarryB
        ? "playerA-carry-playerB-support"
        : threeStarCarryB > threeStarCarryA
        ? "playerB-carry-playerA-support"
        : "mixed-carry",
    threeStarShareA: pct(threeStarCarryA, sameTeam.length),
    threeStarShareB: pct(threeStarCarryB, sameTeam.length),
    utilityShareA: pct(supportA, sameTeam.length),
    utilityShareB: pct(supportB, sameTeam.length),
  };

  const boardTimingAlignment = {
    status: "needs_round_events",
    reason: "Riot match payload does not expose per-stage board power spikes for Double Up.",
  };

  const giftUsageStyle = {
    status: "needs_gift_events",
    reason: "Gift timing/type requires round-level ingestion from in-client tracker or user tags.",
  };

  const patternCatalog = [
    {
      key: "carry_split_damage",
      label: "One clear carry and one utility board",
      hitRate: pct(wins.filter((feature) => feature.duoDamageGap >= 10).length, wins.length),
    },
    {
      key: "high_cap_boards",
      label: "Both players hit level 8+",
      hitRate: pct(wins.filter((feature) => feature.bothLevel8Plus).length, wins.length),
    },
    {
      key: "low_trait_conflict",
      label: "Lower trait overlap between partners",
      hitRate: pct(wins.filter((feature) => feature.traitOverlap <= 1).length, wins.length),
    },
  ]
    .filter((pattern) => pattern.hitRate !== null)
    .sort((a, b) => b.hitRate - a.hitRate)
    .slice(0, 3);

  return {
    senderReceiver,
    carrySupport,
    boardTimingAlignment,
    giftUsageStyle,
    whenYouWinPatterns: patternCatalog,
    sampleSize: {
      sharedGames: matches.length,
      sameTeamGames: sameTeam.length,
      wins: wins.length,
    },
  };
}

function computeGiftEfficiency(eventLog) {
  const gifts = asArray(eventLog).filter((event) => event.type === "gift_sent");
  if (!gifts.length) {
    return {
      status: "needs_gift_events",
      metrics: null,
      notes: ["No gift events ingested yet. Add event stream or manual tags to unlock ROI scoring."],
    };
  }

  const earlyGifts = gifts.filter((gift) => Number(readField(gift, "stageMajor", -1)) <= 2);
  const lateGifts = gifts.filter((gift) => Number(readField(gift, "stageMajor", -1)) >= 4);
  const unitGifts = gifts.filter((gift) => readField(gift, "giftType") === "unit");
  const itemGifts = gifts.filter((gift) => readField(gift, "giftType") === "item");
  const convertedCarry = gifts.filter((gift) => readField(gift, "outcome") === "became_carry").length;
  const benched = gifts.filter((gift) => readField(gift, "outcome") === "benched").length;

  return {
    status: "ok",
    metrics: {
      earlyGiftRate: pct(earlyGifts.length, gifts.length),
      lateGiftRate: pct(lateGifts.length, gifts.length),
      unitGiftRate: pct(unitGifts.length, gifts.length),
      itemGiftRate: pct(itemGifts.length, gifts.length),
      giftROI: pct(convertedCarry, gifts.length),
      benchWasteRate: pct(benched, gifts.length),
    },
    overGiftingAlerts: gifts.filter((gift) => readField(gift, "partnerState") === "stable").length,
  };
}

function computeRescueIndex(eventLog) {
  const rescues = asArray(eventLog).filter((event) => event.type === "rescue_arrival");
  if (!rescues.length) {
    return {
      status: "needs_round_events",
      rescueRate: null,
      missedBailouts: null,
      clutchIndex: null,
    };
  }

  const flips = rescues.filter(
    (rescue) =>
      readField(rescue, "roundOutcomeBefore") === "loss_likely" && readField(rescue, "roundOutcomeAfter") === "won"
  );
  const clutchWins = rescues.filter(
    (rescue) =>
      Number(readField(rescue, "stageMajor", 0)) >= 4 &&
      readField(rescue, "teammateAtRisk") === true &&
      readField(rescue, "roundOutcomeAfter") === "won"
  );

  return {
    status: "ok",
    rescueRate: pct(rescues.length, asArray(eventLog).length),
    missedBailouts: asArray(eventLog).filter((event) => event.type === "missed_bailout").length,
    clutchIndex: pct(clutchWins.length, rescues.length),
    successfulFlipRate: pct(flips.length, rescues.length),
  };
}

function computeEconCoordination(eventLog) {
  const rolls = asArray(eventLog).filter((event) => event.type === "roll_down");
  if (!rolls.length) {
    return {
      status: "needs_round_events",
      coordinationScore: null,
      staggerSuggestions: [],
    };
  }

  const rollByStage = new Map();
  for (const roll of rolls) {
    const stageMajor = readField(roll, "stageMajor", "?");
    const stageMinor = readField(roll, "stageMinor", "?");
    const key = `${stageMajor}-${stageMinor}`;
    const count = rollByStage.get(key) || 0;
    rollByStage.set(key, count + 1);
  }

  const overlapStages = [...rollByStage.entries()].filter(([, count]) => count > 1).map(([stage]) => stage);
  const overlapPenalty = overlapStages.length * 18;
  const score = clamp(100 - overlapPenalty);

  return {
    status: "ok",
    coordinationScore: score,
    overlapStages,
    staggerSuggestions: [
      "Default: one player rolls on 3-2, partner rolls on 4-1.",
      "If both low HP at 3-5, call emergency dual roll only with explicit cap target.",
    ],
  };
}

function computeDecisionQuality(matches, eventLog) {
  const sameTeamMatches = matches.filter((match) => match.sameTeam);
  const lowResults = sameTeamMatches.filter(
    (match) => Math.max(match.playerA?.placement || 8, match.playerB?.placement || 8) >= 6
  );
  const topResults = sameTeamMatches.filter(
    (match) => Math.max(match.playerA?.placement || 8, match.playerB?.placement || 8) <= 4
  );

  const eventCount = asArray(eventLog).length;
  const hasDecisionEvents = eventCount > 0;
  const leaks = [];
  const panicRollCount = asArray(eventLog).filter((event) => readField(event, "tag") === "panic_roll").length;
  const missedGiftCount = asArray(eventLog).filter((event) => readField(event, "tag") === "missed_gift").length;
  const unplannedLowGoldRolls = asArray(eventLog).filter(
    (event) => event.type === "roll_down" && Number(readField(event, "goldAfter", 99)) < 20
  ).length;

  if (!hasDecisionEvents && lowResults.length) {
    leaks.push({
      leak: "Insufficient process data",
      whyItMatters: "Outcome-only data can hide correct decisions in bad variance spots.",
      doInstead: "Capture roll, slam, gift, and pivot tags each stage.",
    });
  }

  if (lowResults.length > topResults.length) {
    leaks.push({
      leak: "Late board stabilization pattern",
      whyItMatters: "Bottom placements outnumber top finishes in same-team games.",
      doInstead: "Assign one stabilizer by Stage 3 and lock a roll stage before carousel.",
    });
  }

  if (unplannedLowGoldRolls > 0 || panicRollCount > 0) {
    leaks.push({
      leak: "Roll discipline leaks",
      whyItMatters: "Low-gold emergency rolls are frequent and often reduce cap options later.",
      doInstead: "Set explicit roll floors and only break with pre-declared emergency trigger.",
    });
  }

  if (missedGiftCount > 0) {
    leaks.push({
      leak: "Missed bailout gifting windows",
      whyItMatters: "Skipping gifts when partner is bleeding usually compounds HP losses.",
      doInstead: "Pre-commit bailout trigger: send item/unit when partner <40 HP and your board is stable.",
    });
  }

  leaks.push({
    leak: "No augment fit signal logged",
    whyItMatters: "Augment mismatch is a common hidden EV drain in duo lines.",
    doInstead: "Log augment intent tag each augment armory and track fit score.",
  });

  return {
    grade: clamp(68 + (topResults.length - lowResults.length) * 2 - panicRollCount * 3 - missedGiftCount * 2),
    leakCount: leaks.length,
    biggestLeaks: leaks.slice(0, 3),
    evaluationMode: hasDecisionEvents ? "process_plus_outcome" : "outcome_with_coverage_warnings",
  };
}

function buildDataCoverage(eventLog) {
  const hasEvents = asArray(eventLog).length > 0;
  return {
    riotMatchPayload: true,
    roundTimelineEvents: hasEvents,
    giftEvents: asArray(eventLog).some((event) => event.type === "gift_sent"),
    commsSignals: asArray(eventLog).some((event) => event.type === "comms_snapshot"),
    intentTags: asArray(eventLog).some((event) => event.type === "intent_tag"),
  };
}

export function buildDuoScorecard({ matches = [], eventLog = [] } = {}) {
  const synergyFingerprint = computeSynergyFingerprint(asArray(matches));
  const giftEfficiency = computeGiftEfficiency(asArray(eventLog));
  const rescueIndex = computeRescueIndex(asArray(eventLog));
  const econCoordination = computeEconCoordination(asArray(eventLog));
  const decisionQuality = computeDecisionQuality(asArray(matches), asArray(eventLog));

  return {
    generatedAt: new Date().toISOString(),
    dataCoverage: buildDataCoverage(asArray(eventLog)),
    synergyFingerprint,
    giftEfficiency,
    rescueIndex,
    econCoordination,
    decisionQuality,
    coachingReplay: {
      status: "template_ready",
      stage2: "Choose highest board strength opener from shops + slammable components.",
      stage3: "Declare duo plan: one stabilizes, one greed econ unless both sub-55 HP.",
      stage4: "Roll ownership: primary roller sends best-fit gift to partner.",
      ifThenExamples: [
        "If no stable frontline by 4-1, pivot to 4-cost board and protect streak.",
        "If one player spikes 2-star carry early, partner greed to fast level and send utility gift.",
      ],
    },
  };
}

export function buildPersonalizedPlaybook({ matches = [], eventLog = [] } = {}) {
  const sameTeamMatches = asArray(matches).filter((match) => match.sameTeam);
  const wins = sameTeamMatches.filter(
    (match) => Math.max(match.playerA?.placement || 8, match.playerB?.placement || 8) <= 4
  );
  const rollEvents = asArray(eventLog).filter((event) => event.type === "roll_down");
  const giftEvents = asArray(eventLog).filter((event) => event.type === "gift_sent");

  const topOpeners = wins
    .slice(0, 5)
    .map((match, index) => {
      const aTraits = topTraits(match.playerA, 2);
      const bTraits = topTraits(match.playerB, 2);
      return {
        id: `${match.id || "match"}-${index}`,
        matchId: match.id || null,
        patch: match.patch || null,
        setNumber: match.setNumber ?? null,
        playerA: aTraits.length ? aTraits : ["Flex"],
        playerB: bTraits.length ? bTraits : ["Flex"],
      };
    })
    .filter((entry) => entry.playerA.length || entry.playerB.length);

  return {
    generatedAt: new Date().toISOString(),
    topOpeners: topOpeners.slice(0, 5),
    stableGreedyPlan:
      "Default split: Player with stronger Stage 3 board stabilizes, partner greed-econs to Stage 4 roll.",
    bothTempoPlan: "When both sub-60 HP by Stage 3-5, dual stabilize and convert to Top 4 line.",
    bannedBehaviors: [
      "Both players hard rolling before 4-1 without emergency call.",
      "No gift sent in Stage 3 when one partner is bleeding.",
      "Both players holding same carry components without pivot assignment.",
    ],
    signalSummary: {
      rollEvents: rollEvents.length,
      giftEvents: giftEvents.length,
      sameTeamGames: sameTeamMatches.length,
    },
  };
}

export function buildDuoHighlights({ matches = [], eventLog = [] } = {}) {
  const sameTeamMatches = asArray(matches).filter((match) => match.sameTeam);
  const rescueEvents = asArray(eventLog).filter((event) => event.type === "rescue_arrival");
  const gifts = asArray(eventLog).filter((event) => event.type === "gift_sent");
  const top2s = sameTeamMatches.filter(
    (match) => Math.max(match.playerA?.placement || 8, match.playerB?.placement || 8) <= 2
  );

  const highlights = [];
  if (top2s.length) {
    highlights.push(`Reached Top 2 in ${top2s.length} same-team games in this window.`);
  }
  if (rescueEvents.length) {
    highlights.push(`Triggered ${rescueEvents.length} rescue arrivals.`);
  }
  if (gifts.length) {
    highlights.push(`Sent ${gifts.length} tracked gifts to support duo spikes.`);
  }
  if (!highlights.length) {
    highlights.push("No highlight events yet. Add journal/event tags to generate recaps.");
  }

  return {
    generatedAt: new Date().toISOString(),
    highlights,
  };
}
