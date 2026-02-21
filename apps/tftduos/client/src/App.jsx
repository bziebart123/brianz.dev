import { Pane } from "evergreen-ui";
import { TEXT_SCALE } from "./config/constants";
import Sidebar from "./components/Sidebar";
import AnalysisTab from "./components/tabs/AnalysisTab";
import CoachingTab from "./components/tabs/CoachingTab";
import HistoryTab from "./components/tabs/HistoryTab";
import useDuoAnalysis from "./hooks/useDuoAnalysis";

export default function App() {
  const state = useDuoAnalysis();

  return (
    <Pane className="tft-app-shell" display="flex" minHeight="100vh" style={{ "--bz-text-scale": String(TEXT_SCALE) }}>
      <Sidebar
        activeTab={state.activeTab}
        setActiveTab={state.setActiveTab}
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

      <Pane flex={1} padding={30}>
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
            <AnalysisTab kpis={state.kpis} computed={state.computed} iconManifest={state.iconManifest} />
          ) : null}

          {state.payload && state.activeTab === "coaching" ? (
            <CoachingTab
              duoRisk={state.duoRisk}
              decisionGrade={state.decisionGrade}
              leakCount={state.leakCount}
              rescueRate={state.rescueRate}
              clutchIndex={state.clutchIndex}
              filteredMatches={state.filteredMatches}
              placementTrend={state.placementTrend}
              totalPressureA={state.totalPressureA}
              totalPressureB={state.totalPressureB}
              lowGoldLossA={state.lowGoldLossA}
              lowGoldLossB={state.lowGoldLossB}
              lowDamageLossA={state.lowDamageLossA}
              lowDamageLossB={state.lowDamageLossB}
              suggestionCards={state.suggestionCards}
              scorecard={state.scorecard}
              coachingBranches={state.coachingBranches}
              giftMetrics={state.giftMetrics}
              staggerSuggestions={state.staggerSuggestions}
              openerCards={state.openerCards}
              iconManifest={state.iconManifest}
              payload={state.payload}
              coachingInsights={state.coachingInsights}
              highlights={state.highlights}
              coachMatchId={state.coachMatchId}
              setCoachMatchId={state.setCoachMatchId}
              planAt32={state.planAt32}
              setPlanAt32={state.setPlanAt32}
              executedPlan={state.executedPlan}
              setExecutedPlan={state.setExecutedPlan}
              tagPanicRoll={state.tagPanicRoll}
              setTagPanicRoll={state.setTagPanicRoll}
              tagMissedGift={state.tagMissedGift}
              setTagMissedGift={state.setTagMissedGift}
              tagBothRoll={state.tagBothRoll}
              setTagBothRoll={state.setTagBothRoll}
              submitJournal={state.submitJournal}
              duoId={state.duoId}
              coachSaving={state.coachSaving}
              quickStage={state.quickStage}
              setQuickStage={state.setQuickStage}
              quickActor={state.quickActor}
              setQuickActor={state.setQuickActor}
              submitQuickEvent={state.submitQuickEvent}
              coachMessage={state.coachMessage}
            />
          ) : null}
        </Pane>
      </Pane>
    </Pane>
  );
}

