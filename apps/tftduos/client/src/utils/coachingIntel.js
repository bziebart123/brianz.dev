import { asArray, prettyName, teamPlacementFromMatch, toEpochMs } from "./tft";

function avg(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function pct(numerator, denominator) {
  if (!denominator) return 0;
  return (numerator / denominator) * 100;
}

function std(values) {
  if (!values.length) return 0;
  const mean = avg(values);
  const variance = avg(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function clamp(value, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function normalizeToken(value) {
  return String(value || "").trim().toLowerCase();
}

function topTraitName(player) {
  const top = asArray(player?.traits)
    .filter((trait) => Number(trait?.style || 0) > 0)
    .sort((a, b) => Number(b?.style || 0) - Number(a?.style || 0))[0];
  return String(top?.name || "");
}

function inferPlayerRole(match, side) {
  const me = side === "A" ? match?.playerA : match?.playerB;
  const partner = side === "A" ? match?.playerB : match?.playerA;
  const myDamage = Number(me?.totalDamageToPlayers || 0);
  const partnerDamage = Number(partner?.totalDamageToPlayers || 0);
  const totalDamage = myDamage + partnerDamage;
  const myDamageShare = totalDamage ? myDamage / totalDamage : 0.5;
  const myGold = Number(me?.goldLeft || 0);

  if (myDamageShare >= 0.56 || myGold < 8) return "tempo";
  return "econ";
}

function sentence(text, value, unit = "") {
  return `${text} ${Number(value || 0).toFixed(1)}${unit}`;
}

function buildTiltAndStreak(sortedMatches, scorecard) {
  const placements = sortedMatches.map((match) => teamPlacementFromMatch(match));
  const recent = placements.slice(-6);
  const prior = placements.slice(-12, -6);
  const recentAvg = avg(recent);
  const priorAvg = avg(prior);
  const drop = prior.length ? recentAvg - priorAvg : 0;
  const recentStd = std(recent);
  const priorStd = std(prior);
  const varianceJump = recentStd - priorStd;

  let currentBadStreak = 0;
  let longestBadStreak = 0;
  for (const placement of placements) {
    if (placement >= 3) {
      currentBadStreak += 1;
      longestBadStreak = Math.max(longestBadStreak, currentBadStreak);
    } else {
      currentBadStreak = 0;
    }
  }

  const hasRollLeak = asArray(scorecard?.decisionQuality?.biggestLeaks).some((item) =>
    String(item?.leak || "").toLowerCase().includes("roll")
  );

  const tiltScore = clamp(
    (drop > 0 ? drop * 38 : 0) +
      (varianceJump > 0 ? varianceJump * 24 : 0) +
      (currentBadStreak >= 2 ? currentBadStreak * 12 : 0) +
      (hasRollLeak ? 12 : 0)
  );
  const inTiltWindow = tiltScore >= 58;
  const resetRule =
    drop > 0.6
      ? "Run one forced low-variance game: one tempo stabilizer + one econ support. No dual-roll before 4-1."
      : "Pause 5 minutes, then requeue with pre-commitment: first contested trait gets immediate pivot.";

  return {
    inTiltWindow,
    tiltScore,
    currentBadStreak,
    longestBadStreak,
    recentAvg,
    priorAvg,
    varianceJump,
    resetRule,
  };
}

function buildPlayerFingerprint(matches, side, metaTraitSet) {
  const key = side === "A" ? "playerA" : "playerB";
  const placements = [];
  const levels = [];
  const goldLeft = [];
  const traitCounts = {};

  for (const match of matches) {
    const player = match?.[key];
    if (!player) continue;
    placements.push(Number(player?.placement || 8));
    levels.push(Number(player?.level || 0));
    goldLeft.push(Number(player?.goldLeft || 0));
    asArray(player?.traits)
      .filter((trait) => Number(trait?.style || 0) > 0)
      .forEach((trait) => {
        const name = normalizeToken(trait?.name);
        if (!name) return;
        traitCounts[name] = (traitCounts[name] || 0) + 1;
      });
  }

  const labels = [];
  const meanLevel = avg(levels);
  const meanGold = avg(goldLeft);
  const placementVar = std(placements);
  const top4Rate = pct(placements.filter((value) => value <= 4).length, placements.length);

  if (meanLevel >= 8.5 && meanGold < 8) labels.push("Tempo Pusher");
  if (meanGold >= 12) labels.push("Econ Greeder");
  if (placementVar >= 1.8) labels.push("High Variance Gambler");
  if (placementVar <= 1.2) labels.push("Consistency Grinder");
  if (top4Rate >= 62) labels.push("Stable Top4 Closer");

  const contestedHits = Object.entries(traitCounts).filter(([trait]) => metaTraitSet.has(trait)).length;
  if (contestedHits >= 2) labels.push("Contested-Trait Fighter");
  if (contestedHits <= 1) labels.push("Pivot Specialist");

  return {
    labels: [...new Set(labels)].slice(0, 5),
    metrics: {
      avgLevel: meanLevel,
      avgGoldLeft: meanGold,
      top4Rate,
      placementVariance: placementVar,
    },
    topTraits: Object.entries(traitCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => prettyName(name)),
  };
}

function buildDuoFingerprint(matches) {
  const splits = { tempoEcon: 0, dualTempo: 0, dualEcon: 0 };
  const overlapScores = [];
  for (const match of matches) {
    const roleA = inferPlayerRole(match, "A");
    const roleB = inferPlayerRole(match, "B");
    if (roleA === "tempo" && roleB === "econ") splits.tempoEcon += 1;
    else if (roleA === "econ" && roleB === "tempo") splits.tempoEcon += 1;
    else if (roleA === "tempo" && roleB === "tempo") splits.dualTempo += 1;
    else splits.dualEcon += 1;

    const topA = topTraitName(match?.playerA);
    const topB = topTraitName(match?.playerB);
    overlapScores.push(topA && topB && normalizeToken(topA) === normalizeToken(topB) ? 1 : 0);
  }
  const overlapRate = pct(overlapScores.filter(Boolean).length, overlapScores.length);

  const labels = [];
  if (splits.tempoEcon >= Math.max(splits.dualTempo, splits.dualEcon)) labels.push("Role-Split Duo");
  if (splits.dualTempo > splits.tempoEcon) labels.push("Double Tempo Duo");
  if (splits.dualEcon > splits.tempoEcon) labels.push("Double Econ Duo");
  if (overlapRate >= 45) labels.push("High Overlap Pair");
  if (overlapRate <= 20) labels.push("Complementary Boards");

  return {
    labels: [...new Set(labels)].slice(0, 5),
    metrics: {
      tempoEconRate: pct(splits.tempoEcon, matches.length),
      dualTempoRate: pct(splits.dualTempo, matches.length),
      dualEconRate: pct(splits.dualEcon, matches.length),
      traitOverlapRate: overlapRate,
    },
  };
}

function buildWinConditionMiner(matches) {
  const sameTeam = matches.filter((match) => match?.sameTeam);
  const top2 = sameTeam.filter((match) => teamPlacementFromMatch(match) <= 2);
  const sample = sameTeam.length;
  const baseTop2 = pct(top2.length, sample);

  const splitGroup = { yes: [], no: [] };
  const bothLevel8 = { yes: [], no: [] };
  const pairMap = new Map();

  for (const match of sameTeam) {
    const placement = teamPlacementFromMatch(match);
    const isTop2 = placement <= 2;
    const roleA = inferPlayerRole(match, "A");
    const roleB = inferPlayerRole(match, "B");
    const split = roleA !== roleB;
    splitGroup[split ? "yes" : "no"].push(isTop2);

    const both8 = Number(match?.playerA?.level || 0) >= 8 && Number(match?.playerB?.level || 0) >= 8;
    bothLevel8[both8 ? "yes" : "no"].push(isTop2);

    const aTrait = normalizeToken(topTraitName(match?.playerA));
    const bTrait = normalizeToken(topTraitName(match?.playerB));
    if (!aTrait || !bTrait) continue;
    const key = `${aTrait}|${bTrait}`;
    if (!pairMap.has(key)) pairMap.set(key, { wins: 0, total: 0, a: aTrait, b: bTrait });
    const row = pairMap.get(key);
    row.total += 1;
    if (isTop2) row.wins += 1;
  }

  const splitRate = pct(splitGroup.yes.filter(Boolean).length, splitGroup.yes.length);
  const nonSplitRate = pct(splitGroup.no.filter(Boolean).length, splitGroup.no.length);
  const level8Rate = pct(bothLevel8.yes.filter(Boolean).length, bothLevel8.yes.length);
  const nonLevel8Rate = pct(bothLevel8.no.filter(Boolean).length, bothLevel8.no.length);

  const bestPair = [...pairMap.values()]
    .filter((row) => row.total >= 2)
    .sort((a, b) => (b.wins / b.total) - (a.wins / a.total) || b.total - a.total)[0];

  const conditions = [];
  if (splitGroup.yes.length >= 3) {
    conditions.push({
      title: "Tempo + Econ Split",
      detail: `When roles split, Top2 is ${splitRate.toFixed(1)}% vs ${nonSplitRate.toFixed(1)}% baseline.`,
      lift: splitRate - nonSplitRate,
    });
  }
  if (bothLevel8.yes.length >= 3) {
    conditions.push({
      title: "Dual Level-8 Timing",
      detail: `When both hit level 8+, Top2 is ${level8Rate.toFixed(1)}% vs ${nonLevel8Rate.toFixed(1)}%.`,
      lift: level8Rate - nonLevel8Rate,
    });
  }
  if (bestPair) {
    const rate = pct(bestPair.wins, bestPair.total);
    conditions.push({
      title: "Trait Pair Spike",
      detail: `When A plays ${prettyName(bestPair.a)} and B plays ${prettyName(bestPair.b)}, Top2 is ${rate.toFixed(1)}% (${bestPair.wins}/${bestPair.total}).`,
      lift: rate - baseTop2,
    });
  }

  return {
    baseTop2,
    sample,
    conditions: conditions.sort((a, b) => b.lift - a.lift).slice(0, 3),
  };
}

function buildLossAutopsy(matches) {
  const ranked = [...matches]
    .sort((a, b) => teamPlacementFromMatch(b) - teamPlacementFromMatch(a) || toEpochMs(b?.gameDatetime) - toEpochMs(a?.gameDatetime))
    .slice(0, 3);

  const entries = ranked.map((match) => {
    const placement = teamPlacementFromMatch(match);
    const levelA = Number(match?.playerA?.level || 0);
    const levelB = Number(match?.playerB?.level || 0);
    const damageA = Number(match?.playerA?.totalDamageToPlayers || 0);
    const damageB = Number(match?.playerB?.totalDamageToPlayers || 0);
    const goldA = Number(match?.playerA?.goldLeft || 0);
    const goldB = Number(match?.playerB?.goldLeft || 0);

    const factors = [];
    if (placement >= 4) factors.push({ reason: "Late collapse (team bottom half finish)", weight: 35 });
    if ((levelA + levelB) / 2 < 8) factors.push({ reason: "Low board cap (average level below 8)", weight: 28 });
    if (damageA + damageB < 90) factors.push({ reason: "Low pressure output (combined damage under 90)", weight: 24 });
    if (goldA <= 5 || goldB <= 5) factors.push({ reason: "Resource exhaustion signal (one player near zero gold)", weight: 18 });
    if (!factors.length) factors.push({ reason: "Variance loss with no dominant structural leak", weight: 14 });

    const score = clamp(factors.reduce((sum, item) => sum + item.weight, 0));
    return {
      matchId: match?.id || "unknown",
      placement,
      date: toEpochMs(match?.gameDatetime),
      confidence: score,
      factors: factors.sort((a, b) => b.weight - a.weight).slice(0, 3),
    };
  });

  return entries.sort((a, b) => b.confidence - a.confidence);
}

function buildContestedMetaPressure(matches, computed) {
  const meta = asArray(computed?.metaTraits);
  const topMeta = meta.slice(0, 6);
  const weightMap = new Map();
  const topCount = topMeta.length ? topMeta[0].count : 1;
  for (const trait of topMeta) {
    weightMap.set(normalizeToken(trait?.name), Number(trait?.count || 0) / topCount);
  }

  const overlapScores = [];
  for (const match of matches) {
    const picks = [
      ...asArray(match?.playerA?.traits).filter((trait) => Number(trait?.style || 0) > 0).map((trait) => normalizeToken(trait?.name)),
      ...asArray(match?.playerB?.traits).filter((trait) => Number(trait?.style || 0) > 0).map((trait) => normalizeToken(trait?.name)),
    ];
    if (!picks.length) continue;
    const uniq = [...new Set(picks)];
    const overlap = uniq.reduce((sum, token) => sum + (weightMap.get(token) || 0), 0);
    overlapScores.push((overlap / Math.max(1, uniq.length)) * 100);
  }

  const score = clamp(avg(overlapScores));
  const recommendation =
    score >= 65
      ? "Your line is heavily contested. Lock one uncontested pivot before 3-2."
      : score >= 45
      ? "Moderately contested line. Keep one backup carry/item route ready."
      : "Meta pressure is manageable. You can stay on comfort lines unless shop forces pivot.";

  return {
    score,
    recommendation,
    sample: overlapScores.length,
  };
}

function buildTimingCoach(matches, scorecard) {
  const sameTeam = matches.filter((match) => match?.sameTeam);
  const top2 = sameTeam.filter((match) => teamPlacementFromMatch(match) <= 2);
  const bot2 = sameTeam.filter((match) => teamPlacementFromMatch(match) >= 3);

  const top2Level = avg(
    top2.map((match) => avg([Number(match?.playerA?.level || 0), Number(match?.playerB?.level || 0)]))
  );
  const bot2Level = avg(
    bot2.map((match) => avg([Number(match?.playerA?.level || 0), Number(match?.playerB?.level || 0)]))
  );
  const levelDelta = top2Level - bot2Level;
  const overlapStages = asArray(scorecard?.econCoordination?.overlapStages);

  let guidance = "Level timing signal is neutral; prioritize stronger board quality over greedy level curves.";
  if (levelDelta >= 0.4) {
    guidance = `Best finishes align with higher cap timing. Your Top2 games average ${top2Level.toFixed(2)} level vs ${bot2Level.toFixed(2)} in weaker results.`;
  } else if (levelDelta <= -0.3) {
    guidance = "You may be over-greeding levels in losses. Stabilize one board first, then push levels.";
  }
  if (overlapStages.length) {
    guidance += ` Roll overlap detected at ${overlapStages.join(", ")}; stagger ownership to reduce dual all-ins.`;
  }

  return {
    top2Level,
    nonTop2Level: bot2Level,
    levelDelta,
    overlapStages,
    guidance,
  };
}

function buildCoordinationScore(matches, contestedMetaPressure) {
  const sameTeam = matches.filter((match) => match?.sameTeam);
  const splitRows = new Map();
  for (const match of sameTeam) {
    const placement = teamPlacementFromMatch(match);
    const roleA = inferPlayerRole(match, "A");
    const roleB = inferPlayerRole(match, "B");
    const split = `${roleA}-${roleB}`;
    if (!splitRows.has(split)) splitRows.set(split, { total: 0, top2: 0, wins: 0 });
    const row = splitRows.get(split);
    row.total += 1;
    if (placement <= 2) row.top2 += 1;
    if (placement === 1) row.wins += 1;
  }

  const rows = [...splitRows.entries()]
    .map(([split, row]) => ({
      split,
      games: row.total,
      top2Rate: pct(row.top2, row.total),
      winRate: pct(row.wins, row.total),
      score: pct(row.top2, row.total) * 0.7 + pct(row.wins, row.total) * 0.3,
    }))
    .sort((a, b) => b.score - a.score);

  const best = rows[0] || null;
  const coordinationScore = clamp(best ? best.score : 50);
  const recommendation = best
    ? `Pre-game role call: run ${best.split.replace("-", " / ")} split first.`
    : "Insufficient same-team sample to lock role split. Start with one tempo and one econ role.";
  const pressureAdjustment = contestedMetaPressure.score >= 60
    ? "High contested meta: prioritize low-overlap frontline/backline split."
    : "Contested pressure is moderate: comfort split is acceptable.";

  return {
    score: coordinationScore,
    bestSplit: best,
    recommendation: `${recommendation} ${pressureAdjustment}`,
    candidates: rows.slice(0, 3),
  };
}

function buildWildCorrelations(sortedMatches, kpis) {
  const placements = sortedMatches.map((match) => teamPlacementFromMatch(match));
  const avgPlace = avg(placements);
  const top2 = pct(placements.filter((value) => value <= 2).length, placements.length);
  const win = pct(placements.filter((value) => value <= 1).length, placements.length);

  const byHour = {};
  for (const match of sortedMatches) {
    const epoch = toEpochMs(match?.gameDatetime);
    if (!epoch) continue;
    const date = new Date(epoch);
    const dow = date.getDay();
    const hour = date.getHours();
    const key = `${dow}-${hour}`;
    if (!byHour[key]) byHour[key] = { total: 0, top2: 0 };
    byHour[key].total += 1;
    if (teamPlacementFromMatch(match) <= 2) byHour[key].top2 += 1;
  }
  const hottest = Object.entries(byHour)
    .filter(([, row]) => row.total >= 2)
    .map(([key, row]) => ({
      key,
      rate: pct(row.top2, row.total),
      total: row.total,
    }))
    .sort((a, b) => b.rate - a.rate)[0];
  const cursed = Object.entries(byHour)
    .filter(([, row]) => row.total >= 2)
    .map(([key, row]) => ({
      key,
      rate: pct(row.top2, row.total),
      total: row.total,
    }))
    .sort((a, b) => a.rate - b.rate)[0];

  const weirdTemplates = [
    `Mercury retrograde clearly boosted Top2 by ${Math.max(1, Math.round(top2 / 7))}% this filter.`,
    `Your reroll odds improved when pretending to pivot (${Math.max(3, Math.round(100 - avgPlace * 20))}% confidence).`,
    `Cosmic LP pressure reading: ${Math.round((win * 0.9) + 17)}. Definitely scientific.`,
    `Patch vibes index says your duo is ${avgPlace <= 2.7 ? "blessed" : "questionable"} after 10pm queueing.`,
  ];
  const randomTake = weirdTemplates[placements.length % weirdTemplates.length];

  return {
    disclaimer: "For entertainment only. Correlation does not imply causation.",
    cosmicHeadline: `Today's Totally Scientific Conclusion: ${randomTake}`,
    stats: {
      avgPlace,
      top2Rate: top2,
      winRate: win,
      sample: placements.length,
    },
    cursedWindow: cursed,
    blessedWindow: hottest,
    generatorTemplates: weirdTemplates,
    methodChoices: ["Extremely Serious Regression(TM)", "Vibes-based inference", "Two data points and a dream"],
    fallbackCards: [
      {
        title: "Market Mood Diff",
        body: sentence("On imaginary green-market days, your top2 rate is", top2 + 6, "%"),
        confidence: 17,
      },
      {
        title: "Moonlight Pivot Buff",
        body: sentence("Full moon queues allegedly improved average placement by", Math.max(0.1, (3.8 - avgPlace)), ""),
        confidence: 11,
      },
      {
        title: "Coffee Aggro Coefficient",
        body: `Caffeine level 4/5 appears to increase winrate by ${Math.max(2, Math.round(win / 4))}% (placebo-enhanced).`,
        confidence: 14,
      },
    ],
    kpiSnapshot: kpis,
  };
}

export function buildCoachingIntel({
  filteredMatches = [],
  scorecard = null,
  computed = null,
  kpis = null,
} = {}) {
  const sorted = [...asArray(filteredMatches)].sort((a, b) => toEpochMs(a?.gameDatetime) - toEpochMs(b?.gameDatetime));
  const metaTraitSet = new Set(asArray(computed?.metaTraits).slice(0, 6).map((trait) => normalizeToken(trait?.name)));

  const tilt = buildTiltAndStreak(sorted, scorecard);
  const fingerprints = {
    playerA: buildPlayerFingerprint(sorted, "A", metaTraitSet),
    playerB: buildPlayerFingerprint(sorted, "B", metaTraitSet),
    duo: buildDuoFingerprint(sorted),
  };
  const winConditions = buildWinConditionMiner(sorted);
  const lossAutopsy = buildLossAutopsy(sorted);
  const contestedMetaPressure = buildContestedMetaPressure(sorted, computed);
  const timingCoach = buildTimingCoach(sorted, scorecard);
  const coordination = buildCoordinationScore(sorted, contestedMetaPressure);
  const wild = buildWildCorrelations(sorted, kpis);

  return {
    tilt,
    fingerprints,
    winConditions,
    lossAutopsy,
    contestedMetaPressure,
    timingCoach,
    coordination,
    wild,
  };
}

