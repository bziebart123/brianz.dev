import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CoachingTab from "./CoachingTab";

const baseProps = {
  duoRisk: 72,
  decisionGrade: 48,
  rescueRate: 8,
  clutchIndex: 11,
  placementTrend: [1, 2, 3, 4, 3, 4],
  totalPressureA: 5,
  totalPressureB: 2,
  lowGoldLossA: 3,
  lowGoldLossB: 1,
  lowDamageLossA: 2,
  lowDamageLossB: 1,
  aiCoaching: {
    model: "gpt-4o-mini",
    fallback: true,
    brief: {
      headline: "AI brief",
      summary: "Summary",
      teamPlan: ["Plan A"],
      playerPlans: [{ player: "Seb", focus: "Tempo", actions: ["Action"] }],
      metaDelta: ["Delta A"],
      topImprovementAreas: ["Improve A"],
      winConditions: ["WinCon A"],
      fiveGamePlan: ["Step 1"],
      championBuilds: [{ player: "Seb", champion: "tft16_garen", items: ["item_a"], games: 3, top2Rate: 66.7, note: "Strong" }],
      confidence: "medium",
      sources: ["local"],
    },
  },
  aiCoachingLoading: false,
  aiCoachingError: "",
  loadAiCoaching: vi.fn(),
};

describe("CoachingTab", () => {
  it("renders AI-first coaching layout", () => {
    render(<CoachingTab {...baseProps} />);

    expect(screen.getByText("Duo Coaching")).toBeInTheDocument();
    expect(screen.getByText("AI Coach Brief")).toBeInTheDocument();
    expect(screen.getByText("Individual Action Plans")).toBeInTheDocument();
    expect(screen.getByText("Meta vs Your Builds")).toBeInTheDocument();
    expect(screen.getByText("Top Improvement Areas")).toBeInTheDocument();
    expect(screen.getByText("Win Conditions")).toBeInTheDocument();
    expect(screen.getByText("Next 5 Games Plan")).toBeInTheDocument();
    expect(screen.getByText("Champion Build Signals")).toBeInTheDocument();
  });

  it("shows full-page loading state while AI brief is pending", () => {
    render(<CoachingTab {...baseProps} aiCoaching={null} aiCoachingLoading />);
    expect(screen.getByText("Generating AI coaching...")).toBeInTheDocument();
    expect(screen.getByText("Loading the full coaching page once GPT analysis is ready.")).toBeInTheDocument();
  });
});

