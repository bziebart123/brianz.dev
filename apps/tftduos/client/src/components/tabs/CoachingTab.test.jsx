import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CoachingTab from "./CoachingTab";

vi.mock("../IconWithLabel", () => ({
  default: ({ label }) => <div>{label}</div>,
}));

vi.mock("../MetricBar", () => ({
  default: ({ label }) => <div>{label}</div>,
}));

vi.mock("../Sparkline", () => ({
  default: () => <div>Sparkline</div>,
}));

const baseProps = {
  duoRisk: 72,
  decisionGrade: 48,
  leakCount: 3,
  rescueRate: 8,
  clutchIndex: 11,
  filteredMatches: [
    { id: "m1", gameDatetime: Date.UTC(2026, 1, 1), setNumber: 16, patch: "16.4" },
  ],
  placementTrend: [1, 2, 3, 4, 3, 4],
  totalPressureA: 5,
  totalPressureB: 2,
  lowGoldLossA: 3,
  lowGoldLossB: 1,
  lowDamageLossA: 2,
  lowDamageLossB: 1,
  suggestionCards: [{ id: "s1", title: "Leak A", why: "because", fix: "do x", icon: "issue" }],
  scorecard: {
    sampleSize: { eventCount: 8 },
    coachingReplay: { stage2: "S2", stage3: "S3", stage4: "S4" },
  },
  coachingBranches: ["If X then Y"],
  giftMetrics: { giftROI: 20, itemGiftRate: 40, benchWasteRate: 25 },
  staggerSuggestions: ["A rolls 3-2, B rolls 4-1"],
  openerCards: [],
  iconManifest: { traits: {}, augments: {} },
  payload: { players: { a: {}, b: {} } },
  coachingInsights: { topItemsA: [["item_a", 4]], topItemsB: [["item_b", 3]] },
  highlights: ["Top2 spike"],
  coachMatchId: "m1",
  setCoachMatchId: vi.fn(),
  planAt32: "",
  setPlanAt32: vi.fn(),
  executedPlan: "",
  setExecutedPlan: vi.fn(),
  tagPanicRoll: false,
  setTagPanicRoll: vi.fn(),
  tagMissedGift: false,
  setTagMissedGift: vi.fn(),
  tagBothRoll: false,
  setTagBothRoll: vi.fn(),
  submitJournal: vi.fn(),
  duoId: "duo_1",
  coachSaving: false,
  quickStage: "4.1",
  setQuickStage: vi.fn(),
  quickActor: "A",
  setQuickActor: vi.fn(),
  submitQuickEvent: vi.fn(),
  coachMessage: "",
  aiCoaching: {
    model: "gpt-4o-mini",
    fallback: false,
    brief: {
      headline: "AI brief",
      summary: "Summary",
      teamPlan: ["Plan A"],
      playerPlans: [{ player: "Seb", focus: "Tempo", actions: ["Action"] }],
      confidence: "medium",
    },
  },
  aiCoachingLoading: false,
  aiCoachingError: "",
  loadAiCoaching: vi.fn(),
  coachingIntel: {
    tilt: { inTiltWindow: true, tiltScore: 72, recentAvg: 3.4, priorAvg: 2.1, currentBadStreak: 3, resetRule: "Pause and reset" },
    fingerprints: {
      playerA: { labels: ["Tempo Pusher"] },
      playerB: { labels: ["Pivot Specialist"] },
      duo: { labels: ["Role-Split Duo"] },
    },
    winConditions: { conditions: [{ title: "Tempo + Econ Split", detail: "Top2 rises" }] },
    lossAutopsy: [{ matchId: "m1", placement: 4, confidence: 80, factors: [{ reason: "Low cap" }] }],
    contestedMetaPressure: { score: 68, recommendation: "Pivot early." },
    timingCoach: { top2Level: 8.5, nonTop2Level: 7.8, guidance: "Hit 8 sooner." },
    coordination: {
      score: 74,
      recommendation: "Run tempo/econ split.",
      candidates: [{ split: "tempo-econ", top2Rate: 60, winRate: 18, games: 6 }],
    },
  },
};

describe("CoachingTab", () => {
  it("renders new coaching intelligence sections", () => {
    render(<CoachingTab {...baseProps} />);

    expect(screen.getByText("Duo Coaching Command Center")).toBeInTheDocument();
    expect(screen.getByText("AI Coach Brief")).toBeInTheDocument();
    expect(screen.getByText("Tilt Window Detected")).toBeInTheDocument();
    expect(screen.getByText("Playstyle Fingerprints")).toBeInTheDocument();
    expect(screen.getByText("Win Condition Miner")).toBeInTheDocument();
    expect(screen.getByText("Contested Meta Pressure")).toBeInTheDocument();
    expect(screen.getByText("Timing Coach")).toBeInTheDocument();
    expect(screen.getByText("Duo Coordination Score")).toBeInTheDocument();
    expect(screen.getByText("Loss Autopsy (Worst 3)")).toBeInTheDocument();
  });
});

