import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseDuoAnalysis = vi.fn();

vi.mock("./hooks/useDuoAnalysis", () => ({
  default: () => mockUseDuoAnalysis(),
}));

vi.mock("./components/Sidebar", () => ({
  default: ({ viewTabs }) => (
    <div>
      Sidebar
      {viewTabs.map((tab) => (
        <span key={tab.id}>{tab.label}</span>
      ))}
    </div>
  ),
}));

vi.mock("./components/tabs/HistoryTab", () => ({ default: () => <div>History Panel</div> }));
vi.mock("./components/tabs/AnalysisTab", () => ({ default: () => <div>Analysis Panel</div> }));
vi.mock("./components/tabs/CoachingTab", () => ({ default: () => <div>Coaching Panel</div> }));
vi.mock("./components/tabs/WildCorrelationsTab", () => ({ default: () => <div>Wild Panel</div> }));

import App from "./App";

function makeState(overrides = {}) {
  return {
    activeTab: "history",
    setActiveTab: vi.fn(),
    enableWildCorrelations: false,
    setEnableWildCorrelations: vi.fn(),
    payload: { players: { a: {}, b: {} } },
    timelineDays: "30",
    setTimelineDays: vi.fn(),
    setFilter: "all",
    setSetFilter: vi.fn(),
    patchFilter: "16.4",
    setPatchFilter: vi.fn(),
    currentPatch: "16.4",
    availableSets: [16],
    availablePatches: ["16.4"],
    matches: [],
    filteredMatches: [],
    loading: false,
    loadDuoAnalysis: vi.fn(),
    displayedError: "",
    latestMatchForBanner: null,
    kpis: {},
    recentTeamPlacements: [],
    hasFilteredMatches: false,
    iconManifest: { traits: {}, augments: {} },
    companionManifest: { byItemId: {}, byContentId: {} },
    computed: {},
    scorecard: {},
    coachingInsights: {},
    rankContext: null,
    duoRisk: 0,
    decisionGrade: 0,
    rescueRate: 0,
    clutchIndex: 0,
    placementTrend: [],
    totalPressureA: 0,
    totalPressureB: 0,
    lowGoldLossA: 0,
    lowGoldLossB: 0,
    lowDamageLossA: 0,
    lowDamageLossB: 0,
    aiCoaching: null,
    aiCoachingLoading: false,
    aiCoachingError: "",
    loadAiCoaching: vi.fn(),
    coachingIntel: {},
    ...overrides,
  };
}

describe("App", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
  });

  it("renders the active history tab", () => {
    mockUseDuoAnalysis.mockReturnValue(makeState({ activeTab: "history" }));
    render(<App />);

    expect(screen.getByText("History Panel")).toBeInTheDocument();
    expect(screen.queryByText("Analysis Panel")).not.toBeInTheDocument();
    expect(screen.getByText("Sidebar")).toBeInTheDocument();
  });

  it("adds and renders wild correlations tab when enabled", () => {
    mockUseDuoAnalysis.mockReturnValue(makeState({ activeTab: "wild", enableWildCorrelations: true }));
    render(<App />);

    expect(screen.getByText("Wild Correlations")).toBeInTheDocument();
    expect(screen.getByText("Wild Panel")).toBeInTheDocument();
  });

  it("does not render wild correlations panel when feature toggle is disabled", () => {
    mockUseDuoAnalysis.mockReturnValue(makeState({ activeTab: "wild", enableWildCorrelations: false }));
    render(<App />);

    expect(screen.queryByText("Sidebar")).toBeInTheDocument();
    expect(screen.queryByText("Wild Panel")).not.toBeInTheDocument();
  });
});
