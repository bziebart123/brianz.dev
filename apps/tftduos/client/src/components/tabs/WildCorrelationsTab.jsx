import { useMemo, useState } from "react";
import { Button, Card, Heading, Pane, Select, Strong, Text, Tooltip } from "evergreen-ui";

function labelWindow(key) {
  const [dowRaw, hourRaw] = String(key || "0-0").split("-");
  const dow = Number(dowRaw || 0);
  const hour = Number(hourRaw || 0);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `${days[dow] || "?"} ${String(hour).padStart(2, "0")}:00`;
}

export default function WildCorrelationsTab({ coachingIntel, timelineDays, setFilter, patchFilter }) {
  const wild = coachingIntel?.wild || {};
  const [method, setMethod] = useState(wild?.methodChoices?.[0] || "Vibes-based inference");
  const [generatedTake, setGeneratedTake] = useState("");
  const header = generatedTake || wild?.cosmicHeadline || "No cosmic conclusion yet.";

  const rangeLabel = useMemo(() => {
    const timeline = timelineDays === "0" ? "All time" : `Last ${timelineDays} days`;
    return `${timeline} · Patch filter: ${patchFilter || "all"} · Set: ${setFilter || "all"}`;
  }, [timelineDays, patchFilter, setFilter]);

  function generateTake() {
    const templates = Array.isArray(wild?.generatorTemplates) ? wild.generatorTemplates : [];
    if (!templates.length) return;
    const index = Math.floor(Math.random() * templates.length);
    setGeneratedTake(`Today's Totally Scientific Conclusion: ${templates[index]}`);
  }

  async function copyHeadline() {
    try {
      await navigator.clipboard.writeText(`${header}\n${rangeLabel}`);
    } catch {
      // ignore clipboard failures
    }
  }

  return (
    <Pane className="wild-tab-root" display="grid" gap={12}>
      <Card elevation={0} padding={16} background="rgba(255,255,255,0.03)">
        <Heading size={600}>Wild Correlations</Heading>
        <Pane marginTop={8} padding={10} border="default" borderRadius={8} background="rgba(189,75,75,0.18)">
          <Text size={400}>{wild?.disclaimer || "For entertainment only. Correlation does not imply causation."}</Text>
        </Pane>
      </Card>

      <Card elevation={0} padding={16} background="rgba(255,255,255,0.03)">
        <Heading size={500}>Today's Totally Scientific Conclusion</Heading>
        <Text size={400} display="block" marginTop={8}>{header}</Text>
        <Text size={300} color="muted" display="block" marginTop={6}>{rangeLabel}</Text>
        <Pane marginTop={10} display="flex" gap={8} flexWrap="wrap">
          <Button onClick={copyHeadline}>Copy</Button>
          <Button onClick={generateTake}>Generate New Totally Scientific Take</Button>
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            {Array.isArray(wild?.methodChoices) ? wild.methodChoices.map((choice) => (
              <option key={choice} value={choice}>{choice}</option>
            )) : null}
          </Select>
        </Pane>
      </Card>

      <Pane display="grid" gridTemplateColumns="repeat(auto-fit, minmax(280px, 1fr))" gap={12}>
        <Card elevation={0} padding={14} background="rgba(255,255,255,0.03)">
          <Heading size={500}>Weather vs LP (Totally Real)</Heading>
          <Pane marginTop={8} display="grid" gap={6}>
            <Text size={400}>Rainy games: avg place {(Number(wild?.stats?.avgPlace || 0) - 0.2).toFixed(2)}</Text>
            <Text size={400}>Sunny games: avg place {(Number(wild?.stats?.avgPlace || 0) + 0.3).toFixed(2)}</Text>
            <Text size={300} color="muted">Sample: {wild?.stats?.sample || 0} games. Winks per minute: high.</Text>
          </Pane>
        </Card>

        <Card elevation={0} padding={14} background="rgba(255,255,255,0.03)">
          <Heading size={500}>Cursed Hours</Heading>
          <Pane marginTop={8} display="grid" gap={6}>
            <Text size={400}>
              Cursed window: {wild?.cursedWindow ? `${labelWindow(wild.cursedWindow.key)} (Top2 ${wild.cursedWindow.rate.toFixed(1)}%)` : "Need more data"}
            </Text>
            <Text size={400}>
              Blessed window: {wild?.blessedWindow ? `${labelWindow(wild.blessedWindow.key)} (Top2 ${wild.blessedWindow.rate.toFixed(1)}%)` : "Need more data"}
            </Text>
            <Text size={300} color="muted">Avoid cursed window if you value your LP and emotional stability.</Text>
          </Pane>
        </Card>
      </Pane>

      <Pane display="grid" gridTemplateColumns="repeat(auto-fit, minmax(260px, 1fr))" gap={12}>
        {Array.isArray(wild?.fallbackCards) ? wild.fallbackCards.map((card, idx) => (
          <Card key={`wild-card-${idx}`} elevation={0} padding={14} background="rgba(255,255,255,0.03)">
            <Pane display="flex" justifyContent="space-between" alignItems="center" gap={8}>
              <Strong>{card.title}</Strong>
              <Tooltip content="Totally causal">
                <Text size={300}>Totally causal</Text>
              </Tooltip>
            </Pane>
            <Text size={400} display="block" marginTop={8}>{card.body}</Text>
            <Text size={300} color="muted" display="block" marginTop={8}>
              Confidence: {card.confidence}% · Method: {method}
            </Text>
          </Card>
        )) : null}
      </Pane>
    </Pane>
  );
}

