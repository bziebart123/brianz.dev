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
      goldLeft: goldA,
      traits: [{ name: traitA, style: 3 }],
      units: [{ characterId: "TFT16_Ahri" }],
    },
    playerB: {
      placement: placementB,
      partnerGroupId: 1,
      level: levelB,
      totalDamageToPlayers: damageB,
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
      makeMatch({ id: "m1", placementA: 1, placementB: 2, gameDatetime: Date.UTC(2026, 1, 1) }),
      makeMatch({ id: "m2", placementA: 1, placementB: 2, gameDatetime: Date.UTC(2026, 1, 2) }),
      makeMatch({ id: "m3", placementA: 2, placementB: 3, gameDatetime: Date.UTC(2026, 1, 3) }),
      makeMatch({ id: "m4", placementA: 6, placementB: 7, levelA: 7, levelB: 7, damageA: 30, damageB: 25, gameDatetime: Date.UTC(2026, 1, 4) }),
      makeMatch({ id: "m5", placementA: 7, placementB: 8, levelA: 7, levelB: 7, damageA: 25, damageB: 20, gameDatetime: Date.UTC(2026, 1, 5) }),
      makeMatch({ id: "m6", placementA: 6, placementB: 7, levelA: 7, levelB: 7, damageA: 22, damageB: 21, gameDatetime: Date.UTC(2026, 1, 6) }),
      makeMatch({ id: "m7", placementA: 6, placementB: 8, levelA: 7, levelB: 7, damageA: 24, damageB: 22, gameDatetime: Date.UTC(2026, 1, 7) }),
      makeMatch({ id: "m8", placementA: 7, placementB: 8, levelA: 7, levelB: 6, damageA: 20, damageB: 20, gameDatetime: Date.UTC(2026, 1, 8) }),
      makeMatch({ id: "m9", placementA: 8, placementB: 8, levelA: 6, levelB: 6, damageA: 18, damageB: 18, gameDatetime: Date.UTC(2026, 1, 9) }),
      makeMatch({ id: "m10", placementA: 7, placementB: 8, levelA: 7, levelB: 6, damageA: 19, damageB: 19, gameDatetime: Date.UTC(2026, 1, 10) }),
      makeMatch({ id: "m11", placementA: 8, placementB: 8, levelA: 6, levelB: 6, damageA: 17, damageB: 17, gameDatetime: Date.UTC(2026, 1, 11) }),
      makeMatch({ id: "m12", placementA: 7, placementB: 8, levelA: 7, levelB: 6, damageA: 21, damageB: 19, gameDatetime: Date.UTC(2026, 1, 12) }),
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
    expect(intel.contestedMetaPressure.score).toBeGreaterThanOrEqual(0);
    expect(intel.timingCoach.guidance).toContain("Roll overlap");
    expect(intel.coordination.candidates.length).toBeGreaterThan(0);
    expect(intel.wild.fallbackCards.length).toBe(3);
  });
});

