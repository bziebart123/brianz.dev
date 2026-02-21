import { describe, expect, it } from "vitest";
import {
  estimatedLpDeltaFromTeamPlacement,
  summarizeFromMatches,
  teamPlacementFromMatch,
} from "./tft";

function makeMatch({
  id,
  placementA = 2,
  placementB = 3,
  sameTeam = true,
  groupA = 1,
  groupB = 1,
  traitsA = [{ name: "TFT16_Ionia", style: 3 }],
  traitsB = [{ name: "TFT16_Sorcerer", style: 2 }],
  unitsA = [{ characterId: "TFT16_Ahri" }],
  unitsB = [{ characterId: "TFT16_Taric" }],
  gameDatetime = Date.UTC(2026, 1, 1, 18, 0, 0),
} = {}) {
  return {
    id: id || `MATCH_${Math.random()}`,
    sameTeam,
    setNumber: 16,
    patch: "16.4",
    gameDatetime,
    playerA: {
      placement: placementA,
      partnerGroupId: groupA,
      level: 8,
      totalDamageToPlayers: 50,
      traits: traitsA,
      units: unitsA,
    },
    playerB: {
      placement: placementB,
      partnerGroupId: groupB,
      level: 8,
      totalDamageToPlayers: 45,
      traits: traitsB,
      units: unitsB,
    },
    lobby: [
      { partnerGroupId: 1, placement: 1, traits: traitsA, units: unitsA },
      { partnerGroupId: 1, placement: 2, traits: traitsB, units: unitsB },
      { partnerGroupId: 2, placement: 3, traits: traitsA, units: unitsA },
      { partnerGroupId: 2, placement: 4, traits: traitsB, units: unitsB },
      { partnerGroupId: 3, placement: 5, traits: traitsA, units: unitsA },
      { partnerGroupId: 3, placement: 6, traits: traitsB, units: unitsB },
      { partnerGroupId: 4, placement: 7, traits: traitsA, units: unitsA },
      { partnerGroupId: 4, placement: 8, traits: traitsB, units: unitsB },
    ],
  };
}

describe("tft utils", () => {
  it("maps team placement to expected LP deltas", () => {
    expect(estimatedLpDeltaFromTeamPlacement(1)).toBe(35);
    expect(estimatedLpDeltaFromTeamPlacement(2)).toBe(20);
    expect(estimatedLpDeltaFromTeamPlacement(3)).toBe(-15);
    expect(estimatedLpDeltaFromTeamPlacement(4)).toBe(-30);
  });

  it("derives team placement from partner groups when lobby data exists", () => {
    const match = makeMatch({ placementA: 2, placementB: 4, groupA: 2, groupB: 2 });
    expect(teamPlacementFromMatch(match)).toBe(2);
  });

  it("falls back to grouped same-team placement when lobby partner groups do not match", () => {
    const match = makeMatch({
      placementA: 6,
      placementB: 7,
      groupA: 1,
      groupB: 2,
      sameTeam: true,
      lobby: [],
    });
    expect(teamPlacementFromMatch(match)).toBe(4);
  });

  it("summarizes KPIs and meta counts from matches", () => {
    const matches = [
      makeMatch({ id: "m1", placementA: 1, placementB: 2 }),
      makeMatch({ id: "m2", placementA: 3, placementB: 4 }),
      makeMatch({ id: "m3", placementA: 2, placementB: 3 }),
    ];

    const summary = summarizeFromMatches(matches);
    expect(summary.kpis.gamesTogether).toBe(3);
    expect(summary.kpis.teamTop2Rate).toBeGreaterThan(0);
    expect(summary.kpis.teamWinRate).toBeGreaterThanOrEqual(0);
    expect(summary.metaTraits.length).toBeGreaterThan(0);
    expect(summary.metaUnits.length).toBeGreaterThan(0);
  });
});

