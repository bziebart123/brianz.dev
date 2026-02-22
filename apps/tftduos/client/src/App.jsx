import { Pane, Text } from "evergreen-ui";
import { useEffect, useMemo, useState } from "react";
import { TEXT_SCALE, VIEW_TABS } from "./config/constants";
import Sidebar from "./components/Sidebar";
import AnalysisTab from "./components/tabs/AnalysisTab";
import CoachingTab from "./components/tabs/CoachingTab";
import HistoryTab from "./components/tabs/HistoryTab";
import WildCorrelationsTab from "./components/tabs/WildCorrelationsTab";
import useDuoAnalysis from "./hooks/useDuoAnalysis";

export default function App() {
  const state = useDuoAnalysis();
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 1024);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const viewTabs = useMemo(() => {
    const base = [...VIEW_TABS];
    if (state.enableWildCorrelations) base.push({ id: "wild", label: "Wild Correlations" });
    return base;
  }, [state.enableWildCorrelations]);

  useEffect(() => {
    function handleResize() {
      const mobile = window.innerWidth <= 1024;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(false);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <Pane
      className={`tft-app-shell${isMobile ? " is-mobile" : ""}${sidebarOpen ? " sidebar-open" : ""}`}
      display="flex"
      minHeight="100vh"
      style={{ "--bz-text-scale": String(TEXT_SCALE) }}
    >
      {isMobile ? (
        <Pane className="tft-sidebar-overlay" aria-hidden={!sidebarOpen} onClick={() => setSidebarOpen(false)} />
      ) : null}

      <Sidebar
        isMobile={isMobile}
        onRequestClose={() => setSidebarOpen(false)}
        viewTabs={viewTabs}
        activeTab={state.activeTab}
        setActiveTab={state.setActiveTab}
        enableWildCorrelations={state.enableWildCorrelations}
        setEnableWildCorrelations={state.setEnableWildCorrelations}
        payload={state.payload}
        timelineDays={state.timelineDays}
        setTimelineDays={state.setTimelineDays}
        setFilter={state.setFilter}
        setSetFilter={state.setSetFilter}
        patchFilter={state.patchFilter}
        setPatchFilter={state.setPatchFilter}
        currentPatch={state.currentPatch}
        availableSets={state.availableSets}
        availablePatches={state.availablePatches}
        matches={state.matches}
        filteredMatches={state.filteredMatches}
        loading={state.loading}
        loadDuoAnalysis={state.loadDuoAnalysis}
        displayedError={state.displayedError}
      />

      <Pane className="tft-main-content" flex={1} padding={30}>
        {isMobile ? (
          <Pane className="tft-mobile-topbar">
            <button type="button" className="tft-mobile-filter-btn" onClick={() => setSidebarOpen(true)}>
              Filters
            </button>
            <Text size={500}>Duo TFT Coach</Text>
          </Pane>
        ) : null}

        <Pane maxWidth={1180} marginX="auto" display="grid" gap={18}>
          {state.payload && state.activeTab === "history" ? (
            <HistoryTab
              payload={state.payload}
              latestMatchForBanner={state.latestMatchForBanner}
              kpis={state.kpis}
              recentTeamPlacements={state.recentTeamPlacements}
              hasFilteredMatches={state.hasFilteredMatches}
              matches={state.matches}
              filteredMatches={state.filteredMatches}
              iconManifest={state.iconManifest}
              companionManifest={state.companionManifest}
            />
          ) : null}

          {state.payload && state.activeTab === "analysis" ? (
            <AnalysisTab
              kpis={state.kpis}
              computed={state.computed}
              iconManifest={state.iconManifest}
              companionManifest={state.companionManifest}
              filteredMatches={state.filteredMatches}
              scorecard={state.scorecard}
              coachingInsights={state.coachingInsights}
            />
          ) : null}

          {state.payload && state.activeTab === "coaching" ? (
            <CoachingTab
              duoRisk={state.duoRisk}
              decisionGrade={state.decisionGrade}
              rescueRate={state.rescueRate}
              clutchIndex={state.clutchIndex}
              placementTrend={state.placementTrend}
              totalPressureA={state.totalPressureA}
              totalPressureB={state.totalPressureB}
              lowGoldLossA={state.lowGoldLossA}
              lowGoldLossB={state.lowGoldLossB}
              lowDamageLossA={state.lowDamageLossA}
              lowDamageLossB={state.lowDamageLossB}
              aiCoaching={state.aiCoaching}
              aiCoachingLoading={state.aiCoachingLoading}
              aiCoachingError={state.aiCoachingError}
              loadAiCoaching={state.loadAiCoaching}
              filteredMatches={state.filteredMatches}
              iconManifest={state.iconManifest}
            />
          ) : null}

          {state.payload && state.activeTab === "wild" && state.enableWildCorrelations ? (
            <WildCorrelationsTab
              coachingIntel={state.coachingIntel}
              timelineDays={state.timelineDays}
              setFilter={state.setFilter}
              patchFilter={state.patchFilter}
            />
          ) : null}
        </Pane>
      </Pane>
    </Pane>
  );
}
