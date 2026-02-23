import { describe, expect, it } from "vitest";
import { buildCoachingIntel } from "./coachingIntel";

function makeMatch({
  id,
  placementA,
  placementB,
  levelA = 8,
  levelB = 8,
  damageA = 55,
  damageB = 45,
  goldA = 5,
  goldB = 12,
  traitA = "TFT16_Ionia",
  traitB = "TFT16_Sorcerer",
  sameTeam = true,
  gameDatetime,
  elimsA = 2,
  elimsB = 2,
  timeEliminatedA = 1500,
  timeEliminatedB = 1560,
} = {}) {
  return {
    id,
    sameTeam,
    setNumber: 16,
    patch: "16.4",
    gameDatetime,
    playerA: {
      placement: placementA,
      partnerGroupId: 1,
      level: levelA,
      totalDamageToPlayers: damageA,
      playersEliminated: elimsA,
      timeEliminated: timeEliminatedA,
      goldLeft: goldA,
      traits: [{ name: traitA, style: 3 }],
      units: [{ characterId: "TFT16_Ahri" }],
    },
    playerB: {
      placement: placementB,
      partnerGroupId: 1,
      level: levelB,
      totalDamageToPlayers: damageB,
      playersEliminated: elimsB,
      timeEliminated: timeEliminatedB,
      goldLeft: goldB,
      traits: [{ name: traitB, style: 2 }],
      units: [{ characterId: "TFT16_Taric" }],
    },
    lobby: [],
  };
}

