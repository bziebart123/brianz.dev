import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HistoryTab from "./HistoryTab";

vi.mock("../PlayerBannerCard", () => ({
  default: ({ riotName, tagLine }) => <div>{`Banner ${riotName}#${tagLine}`}</div>,
}));

vi.mock("../StatCard", () => ({
  default: ({ label, value }) => <div>{`${label}: ${value}`}</div>,
}));

vi.mock("../IconWithLabel", () => ({
  default: ({ label }) => <div>{label}</div>,
}));

const baseMatch = {
  id: "MATCH_1",
  sameTeam: true,
  setNumber: 16,
  patch: "16.4",
  gameDatetime: Date.UTC(2026, 1, 20, 18, 20, 0),
  playerA: {
    placement: 1,
    partnerGroupId: 1,
    level: 9,
    totalDamageToPlayers: 72,
    traits: [{ name: "TFT16_Ionia", style: 4 }],
    units: [
      { characterId: "TFT16_Ahri", tier: 2 },
      { characterId: "TFT16_Shen", tier: 1 },
    ],
  },
  playerB: {
    placement: 2,
    partnerGroupId: 1,
    level: 8,
    totalDamageToPlayers: 55,
    traits: [{ name: "TFT16_Sorcerer", style: 2 }],
    units: [{ characterId: "TFT16_Taric", tier: 3 }],
  },
  lobby: [
    { partnerGroupId: 1, placement: 1 },
    { partnerGroupId: 1, placement: 2 },
    { partnerGroupId: 2, placement: 3 },
    { partnerGroupId: 2, placement: 4 },
    { partnerGroupId: 3, placement: 5 },
    { partnerGroupId: 3, placement: 6 },
    { partnerGroupId: 4, placement: 7 },
    { partnerGroupId: 4, placement: 8 },
  ],
};

const props = {
  payload: {
    players: {
      a: { gameName: "SebbenandSebben", tagLine: "NA1", rank: "Master" },
      b: { gameName: "Answer", tagLine: "FIRM", rank: "Master" },
    },
  },
  latestMatchForBanner: baseMatch,
  kpis: {
    gamesTogether: 1,
    avgTeamPlacement: 1.0,
    teamTop2Rate: 100,
    teamWinRate: 100,
  },
  recentTeamPlacements: [1],
  hasFilteredMatches: true,
  matches: [baseMatch],
  filteredMatches: [baseMatch],
  iconManifest: { traits: {}, augments: {} },
  companionManifest: { byItemId: {}, byContentId: {} },
};

describe("HistoryTab", () => {
  it("renders match history heading and all board slots", () => {
    render(<HistoryTab {...props} />);

    expect(screen.getByText("Match History")).toBeInTheDocument();
    expect(screen.getByText("Team #1")).toBeInTheDocument();
    expect(screen.getByText("LP +35")).toBeInTheDocument();
    expect(screen.getAllByTestId("a-board-slot")).toHaveLength(10);
    expect(screen.getAllByTestId("b-board-slot")).toHaveLength(10);
  });

  it("shows filled stars only for existing units", () => {
    render(<HistoryTab {...props} />);
    expect(screen.getAllByText("**").length).toBeGreaterThan(0);
    expect(screen.getAllByText("*").length).toBeGreaterThan(0);
    expect(screen.getAllByText("***").length).toBeGreaterThan(0);
  });
});

