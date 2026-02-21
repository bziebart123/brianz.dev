import {
  Alert,
  Button,
  Card,
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

export default function Sidebar({
  activeTab,
  setActiveTab,
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

  return (
    <Pane
      className="tft-sidebar"
      width={340}
      padding={24}
      borderRight="default"
      background="rgba(255,255,255,0.02)"
      position="sticky"
      top={0}
      alignSelf="flex-start"
      height="100vh"
      display="flex"
      flexDirection="column"
    >
      <Pane>
        <Pane display="flex" alignItems="center" gap={10}>
          <a
            href={portfolioUrl}
            className="back-link"
            title="Back to Portfolio"
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
            <span style={{ fontSize: 20, lineHeight: 1, fontWeight: 700 }} aria-hidden="true">
              ←
            </span>
          </a>
          <Heading size={700}>Duo TFT Coach</Heading>
        </Pane>
        <Pane marginBottom={22} />

        <Tablist marginBottom={18} display="flex" flexDirection="column" gap={10}>
          {VIEW_TABS.map((tab) => (
            <Tab
              key={tab.id}
              isSelected={activeTab === tab.id}
              onSelect={() => setActiveTab(tab.id)}
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
      </Pane>

      <Pane marginTop="auto">
        <Button type="button" appearance="primary" height={44} width="100%" disabled={loading} onClick={loadDuoAnalysis}>
          <Pane display="flex" alignItems="center" justifyContent="center" gap={8}>
            {loading ? <Spinner size={14} color="white" /> : null}
            <Text size={500} color="inherit">
              {loading ? "Refreshing..." : "Refresh Data"}
            </Text>
          </Pane>
        </Button>
        {displayedError ? (
          <Alert intent="danger" title={displayedError} marginTop={12} />
        ) : null}
      </Pane>
    </Pane>
  );
}
