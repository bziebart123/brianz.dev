import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WildCorrelationsTab from "./WildCorrelationsTab";

const coachingIntel = {
  wild: {
    disclaimer: "For entertainment only.",
    cosmicHeadline: "Today's Totally Scientific Conclusion: Initial take.",
    stats: { sample: 12, avgPlace: 2.8, top2Rate: 45, winRate: 18 },
    cursedWindow: { key: "2-23", rate: 18 },
    blessedWindow: { key: "6-21", rate: 64 },
    methodChoices: ["Method A", "Method B"],
    generatorTemplates: ["Generated nonsense take."],
    fallbackCards: [
      { title: "Market Mood Diff", body: "Fake alpha", confidence: 12 },
    ],
  },
};

describe("WildCorrelationsTab", () => {
  it("renders disclaimer and supports generation controls", () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    render(
      <WildCorrelationsTab
        coachingIntel={coachingIntel}
        timelineDays="30"
        setFilter="16"
        patchFilter="16.4"
      />
    );

    expect(screen.getByText("Wild Correlations")).toBeInTheDocument();
    expect(screen.getByText("For entertainment only.")).toBeInTheDocument();
    expect(screen.getByText("Today's Totally Scientific Conclusion")).toBeInTheDocument();
    expect(screen.getByText("Cursed Hours")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Generate New Totally Scientific Take"));
    expect(screen.getByText(/Generated nonsense take/i)).toBeInTheDocument();

    randomSpy.mockRestore();
  });
});

