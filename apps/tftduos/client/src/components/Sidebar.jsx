import {
  Button,
  Card,
  Checkbox,
  Heading,
  Pane,
  Select,
  Spinner,
  Strong,
  Tab,
  Tablist,
  Text,
} from "evergreen-ui";
import { VIEW_TABS } from "../config/constants";
import { RELEASE_NOTES, RELEASE_VERSION } from "../config/releaseMeta";

export default function Sidebar({
  isMobile,
  onRequestClose,
  viewTabs = VIEW_TABS,
  activeTab,
  setActiveTab,
  enableWildCorrelations,
  setEnableWildCorrelations,
  payload,
  timelineDays,
  setTimelineDays,
  setFilter,
  setSetFilter,
  patchFilter,
  setPatchFilter,
  currentPatch,
  availableSets,
  availablePatches,
  matches,
  filteredMatches,
  loading,
  loadDuoAnalysis,
  displayedError,
}) {
  const portfolioUrl = String(import.meta.env.VITE_PORTFOLIO_URL || "https://brianz.dev").trim();

  function closeIfMobile() {
    if (isMobile && onRequestClose) onRequestClose();
  }

  return (
    <Pane
      className="tft-sidebar"
      width={340}
      padding={24}
      borderRight="default"
      position="sticky"
      top={0}
      alignSelf="flex-start"
      height="100vh"
      display="flex"
      flexDirection="column"
    >
      <Pane className="tft-sidebar-scroll" flex={1} minHeight={0}>
        <Pane className="tft-sidebar-header" display="flex" alignItems="center" gap={10} justifyContent="space-between">
          <Pane display="flex" alignItems="center" gap={10}>
            <a
              href={portfolioUrl}
              className="back-link tft-sidebar-home-btn"
              title="Home"
              aria-label="Home"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                padding: 0,
                margin: 0,
                boxSizing: "border-box",
                flexShrink: 0,
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.14)",
                color: "inherit",
                textDecoration: "none",
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M3 10.5L12 3L21 10.5V20C21 20.55 20.55 21 20 21H14V14H10V21H4C3.45 21 3 20.55 3 20V10.5Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
            <Heading size={700} className="tft-sidebar-title">Duo TFT Coach</Heading>
          </Pane>

          {isMobile ? (
            <button type="button" className="tft-sidebar-close" onClick={closeIfMobile} aria-label="Close filters">
              X
            </button>
          ) : null}
        </Pane>
        <Pane marginBottom={22} />

        <Tablist marginBottom={18} display="flex" flexDirection="column" gap={10}>
          {viewTabs.map((tab) => (
            <Tab
              key={tab.id}
              isSelected={activeTab === tab.id}
              onSelect={() => {
                setActiveTab(tab.id);
                closeIfMobile();
              }}
              justifyContent="flex-start"
              height={54}
              width="100%"
            >
              {tab.label}
            </Tab>
          ))}
        </Tablist>

        {payload ? (
          <Card elevation={0} border="default" background="rgba(255,255,255,0.03)" padding={14} marginBottom={12}>
            <Pane display="grid" gap={10}>
              <Pane>
                <Text size={500}>Timeline</Text>
                <Select
                  height={44}
                  marginTop={8}
                  width="100%"
                  value={timelineDays}
                  onChange={(e) => {
                    setTimelineDays(e.target.value);
                    setSetFilter("all");
                    setPatchFilter("all");
                  }}
                >
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                  <option value="0">All time</option>
                </Select>
              </Pane>
              <Pane>
                <Text size={500}>Set</Text>
                <Select height={44} marginTop={8} width="100%" value={setFilter} onChange={(e) => setSetFilter(e.target.value)}>
                  <option value="all">All sets</option>
                  {availableSets.map((setNumber) => (
                    <option key={String(setNumber)} value={String(setNumber)}>
                      Set {setNumber}
                    </option>
                  ))}
                </Select>
              </Pane>
              <Pane>
                <Text size={500}>Patch</Text>
                <Select height={44} marginTop={8} width="100%" value={patchFilter} onChange={(e) => setPatchFilter(e.target.value)}>
                  <option value="__current">Current patch {currentPatch || ""}</option>
                  <option value="all">All patches</option>
                  {availablePatches.map((patch) => (
                    <option key={patch} value={patch}>
                      Patch {patch}
                    </option>
                  ))}
                </Select>
              </Pane>
            </Pane>
          </Card>
        ) : null}

        <Card elevation={0} border="default" background="rgba(255,255,255,0.03)" padding={14}>
          <Pane display="flex" justifyContent="space-between" marginBottom={10}>
            <Text size={500}>Loaded</Text>
            <Strong>{matches.length}</Strong>
          </Pane>
          <Pane display="flex" justifyContent="space-between">
            <Text size={500}>Filtered</Text>
            <Strong>{filteredMatches.length}</Strong>
          </Pane>
        </Card>

        <Card className="release-notes-card" elevation={0} border="default" background="rgba(255,255,255,0.03)" padding={14} marginTop={12}>
          <Pane display="flex" justifyContent="space-between" alignItems="center" marginBottom={8}>
            <Text size={500}>Release</Text>
            <Strong>v{RELEASE_VERSION}</Strong>
          </Pane>
          <Pane display="grid" gap={6}>
            {RELEASE_NOTES.length ? (
              RELEASE_NOTES.slice(0, 8).map((note, index) => (
                <Text key={`release-note-${index}`} size={400}>
                  - {note}
                </Text>
              ))
            ) : (
              <Text size={400} color="muted">No release notes available.</Text>
            )}
          </Pane>
        </Card>

        <Card elevation={0} border="default" background="rgba(255,255,255,0.03)" padding={14} marginTop={12}>
          <Checkbox
            checked={Boolean(enableWildCorrelations)}
            onChange={(e) => setEnableWildCorrelations?.(e.target.checked)}
            label="Enable Wild Correlations"
          />
          <Text size={300} color="muted" marginTop={8} display="block">
            Hide nonsense mode for serious review sessions.
          </Text>
        </Card>
      </Pane>

      <Pane className="tft-sidebar-footer" marginTop={12} flexShrink={0}>
        <Button
          className="tft-cta-btn"
          type="button"
          appearance="primary"
          height={44}
          width="100%"
          disabled={loading}
          onClick={() => {
            loadDuoAnalysis();
            closeIfMobile();
          }}
        >
          <Pane display="flex" alignItems="center" justifyContent="center" gap={8}>
            {loading ? <Spinner size={14} color="white" /> : null}
            <Text size={500} color="inherit">
              {loading ? "Refreshing..." : "Refresh Data"}
            </Text>
          </Pane>
        </Button>
        {displayedError ? (
          <Pane className="tft-error-banner" marginTop={12}>
            <Strong>Request Error</Strong>
            <Text size={400} display="block" marginTop={4}>{displayedError}</Text>
          </Pane>
        ) : null}
      </Pane>
    </Pane>
  );
}