describe("buildCoachingIntel", () => {
  it("returns the expanded coaching modules", () => {
    const matches = [
      makeMatch({ id: "m1", placementA: 1, placementB: 2, elimsA: 4, elimsB: 3, timeEliminatedA: 1900, timeEliminatedB: 1950, gameDatetime: Date.UTC(2026, 1, 1) }),
      makeMatch({ id: "m2", placementA: 1, placementB: 2, elimsA: 5, elimsB: 3, timeEliminatedA: 1850, timeEliminatedB: 1890, gameDatetime: Date.UTC(2026, 1, 2) }),
      makeMatch({ id: "m3", placementA: 2, placementB: 3, elimsA: 3, elimsB: 2, timeEliminatedA: 1650, timeEliminatedB: 1680, gameDatetime: Date.UTC(2026, 1, 3) }),
      makeMatch({ id: "m4", placementA: 6, placementB: 7, levelA: 7, levelB: 7, damageA: 30, damageB: 25, elimsA: 1, elimsB: 1, timeEliminatedA: 1350, timeEliminatedB: 1380, gameDatetime: Date.UTC(2026, 1, 4) }),
      makeMatch({ id: "m5", placementA: 7, placementB: 8, levelA: 7, levelB: 7, damageA: 25, damageB: 20, elimsA: 0, elimsB: 1, timeEliminatedA: 1180, timeEliminatedB: 1200, gameDatetime: Date.UTC(2026, 1, 5) }),
      makeMatch({ id: "m6", placementA: 6, placementB: 7, levelA: 7, levelB: 7, damageA: 22, damageB: 21, elimsA: 1, elimsB: 1, timeEliminatedA: 1260, timeEliminatedB: 1280, gameDatetime: Date.UTC(2026, 1, 6) }),
      makeMatch({ id: "m7", placementA: 6, placementB: 8, levelA: 7, levelB: 7, damageA: 24, damageB: 22, elimsA: 1, elimsB: 0, timeEliminatedA: 1220, timeEliminatedB: 1240, gameDatetime: Date.UTC(2026, 1, 7) }),
      makeMatch({ id: "m8", placementA: 7, placementB: 8, levelA: 7, levelB: 6, damageA: 20, damageB: 20, elimsA: 0, elimsB: 1, timeEliminatedA: 1120, timeEliminatedB: 1140, gameDatetime: Date.UTC(2026, 1, 8) }),
      makeMatch({ id: "m9", placementA: 8, placementB: 8, levelA: 6, levelB: 6, damageA: 18, damageB: 18, elimsA: 0, elimsB: 0, timeEliminatedA: 1080, timeEliminatedB: 1100, gameDatetime: Date.UTC(2026, 1, 9) }),
      makeMatch({ id: "m10", placementA: 7, placementB: 8, levelA: 7, levelB: 6, damageA: 19, damageB: 19, elimsA: 0, elimsB: 1, timeEliminatedA: 1140, timeEliminatedB: 1160, gameDatetime: Date.UTC(2026, 1, 10) }),
      makeMatch({ id: "m11", placementA: 8, placementB: 8, levelA: 6, levelB: 6, damageA: 17, damageB: 17, elimsA: 0, elimsB: 0, timeEliminatedA: 1020, timeEliminatedB: 1040, gameDatetime: Date.UTC(2026, 1, 11) }),
      makeMatch({ id: "m12", placementA: 7, placementB: 8, levelA: 7, levelB: 6, damageA: 21, damageB: 19, elimsA: 1, elimsB: 0, timeEliminatedA: 1160, timeEliminatedB: 1180, gameDatetime: Date.UTC(2026, 1, 12) }),
    ];
    const computed = {
      metaTraits: [
        { name: "TFT16_Ionia", count: 10 },
        { name: "TFT16_Sorcerer", count: 8 },
      ],
    };
    const scorecard = {
      decisionQuality: { biggestLeaks: [{ leak: "Roll discipline leaks" }] },
      econCoordination: { overlapStages: ["3-2"] },
    };
    const intel = buildCoachingIntel({
      filteredMatches: matches,
      scorecard,
      computed,
      kpis: { teamTop2Rate: 30 },
    });

    expect(intel.tilt).toBeDefined();
    expect(intel.fingerprints.playerA.labels.length).toBeGreaterThan(0);
    expect(intel.fingerprints.duo.labels.length).toBeGreaterThan(0);
    expect(intel.winConditions.conditions.length).toBeGreaterThan(0);
    expect(intel.lossAutopsy).toHaveLength(3);
    expect(intel.derivedMetrics.eliminationTiming.avgExitBucket).toBeDefined();
    expect(intel.derivedMetrics.playersEliminatedTrend.delta).toBeGreaterThan(0);
    expect(intel.derivedMetrics.carryPressureIndex.playerA.avg).toBeGreaterThan(0);
    expect(intel.contestedMetaPressure.score).toBeGreaterThanOrEqual(0);
    expect(intel.timingCoach.guidance).toContain("Roll overlap");
    expect(intel.coordination.candidates.length).toBeGreaterThan(0);
    expect(intel.wild.fallbackCards.length).toBe(3);
  });

  it("supports alternate elimination and elimination-count fields used by older payload snapshots", () => {
    const matches = [
      {
        ...makeMatch({ id: "legacy-1", placementA: 1, placementB: 2, gameDatetime: Date.UTC(2026, 0, 1) }),
        playerA: {
          placement: 1,
          totalDamageToPlayers: 90,
          playerEliminations: 4,
          eliminationTimestamp: 1860000,
          traits: [{ name: "TFT16_Ionia", style: 3 }],
          units: [{ characterId: "TFT16_Ahri" }],
        },
        playerB: {
          placement: 2,
          totalDamageToPlayers: 60,
          playersEliminated: 2,
          eliminatedAt: 1800000,
          traits: [{ name: "TFT16_Sorcerer", style: 2 }],
          units: [{ characterId: "TFT16_Taric" }],
        },
      },
      {
        ...makeMatch({ id: "legacy-2", placementA: 7, placementB: 8, gameDatetime: Date.UTC(2026, 0, 2) }),
        playerA: {
          placement: 7,
          totalDamageToPlayers: 20,
          playerEliminations: 0,
          timeEliminatedSeconds: 1100,
          traits: [{ name: "TFT16_Ionia", style: 2 }],
          units: [{ characterId: "TFT16_Ahri" }],
        },
        playerB: {
          placement: 8,
          totalDamageToPlayers: 15,
          playersEliminated: 1,
          eliminationTime: 1140,
          traits: [{ name: "TFT16_Sorcerer", style: 2 }],
          units: [{ characterId: "TFT16_Taric" }],
        },
      },
    ];

    const intel = buildCoachingIntel({
      filteredMatches: matches,
      scorecard: { decisionQuality: { biggestLeaks: [] }, econCoordination: { overlapStages: [] } },
      computed: { metaTraits: [] },
      kpis: { teamTop2Rate: 50 },
    });

    expect(intel.derivedMetrics.playersEliminatedTrend.winAvg).toBe(6);
    expect(intel.derivedMetrics.eliminationTiming.bucketRates.late).toBeGreaterThan(0);
    expect(intel.derivedMetrics.carryPressureIndex.playerA.avg).toBeGreaterThan(0);
  });
});
