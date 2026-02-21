import { Badge, Button, Card, Heading, Pane, Spinner, Strong, Text, Tooltip } from "evergreen-ui";
import { DISPLAY_NAME_A, DISPLAY_NAME_B } from "../../config/constants";
import { asArray } from "../../utils/tft";

function pct(numerator, denominator) {
  if (!denominator) return 0;
  return (numerator / denominator) * 100;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function toneForRisk(value) {
  if (value >= 65) return "red";
  if (value >= 40) return "yellow";
  return "green";
}

function formatGeneratedTime(value) {
  const ms = Number(value || 0);
  if (!Number.isFinite(ms) || ms <= 0) return "unknown";
  return new Date(ms).toLocaleString();
}

export default function CoachingTab({
  duoRisk,
  decisionGrade,
  rescueRate,
  clutchIndex,
  placementTrend,
  totalPressureA,
  totalPressureB,
  lowGoldLossA,
  lowGoldLossB,
  lowDamageLossA,
  lowDamageLossB,
  aiCoaching,
  aiCoachingLoading,
  aiCoachingError,
  loadAiCoaching,
}) {
  const placements = asArray(placementTrend).map((value) => Number(value || 0)).filter((value) => value > 0);
  const top2Rate = pct(placements.filter((value) => value <= 2).length, placements.length);
  const winRate = pct(placements.filter((value) => value <= 1).length, placements.length);
  const dynamicSignal = clamp(
    Math.round(((decisionGrade || 0) * 0.42) + ((100 - duoRisk) * 0.33) + (top2Rate * 0.25))
  );

  const aiPlans = asArray(aiCoaching?.brief?.playerPlans);
  const fallbackPlans = [
    {
      player: DISPLAY_NAME_A,
      focus: "Stability and conversion",
      actions: [
        `Low-gold losses: ${lowGoldLossA}. Avoid panic roll below 10g unless lethal is imminent.`,
        `Low-damage losses: ${lowDamageLossA}. Prioritize carry item completion by Stage 4.`,
      ],
      pressure: totalPressureA,
    },
    {
      player: DISPLAY_NAME_B,
      focus: "Support timing and clutch setup",
      actions: [
        `Low-gold losses: ${lowGoldLossB}. Hold econ one turn longer before all-in commits.`,
        `Low-damage losses: ${lowDamageLossB}. Shift to earlier board cap and cleaner frontline pairing.`,
      ],
      pressure: totalPressureB,
    },
  ];

  const playerPlans = aiPlans.length
    ? aiPlans.map((plan) => ({
        player: plan.player,
        focus: plan.focus,
        actions: asArray(plan.actions).slice(0, 3),
        pressure: null,
      }))
    : fallbackPlans;

  const isAiPending = aiCoachingLoading || (!aiCoaching && !aiCoachingError);
  if (isAiPending) {
    return (
      <Pane className="coaching-tab-root" display="grid" gap={12}>
        <Card
          elevation={0}
          padding={24}
          background="rgba(255,255,255,0.03)"
          border="default"
          minHeight={420}
          display="grid"
          placeItems="center"
        >
          <Pane display="grid" gap={10} justifyItems="center">
            <Spinner size={26} />
            <Heading size={600}>Generating AI coaching...</Heading>
            <Text size={400} color="muted">
              Loading the full coaching page once GPT analysis is ready.
            </Text>
          </Pane>
        </Card>
      </Pane>
    );
  }

  return (
    <Pane className="coaching-tab-root" display="grid" gap={12}>
      <Card elevation={0} padding={16} background="rgba(255,255,255,0.03)">
        <Pane display="flex" alignItems="center" justifyContent="space-between" gap={10} flexWrap="wrap">
          <Tooltip content="AI-first coaching dashboard with compact high-signal KPIs.">
            <Heading size={600}>Duo Coaching</Heading>
          </Tooltip>
          <Pane display="flex" gap={8} flexWrap="wrap">
            <Badge color={toneForRisk(duoRisk)}>Duo Risk {duoRisk}%</Badge>
            <Badge color={dynamicSignal >= 70 ? "green" : dynamicSignal >= 50 ? "yellow" : "red"}>
              Dynamic Signal {dynamicSignal}
            </Badge>
          </Pane>
        </Pane>
        <Pane marginTop={12} display="grid" gridTemplateColumns="repeat(auto-fit, minmax(180px, 1fr))" gap={10}>
          <Card elevation={0} padding={12} background="rgba(255,255,255,0.03)" border="default">
            <Text size={400} color="muted">Decision Grade</Text>
            <Heading size={700} marginTop={6}>{decisionGrade}/100</Heading>
          </Card>
          <Card elevation={0} padding={12} background="rgba(255,255,255,0.03)" border="default">
            <Text size={400} color="muted">Team Top2 Rate</Text>
            <Heading size={700} marginTop={6}>{top2Rate.toFixed(1)}%</Heading>
          </Card>
          <Card elevation={0} padding={12} background="rgba(255,255,255,0.03)" border="default">
            <Text size={400} color="muted">Team Win Rate</Text>
            <Heading size={700} marginTop={6}>{winRate.toFixed(1)}%</Heading>
          </Card>
          <Card elevation={0} padding={12} background="rgba(255,255,255,0.03)" border="default">
            <Text size={400} color="muted">Rescue / Clutch</Text>
            <Heading size={700} marginTop={6}>{rescueRate.toFixed(1)}% / {clutchIndex.toFixed(1)}%</Heading>
          </Card>
        </Pane>
      </Card>

      <Card elevation={0} padding={16} background="rgba(255,255,255,0.03)">
        <Pane display="flex" alignItems="center" justifyContent="space-between" gap={10} flexWrap="wrap">
          <Pane display="flex" alignItems="center" gap={8}>
            <Heading size={500}>AI Coach Brief</Heading>
            {aiCoaching?.fallback ? <Badge color="yellow">Fallback</Badge> : <Badge color="green">Live LLM</Badge>}
            {aiCoaching?.webSearchUsed ? <Badge color="blue">Web Meta</Badge> : null}
          </Pane>
          <Pane display="flex" alignItems="center" gap={8}>
            {aiCoaching?.model ? <Badge color="neutral">{aiCoaching.model}</Badge> : null}
            <Button className="tft-cta-btn" onClick={() => loadAiCoaching(true)} disabled={aiCoachingLoading}>
              {aiCoachingLoading ? "Generating..." : "Refresh AI"}
            </Button>
          </Pane>
        </Pane>
        {aiCoachingError ? (
          <Pane className="tft-error-banner" marginTop={10}>
            <Strong>AI Coach Error</Strong>
            <Text size={400} display="block" marginTop={4}>{aiCoachingError}</Text>
          </Pane>
        ) : null}
        {aiCoaching?.brief ? (
          <Pane marginTop={10} display="grid" gap={8}>
            <Pane padding={12} border="default" borderRadius={8} background="rgba(255,255,255,0.03)">
              <Strong>{aiCoaching.brief.headline || "AI Coaching Brief"}</Strong>
              <Text size={400} display="block" marginTop={6}>
                {aiCoaching.brief.summary || "No summary returned."}
              </Text>
              <Text size={300} color="muted" display="block" marginTop={6}>
                Confidence: {aiCoaching.brief.confidence || "unknown"}
                {aiCoaching?.reason ? ` | ${aiCoaching.reason}` : ""}
                {` | Generated ${formatGeneratedTime(aiCoaching?.generatedAt)}`}
              </Text>
            </Pane>

            {asArray(aiCoaching.brief.teamPlan).length ? (
              <Pane padding={12} border="default" borderRadius={8} background="rgba(255,255,255,0.03)">
                <Text size={400} color="muted">Team Actions</Text>
                <Pane marginTop={6} display="grid" gap={4}>
                  {asArray(aiCoaching.brief.teamPlan).slice(0, 4).map((line, idx) => (
                    <Text key={`ai-team-${idx}`} size={400}>- {line}</Text>
                  ))}
                </Pane>
              </Pane>
            ) : null}

            {asArray(aiCoaching.brief.metaDelta).length ? (
              <Pane padding={12} border="default" borderRadius={8} background="rgba(255,255,255,0.03)">
                <Text size={400} color="muted">Meta vs Your Builds</Text>
                <Pane marginTop={6} display="grid" gap={4}>
                  {asArray(aiCoaching.brief.metaDelta).slice(0, 4).map((line, idx) => (
                    <Text key={`ai-meta-delta-${idx}`} size={400}>- {line}</Text>
                  ))}
                </Pane>
              </Pane>
            ) : null}

            {asArray(aiCoaching.brief.topImprovementAreas).length ? (
              <Pane padding={12} border="default" borderRadius={8} background="rgba(255,255,255,0.03)">
                <Text size={400} color="muted">Top Improvement Areas</Text>
                <Pane marginTop={6} display="grid" gap={4}>
                  {asArray(aiCoaching.brief.topImprovementAreas).slice(0, 4).map((line, idx) => (
                    <Text key={`ai-improve-${idx}`} size={400}>- {line}</Text>
                  ))}
                </Pane>
              </Pane>
            ) : null}

            {asArray(aiCoaching.brief.winConditions).length ? (
              <Pane padding={12} border="default" borderRadius={8} background="rgba(255,255,255,0.03)">
                <Text size={400} color="muted">Win Conditions</Text>
                <Pane marginTop={6} display="grid" gap={4}>
                  {asArray(aiCoaching.brief.winConditions).slice(0, 4).map((line, idx) => (
                    <Text key={`ai-wincon-${idx}`} size={400}>- {line}</Text>
                  ))}
                </Pane>
              </Pane>
            ) : null}

            {asArray(aiCoaching.brief.fiveGamePlan).length ? (
              <Pane padding={12} border="default" borderRadius={8} background="rgba(255,255,255,0.03)">
                <Text size={400} color="muted">Next 5 Games Plan</Text>
                <Pane marginTop={6} display="grid" gap={4}>
                  {asArray(aiCoaching.brief.fiveGamePlan).slice(0, 5).map((line, idx) => (
                    <Text key={`ai-plan5-${idx}`} size={400}>- {line}</Text>
                  ))}
                </Pane>
              </Pane>
            ) : null}

            {asArray(aiCoaching.brief.championBuilds).length ? (
              <Pane padding={12} border="default" borderRadius={8} background="rgba(255,255,255,0.03)">
                <Text size={400} color="muted">Champion Build Signals</Text>
                <Pane marginTop={8} display="grid" gap={6}>
                  {asArray(aiCoaching.brief.championBuilds).slice(0, 6).map((row, idx) => (
                    <Pane key={`ai-build-${idx}`} padding={8} border="default" borderRadius={6} background="rgba(255,255,255,0.02)">
                      <Text size={400}>
                        <Strong>{row.player}</Strong> - {row.champion}
                        {asArray(row.items).length ? ` | ${asArray(row.items).join(", ")}` : ""}
                      </Text>
                      <Text size={300} color="muted" display="block" marginTop={4}>
                        {Number(row.top2Rate || 0).toFixed(1)}% Top2 over {Number(row.games || 0)} games
                        {row.note ? ` | ${row.note}` : ""}
                      </Text>
                    </Pane>
                  ))}
                </Pane>
              </Pane>
            ) : null}
          </Pane>
        ) : (
          <Text size={400} color="muted" marginTop={10} display="block">
            No AI brief yet. Use Refresh AI.
          </Text>
        )}
      </Card>

      <Card elevation={0} padding={16} background="rgba(255,255,255,0.03)">
        <Heading size={500}>Individual Action Plans</Heading>
        <Pane marginTop={10} display="grid" gridTemplateColumns="repeat(auto-fit, minmax(280px, 1fr))" gap={10}>
          {playerPlans.map((plan, idx) => (
            <Pane key={`${plan.player}-${idx}`} padding={12} border="default" borderRadius={8} background="rgba(255,255,255,0.03)">
              <Pane display="flex" alignItems="center" justifyContent="space-between" gap={8}>
                <Strong>{plan.player}</Strong>
                {Number.isFinite(plan.pressure) ? (
                  <Badge color={plan.pressure >= 5 ? "red" : plan.pressure >= 3 ? "yellow" : "green"}>
                    Pressure {plan.pressure}
                  </Badge>
                ) : null}
              </Pane>
              <Text size={400} display="block" marginTop={6}>Focus: {plan.focus || "n/a"}</Text>
              <Pane marginTop={8} display="grid" gap={4}>
                {asArray(plan.actions).slice(0, 3).map((line, actionIdx) => (
                  <Text key={`${plan.player}-action-${actionIdx}`} size={400}>- {line}</Text>
                ))}
              </Pane>
            </Pane>
          ))}
        </Pane>
      </Card>
    </Pane>
  );
}
