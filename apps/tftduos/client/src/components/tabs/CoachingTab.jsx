import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Heading,
  Icon,
  Pane,
  Select,
  Spinner,
  Strong,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from "evergreen-ui";
import { DISPLAY_NAME_A, DISPLAY_NAME_B } from "../../config/constants";
import IconWithLabel from "../IconWithLabel";
import MetricBar from "../MetricBar";
import Sparkline from "../Sparkline";
import { asArray, formatTime, prettyName } from "../../utils/tft";

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function pct(numerator, denominator) {
  if (!denominator) return 0;
  return (numerator / denominator) * 100;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}
function formatGeneratedTime(value) {
  const ms = Number(value || 0);
  if (!Number.isFinite(ms) || ms <= 0) return "unknown";
  return new Date(ms).toLocaleString();
}

function toneForRisk(value) {
  if (value >= 65) return "red";
  if (value >= 40) return "yellow";
  return "green";
}

function buildTeamPriorities({
  decisionGrade,
  leakCount,
  rescueRate,
  clutchIndex,
  recentAvg,
  momentum,
  giftMetrics,
  staggerSuggestions,
  eventSample,
}) {
  const priorities = [];

  if (decisionGrade < 60) {
    priorities.push({
      severity: 92,
      title: "Decision Stability",
      why: `Decision grade is ${decisionGrade}/100, which is below stable target.`,
      action: "Lock a default 3-2 responsibility split before carousel and avoid panic dual-roll unless both are critical HP.",
      owner: "Team",
    });
  }

  if (leakCount >= 2) {
    priorities.push({
      severity: 88,
      title: "Leak Cleanup",
      why: `${leakCount} active leak patterns are still repeating.`,
      action: "Pick the top 2 leaks and track one explicit correction each game in Journal.",
      owner: "Team",
    });
  }

  if (momentum < -0.1 || recentAvg > 3.0) {
    priorities.push({
      severity: 84,
      title: "Early Stabilization",
      why: `Recent average placement is ${recentAvg.toFixed(2)} with momentum ${momentum.toFixed(2)}.`,
      action: "Prioritize one low-variance board by Stage 3 and force the partner into greed/support role.",
      owner: "Team",
    });
  }

  if (eventSample >= 5 && (rescueRate < 10 || clutchIndex < 20)) {
    priorities.push({
      severity: 78,
      title: "Rescue Timing",
      why: `Rescue/Clutch is ${rescueRate.toFixed(1)}% / ${clutchIndex.toFixed(1)}% with enough event sample.`,
      action: "Call rescue windows earlier in Stage 4+ and pre-commit one bailout condition before each stage starts.",
      owner: "Team",
    });
  }

  if (giftMetrics?.giftROI !== undefined && giftMetrics?.giftROI < 30) {
    priorities.push({
      severity: 72,
      title: "Gift ROI",
      why: `Gift ROI is ${giftMetrics.giftROI.toFixed(1)}%, meaning too many sends are low impact.`,
      action: "Only send when partner has immediate carry conversion (2-star spike or item completion).",
      owner: "Team",
    });
  }

  if (staggerSuggestions.length) {
    priorities.push({
      severity: 64,
      title: "Roll Stagger Discipline",
      why: "Coordination guidance indicates better outcomes when roll timings are staggered.",
      action: staggerSuggestions[0],
      owner: "Team",
    });
  }

  if (!priorities.length) {
    priorities.push({
      severity: 55,
      title: "Maintain Current Process",
      why: "No severe breakdown signal in current filter.",
      action: "Keep current split and refine by logging one event per pivotal round for better coaching precision.",
      owner: "Team",
    });
  }

  return priorities.sort((a, b) => b.severity - a.severity).slice(0, 4);
}

function buildPlayerPlan({
  name,
  pressure,
  lowGoldLosses,
  lowDamageLosses,
  topItems,
  partnerPressure,
}) {
  const actions = [];
  const strengths = [];

  if (topItems.length) {
    strengths.push(`Most consistent item line: ${prettyName(topItems[0][0])} (${topItems[0][1]} games).`);
  } else {
    strengths.push("No strong item pattern yet. Need more filtered games.");
  }

  if (pressure <= partnerPressure) {
    strengths.push("Currently showing better stability signal than partner.");
  }

  if (lowGoldLosses >= 2) {
    actions.push("Delay low-gold panic roll by one turn unless death threshold is immediate.");
  }
  if (lowDamageLosses >= 2) {
    actions.push("Prioritize carry DPS completion one stage earlier (item slam before greed line).");
  }
  if (!actions.length) {
    actions.push("Keep current baseline; focus on clearer communication callouts before Stage 4 pivots.");
  }

  const accountabilityMetric = lowGoldLosses + lowDamageLosses;
  const target =
    accountabilityMetric > 3
      ? "Cut low-resource loss signals by 2 next 10 games."
      : "Hold low-resource loss signals at 2 or less next 10 games.";

  return {
    name,
    pressure,
    strengths: strengths.slice(0, 2),
    actions: actions.slice(0, 3),
    target,
  };
}

export default function CoachingTab({
  duoRisk,
  decisionGrade,
  leakCount,
  rescueRate,
  clutchIndex,
  filteredMatches,
  placementTrend,
  totalPressureA,
  totalPressureB,
  lowGoldLossA,
  lowGoldLossB,
  lowDamageLossA,
  lowDamageLossB,
  suggestionCards,
  scorecard,
  coachingBranches,
  giftMetrics,
  staggerSuggestions,
  openerCards,
  iconManifest,
  payload,
  coachingInsights,
  highlights,
  coachMatchId,
  setCoachMatchId,
  planAt32,
  setPlanAt32,
  executedPlan,
  setExecutedPlan,
  tagPanicRoll,
  setTagPanicRoll,
  tagMissedGift,
  setTagMissedGift,
  tagBothRoll,
  setTagBothRoll,
  submitJournal,
  duoId,
  coachSaving,
  quickStage,
  setQuickStage,
  quickActor,
  setQuickActor,
  submitQuickEvent,
  coachMessage,
  coachingIntel,
  aiCoaching,
  aiCoachingLoading,
  aiCoachingError,
  loadAiCoaching,
}) {
  const placements = placementTrend.map((value) => Number(value || 0)).filter((value) => value > 0);
  const recent = placements.slice(-8);
  const prior = placements.slice(-16, -8);
  const recentAvg = average(recent);
  const priorAvg = average(prior);
  const momentum = prior.length ? priorAvg - recentAvg : 0;
  const top2Rate = pct(placements.filter((value) => value <= 2).length, placements.length);
  const winRate = pct(placements.filter((value) => value <= 1).length, placements.length);
  const eventSample = Number(scorecard?.sampleSize?.eventCount || 0);

  const teamPriorities = buildTeamPriorities({
    decisionGrade,
    leakCount,
    rescueRate,
    clutchIndex,
    recentAvg,
    momentum,
    giftMetrics,
    staggerSuggestions,
    eventSample,
  });

  const planA = buildPlayerPlan({
    name: DISPLAY_NAME_A,
    pressure: totalPressureA,
    lowGoldLosses: lowGoldLossA,
    lowDamageLosses: lowDamageLossA,
    topItems: coachingInsights.topItemsA,
    partnerPressure: totalPressureB,
  });

  const planB = buildPlayerPlan({
    name: DISPLAY_NAME_B,
    pressure: totalPressureB,
    lowGoldLosses: lowGoldLossB,
    lowDamageLosses: lowDamageLossB,
    topItems: coachingInsights.topItemsB,
    partnerPressure: totalPressureA,
  });

  const dynamicSignal = clamp(
    Math.round(
      ((decisionGrade || 0) * 0.35) +
      ((100 - duoRisk) * 0.25) +
      (top2Rate * 0.2) +
      (Math.max(0, momentum + 2) * 10)
    )
  );
  const tilt = coachingIntel?.tilt || null;
  const fingerprints = coachingIntel?.fingerprints || {};
  const winConditions = asArray(coachingIntel?.winConditions?.conditions);
  const autopsy = asArray(coachingIntel?.lossAutopsy);
  const contested = coachingIntel?.contestedMetaPressure || null;
  const timingCoach = coachingIntel?.timingCoach || null;
  const coordination = coachingIntel?.coordination || null;

  return (
    <Pane className="coaching-tab-root" display="grid" gap={12}>
      <Card elevation={0} padding={16} background="rgba(255,255,255,0.03)">
        <Pane display="flex" alignItems="center" justifyContent="space-between" gap={10} flexWrap="wrap">
          <Tooltip content="Dynamic coaching board generated from current filtered match outcomes + logged event patterns.">
            <Heading size={600}>Duo Coaching Command Center</Heading>
          </Tooltip>
          <Pane display="flex" gap={8} flexWrap="wrap">
            <Badge color={toneForRisk(duoRisk)}>Duo Risk {duoRisk}%</Badge>
            <Badge color={dynamicSignal >= 70 ? "green" : dynamicSignal >= 50 ? "yellow" : "red"}>
              Dynamic Signal {dynamicSignal}
            </Badge>
          </Pane>
        </Pane>

        <Pane marginTop={12} display="grid" gridTemplateColumns="repeat(auto-fit, minmax(170px, 1fr))" gap={10}>
          <Card elevation={0} padding={12} background="rgba(255,255,255,0.03)" border="default">
            <Text size={400} color="muted">Decision Grade</Text>
            <Heading size={700} marginTop={6}>{decisionGrade}/100</Heading>
          </Card>
          <Card elevation={0} padding={12} background="rgba(255,255,255,0.03)" border="default">
            <Text size={400} color="muted">Top2 Rate</Text>
            <Heading size={700} marginTop={6}>{top2Rate.toFixed(1)}%</Heading>
          </Card>
          <Card elevation={0} padding={12} background="rgba(255,255,255,0.03)" border="default">
            <Text size={400} color="muted">Win Rate</Text>
            <Heading size={700} marginTop={6}>{winRate.toFixed(1)}%</Heading>
          </Card>
          <Card elevation={0} padding={12} background="rgba(255,255,255,0.03)" border="default">
            <Text size={400} color="muted">Recent Avg</Text>
            <Heading size={700} marginTop={6}>{recentAvg ? recentAvg.toFixed(2) : "-"}</Heading>
          </Card>
          <Card elevation={0} padding={12} background="rgba(255,255,255,0.03)" border="default">
            <Text size={400} color="muted">Momentum</Text>
            <Heading size={700} marginTop={6}>{momentum >= 0 ? "+" : ""}{momentum.toFixed(2)}</Heading>
          </Card>
          <Card elevation={0} padding={12} background="rgba(255,255,255,0.03)" border="default">
            <Text size={400} color="muted">Events Logged</Text>
            <Heading size={700} marginTop={6}>{eventSample}</Heading>
          </Card>
        </Pane>
      </Card>

      {tilt?.inTiltWindow ? (
        <Card elevation={0} padding={14} background="rgba(189,75,75,0.18)" border="default">
          <Pane display="flex" justifyContent="space-between" alignItems="center" gap={8} flexWrap="wrap">
            <Strong>Tilt Window Detected</Strong>
            <Badge color="red">Tilt score {tilt.tiltScore.toFixed(0)}</Badge>
          </Pane>
          <Text size={400} display="block" marginTop={8}>
            Recent avg place {tilt.recentAvg.toFixed(2)} vs prior {tilt.priorAvg.toFixed(2)}. Active bad streak: {tilt.currentBadStreak}.
          </Text>
          <Text size={400} display="block" marginTop={6}>Reset rule: {tilt.resetRule}</Text>
        </Card>
      ) : null}

      <Pane display="grid" gridTemplateColumns="repeat(auto-fit, minmax(280px, 1fr))" gap={12}>
        <Card elevation={0} padding={16} background="rgba(255,255,255,0.03)">
          <Heading size={500}>Playstyle Fingerprints</Heading>
          <Pane marginTop={10} display="grid" gap={8}>
            <Pane padding={10} border="default" borderRadius={8} background="rgba(255,255,255,0.03)">
              <Strong>{DISPLAY_NAME_A}</Strong>
              <Text size={400} display="block" marginTop={6}>{asArray(fingerprints?.playerA?.labels).join(" · ") || "Not enough data yet."}</Text>
            </Pane>
            <Pane padding={10} border="default" borderRadius={8} background="rgba(255,255,255,0.03)">
              <Strong>{DISPLAY_NAME_B}</Strong>
              <Text size={400} display="block" marginTop={6}>{asArray(fingerprints?.playerB?.labels).join(" · ") || "Not enough data yet."}</Text>
            </Pane>
            <Pane padding={10} border="default" borderRadius={8} background="rgba(255,255,255,0.03)">
              <Strong>Duo Identity</Strong>
              <Text size={400} display="block" marginTop={6}>{asArray(fingerprints?.duo?.labels).join(" · ") || "Not enough data yet."}</Text>
            </Pane>
          </Pane>
        </Card>

        <Card elevation={0} padding={16} background="rgba(255,255,255,0.03)">
          <Heading size={500}>Win Condition Miner</Heading>
          <Pane marginTop={10} display="grid" gap={8}>
            {winConditions.length ? (
              winConditions.map((condition, idx) => (
                <Pane key={`wc-${idx}`} padding={10} border="default" borderRadius={8} background="rgba(255,255,255,0.03)">
                  <Strong>{condition.title}</Strong>
                  <Text size={400} display="block" marginTop={6}>{condition.detail}</Text>
                </Pane>
              ))
            ) : (
              <Text size={400} color="muted">Need more same-team games for stable win-condition mining.</Text>
            )}
          </Pane>
        </Card>
      </Pane>

      <Pane display="grid" gridTemplateColumns="repeat(auto-fit, minmax(320px, 1fr))" gap={12}>
        <Card elevation={0} padding={16} background="rgba(255,255,255,0.03)">
          <Heading size={500}>Team Priorities</Heading>
          <Pane marginTop={10} display="grid" gap={8}>
            {teamPriorities.map((item, idx) => (
              <Pane key={`priority-${idx}`} padding={10} border="default" borderRadius={8} background="rgba(255,255,255,0.03)">
                <Pane display="flex" alignItems="center" justifyContent="space-between" gap={8} flexWrap="wrap">
                  <Strong>{item.title}</Strong>
                  <Badge color={item.severity >= 85 ? "red" : item.severity >= 70 ? "yellow" : "green"}>{item.owner}</Badge>
                </Pane>
                <Text size={300} color="muted" display="block" marginTop={6}>{item.why}</Text>
                <Text size={400} display="block" marginTop={6}>Action: {item.action}</Text>
              </Pane>
            ))}
          </Pane>
        </Card>

        <Card elevation={0} padding={16} background="rgba(255,255,255,0.03)">
          <Heading size={500}>Team Trend + Pressure</Heading>
          <Pane marginTop={10}>
            <Text size={400} color="muted">Team placement trend</Text>
            <Pane marginTop={6}>
              <Sparkline values={placementTrend} height={80} responsive canvasWidth={640} />
            </Pane>
          </Pane>
          <Pane marginTop={12} display="grid" gap={8}>
            <MetricBar label={`${DISPLAY_NAME_A} pressure`} value={Math.min(100, totalPressureA * 18)} color="#bd4b4b" />
            <MetricBar label={`${DISPLAY_NAME_B} pressure`} value={Math.min(100, totalPressureB * 18)} color="#bd4b4b" />
            <MetricBar label="Rescue rate" value={rescueRate} color="#55b6ff" />
            <MetricBar label="Clutch index" value={clutchIndex} color="#7ad27a" />
          </Pane>
        </Card>
      </Pane>

      <Pane display="grid" gridTemplateColumns="repeat(auto-fit, minmax(300px, 1fr))" gap={12}>
        <Card elevation={0} padding={16} background="rgba(255,255,255,0.03)">
          <Heading size={500}>Contested Meta Pressure</Heading>
          <Pane marginTop={10} display="grid" gap={8}>
            <Pane padding={10} border="default" borderRadius={8} background="rgba(255,255,255,0.03)">
              <Text size={400} color="muted">Pressure score</Text>
              <Heading size={700} marginTop={6}>{Number(contested?.score || 0).toFixed(1)}%</Heading>
              <Text size={400} display="block" marginTop={6}>{contested?.recommendation || "No pressure signal yet."}</Text>
            </Pane>
            <MetricBar label="Contested pressure" value={Number(contested?.score || 0)} color="#c08d3f" />
          </Pane>
        </Card>

        <Card elevation={0} padding={16} background="rgba(255,255,255,0.03)">
          <Heading size={500}>Timing Coach</Heading>
          <Pane marginTop={10} display="grid" gap={8}>
            <Pane padding={10} border="default" borderRadius={8} background="rgba(255,255,255,0.03)">
              <Text size={400} display="block">{timingCoach?.guidance || "No timing guidance yet."}</Text>
            </Pane>
            <Pane display="grid" gridTemplateColumns="1fr 1fr" gap={8}>
              <Pane padding={10} border="default" borderRadius={8} background="rgba(255,255,255,0.03)">
                <Text size={400} color="muted">Top2 avg level</Text>
                <Heading size={700} marginTop={6}>{Number(timingCoach?.top2Level || 0).toFixed(2)}</Heading>
              </Pane>
              <Pane padding={10} border="default" borderRadius={8} background="rgba(255,255,255,0.03)">
                <Text size={400} color="muted">Non-Top2 avg level</Text>
                <Heading size={700} marginTop={6}>{Number(timingCoach?.nonTop2Level || 0).toFixed(2)}</Heading>
              </Pane>
            </Pane>
          </Pane>
        </Card>

        <Card elevation={0} padding={16} background="rgba(255,255,255,0.03)">
          <Heading size={500}>Duo Coordination Score</Heading>
          <Pane marginTop={10} display="grid" gap={8}>
            <Pane padding={10} border="default" borderRadius={8} background="rgba(255,255,255,0.03)">
              <Text size={400} color="muted">Coordination</Text>
              <Heading size={700} marginTop={6}>{Number(coordination?.score || 0).toFixed(0)}/100</Heading>
              <Text size={400} display="block" marginTop={6}>{coordination?.recommendation || "No split recommendation yet."}</Text>
            </Pane>
            {asArray(coordination?.candidates).length ? (
              <Pane padding={10} border="default" borderRadius={8} background="rgba(255,255,255,0.03)">
                {asArray(coordination?.candidates).map((row) => (
                  <Text key={`coord-${row.split}`} size={400} display="block">
                    {row.split}: Top2 {row.top2Rate.toFixed(1)}% · Win {row.winRate.toFixed(1)}% ({row.games} games)
                  </Text>
                ))}
              </Pane>
            ) : null}
          </Pane>
        </Card>
      </Pane>

      <Card elevation={0} padding={16} background="rgba(255,255,255,0.03)">
        <Heading size={500}>Loss Autopsy (Worst 3)</Heading>
        <Pane marginTop={10} display="grid" gap={8}>
          {autopsy.length ? (
            autopsy.map((entry, idx) => (
              <Pane key={`autopsy-${entry.matchId}-${idx}`} padding={10} border="default" borderRadius={8} background="rgba(255,255,255,0.03)">
                <Pane display="flex" justifyContent="space-between" gap={8} flexWrap="wrap">
                  <Strong>#{idx + 1} · Placement {entry.placement}</Strong>
                  <Badge color={entry.confidence >= 70 ? "red" : "yellow"}>Confidence {entry.confidence}%</Badge>
                </Pane>
                <Pane marginTop={6} display="grid" gap={4}>
                  {asArray(entry.factors).map((factor, fidx) => (
                    <Text key={`factor-${idx}-${fidx}`} size={400}>- {factor.reason}</Text>
                  ))}
                </Pane>
              </Pane>
            ))
          ) : (
            <Text size={400} color="muted">No loss autopsy available yet.</Text>
          )}
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
            <Button onClick={() => loadAiCoaching(true)} disabled={aiCoachingLoading}>
              {aiCoachingLoading ? "Generating..." : "Refresh AI"}
            </Button>
          </Pane>
        </Pane>
        {aiCoachingError ? (
          <Alert marginTop={10} intent="danger" title={aiCoachingError} />
        ) : null}
        {aiCoachingLoading ? (
          <Pane
            marginTop={10}
            padding={12}
            border="default"
            borderRadius={8}
            background="rgba(85,182,255,0.08)"
            display="flex"
            alignItems="center"
            gap={10}
          >
            <Spinner size={18} />
            <Text size={400}>GPT is analyzing your current filter and generating coaching guidance...</Text>
          </Pane>
        ) : null}
        {aiCoaching?.brief ? (
          <Pane marginTop={10} display="grid" gap={8} opacity={aiCoachingLoading ? 0.5 : 1}>
            <Pane padding={10} border="default" borderRadius={8} background="rgba(255,255,255,0.03)">
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
              <Pane padding={10} border="default" borderRadius={8} background="rgba(255,255,255,0.03)">
                <Text size={400} color="muted">Team Actions</Text>
                <Pane marginTop={6} display="grid" gap={4}>
                  {asArray(aiCoaching.brief.teamPlan).map((line, idx) => (
                    <Text key={`ai-team-${idx}`} size={400}>- {line}</Text>
                  ))}
                </Pane>
              </Pane>
            ) : null}
            {asArray(aiCoaching.brief.metaRead).length ? (
              <Pane padding={10} border="default" borderRadius={8} background="rgba(255,255,255,0.03)">
                <Text size={400} color="muted">Meta Comparison</Text>
                <Pane marginTop={6} display="grid" gap={4}>
                  {asArray(aiCoaching.brief.metaRead).map((line, idx) => (
                    <Text key={`ai-meta-${idx}`} size={400}>- {line}</Text>
                  ))}
                </Pane>
              </Pane>
            ) : null}
            {asArray(aiCoaching.brief.playerPlans).length ? (
              <Pane display="grid" gridTemplateColumns="repeat(auto-fit, minmax(260px, 1fr))" gap={8}>
                {asArray(aiCoaching.brief.playerPlans).map((plan, idx) => (
                  <Pane key={`ai-plan-${idx}`} padding={10} border="default" borderRadius={8} background="rgba(255,255,255,0.03)">
                    <Strong>{plan.player}</Strong>
                    <Text size={400} display="block" marginTop={6}>Focus: {plan.focus || "n/a"}</Text>
                    <Pane marginTop={6} display="grid" gap={4}>
                      {asArray(plan.actions).map((line, actionIdx) => (
                        <Text key={`ai-plan-action-${idx}-${actionIdx}`} size={400}>- {line}</Text>
                      ))}
                    </Pane>
                  </Pane>
                ))}
              </Pane>
            ) : null}
            {aiCoaching.brief.patchContext ? (
              <Pane padding={10} border="default" borderRadius={8} background="rgba(255,255,255,0.03)">
                <Text size={400} color="muted">Patch Context</Text>
                <Text size={400} display="block" marginTop={6}>{aiCoaching.brief.patchContext}</Text>
              </Pane>
            ) : null}
            {asArray(aiCoaching.brief.metaDelta).length ? (
              <Pane padding={10} border="default" borderRadius={8} background="rgba(255,255,255,0.03)">
                <Text size={400} color="muted">Meta vs Your Builds</Text>
                <Pane marginTop={6} display="grid" gap={4}>
                  {asArray(aiCoaching.brief.metaDelta).map((line, idx) => (
                    <Text key={`ai-delta-${idx}`} size={400}>- {line}</Text>
                  ))}
                </Pane>
              </Pane>
            ) : null}
            {asArray(aiCoaching.brief.sources).length ? (
              <Pane padding={10} border="default" borderRadius={8} background="rgba(255,255,255,0.03)">
                <Text size={400} color="muted">Sources</Text>
                <Pane marginTop={6} display="grid" gap={4}>
                  {asArray(aiCoaching.brief.sources).map((source, idx) => {
                    const isUrl = /^https?:\/\//i.test(String(source || ""));
                    return isUrl ? (
                      <a
                        key={`ai-source-${idx}`}
                        href={source}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#8fc6ff", textDecoration: "underline", fontSize: 13 }}
                      >
                        {source}
                      </a>
                    ) : (
                      <Text key={`ai-source-${idx}`} size={300}>{source}</Text>
                    );
                  })}
                </Pane>
              </Pane>
            ) : null}
          </Pane>
        ) : (
          <Text size={400} color="muted" marginTop={10} display="block">
            Open Coaching to auto-generate a dynamic AI brief from your current filters.
          </Text>
        )}
      </Card>

      <Pane className="coaching-player-plan-grid" display="grid" gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap={12}>
        {[planA, planB].map((plan) => (
          <Card key={plan.name} elevation={0} padding={16} background="rgba(255,255,255,0.03)">
            <Heading size={500}>{plan.name} Action Plan</Heading>
            <Pane marginTop={8} display="grid" gap={8}>
              <Pane padding={10} border="default" borderRadius={8} background="rgba(255,255,255,0.03)">
                <Text size={400} color="muted">Pressure score</Text>
                <Heading size={700} marginTop={6}>{plan.pressure}</Heading>
              </Pane>
              <Pane padding={10} border="default" borderRadius={8} background="rgba(255,255,255,0.03)">
                <Text size={400} color="muted">Strengths</Text>
                <Pane marginTop={6} display="grid" gap={4}>
                  {plan.strengths.map((line, idx) => (
                    <Text key={`${plan.name}-strength-${idx}`} size={400}>- {line}</Text>
                  ))}
                </Pane>
              </Pane>
              <Pane padding={10} border="default" borderRadius={8} background="rgba(255,255,255,0.03)">
                <Text size={400} color="muted">Next Reps</Text>
                <Pane marginTop={6} display="grid" gap={4}>
                  {plan.actions.map((line, idx) => (
                    <Text key={`${plan.name}-action-${idx}`} size={400}>- {line}</Text>
                  ))}
                </Pane>
                <Text size={400} display="block" marginTop={8}>Target: {plan.target}</Text>
              </Pane>
            </Pane>
          </Card>
        ))}
      </Pane>

      <Pane display="grid" gridTemplateColumns="repeat(auto-fit, minmax(300px, 1fr))" gap={12}>
        <Card elevation={0} padding={16} background="rgba(255,255,255,0.03)">
          <Heading size={500}>Fix Queue</Heading>
          <Pane marginTop={10} display="grid" gap={8}>
            {suggestionCards.length ? (
              suggestionCards.map((item) => (
                <Pane key={item.id} padding={10} border="default" borderRadius={8} background="rgba(255,255,255,0.03)">
                  <Pane display="flex" alignItems="center" gap={8}>
                    <Icon icon={item.icon} size={14} />
                    <Strong>{item.title}</Strong>
                  </Pane>
                  <Text size={300} color="muted" marginTop={6}>{item.why}</Text>
                  <Text size={400} marginTop={6}>Fix: {item.fix}</Text>
                </Pane>
              ))
            ) : (
              <Text size={400} color="muted">No leak signals in this filter.</Text>
            )}
          </Pane>
        </Card>

        <Card elevation={0} padding={16} background="rgba(255,255,255,0.03)">
          <Heading size={500}>Dynamic Stage Plan</Heading>
          <Pane marginTop={10} display="grid" gap={8}>
            <Pane padding={10} border="default" borderRadius={8} background="rgba(255,255,255,0.03)">
              <Strong>Stage 2</Strong>
              <Text size={400} display="block" marginTop={6}>
                {scorecard?.coachingReplay?.stage2 || "No Stage 2 guidance yet."}
              </Text>
            </Pane>
            <Pane padding={10} border="default" borderRadius={8} background="rgba(255,255,255,0.03)">
              <Strong>Stage 3</Strong>
              <Text size={400} display="block" marginTop={6}>
                {scorecard?.coachingReplay?.stage3 || "No Stage 3 guidance yet."}
              </Text>
            </Pane>
            <Pane padding={10} border="default" borderRadius={8} background="rgba(255,255,255,0.03)">
              <Strong>Stage 4+</Strong>
              <Text size={400} display="block" marginTop={6}>
                {scorecard?.coachingReplay?.stage4 || "No Stage 4 guidance yet."}
              </Text>
            </Pane>
            {coachingBranches.length ? (
              <Pane padding={10} border="default" borderRadius={8} background="rgba(255,255,255,0.03)">
                <Text size={400} color="muted">If/Then Branches</Text>
                <Pane marginTop={6} display="grid" gap={4}>
                  {coachingBranches.map((line, idx) => (
                    <Text key={`branch-${idx}`} size={400}>- {line}</Text>
                  ))}
                </Pane>
              </Pane>
            ) : null}
          </Pane>
        </Card>
      </Pane>

      <Pane display="grid" gridTemplateColumns="repeat(auto-fit, minmax(300px, 1fr))" gap={12}>
        <Card elevation={0} padding={16} background="rgba(255,255,255,0.03)">
          <Heading size={500}>Gift + Econ Coordination</Heading>
          <Pane marginTop={10} display="grid" gap={8}>
            <MetricBar label="Gift ROI" value={giftMetrics.giftROI} color="#2ea66f" />
            <MetricBar label="Item Gift Rate" value={giftMetrics.itemGiftRate} color="#55b6ff" />
            <MetricBar label="Bench Waste Rate" value={giftMetrics.benchWasteRate} color="#bd4b4b" />
            {staggerSuggestions.length ? (
              <Pane padding={10} border="default" borderRadius={8} background="rgba(255,255,255,0.03)">
                <Text size={400} color="muted">Roll Stagger Calls</Text>
                <Pane marginTop={6} display="grid" gap={4}>
                  {staggerSuggestions.map((line, idx) => (
                    <Text key={`stagger-${idx}`} size={400}>- {line}</Text>
                  ))}
                </Pane>
              </Pane>
            ) : null}
          </Pane>
        </Card>

        <Card elevation={0} padding={16} background="rgba(255,255,255,0.03)">
          <Heading size={500}>Opener Intelligence</Heading>
          <Pane marginTop={10} display="grid" gap={8}>
            {openerCards.length ? (
              openerCards.map((opener) => (
                <Pane key={opener.id} padding={10} border="default" borderRadius={8} background="rgba(255,255,255,0.03)">
                  <Pane display="flex" justifyContent="space-between" alignItems="center" gap={8} flexWrap="wrap">
                    <Strong>Patch {opener.patch || "?"}</Strong>
                    <Badge color="neutral">Set {opener.setNumber ?? "?"}</Badge>
                  </Pane>
                  <Pane marginTop={8} display="grid" gap={8}>
                    <Pane>
                      <Text size={400}>{DISPLAY_NAME_A}</Text>
                      <Pane marginTop={6} display="flex" gap={6} flexWrap="wrap">
                        {asArray(opener.playerA).slice(0, 5).map((token) => (
                          <IconWithLabel
                            key={`${opener.id}-a-${token}`}
                            kind="trait"
                            token={token}
                            label={prettyName(token)}
                            size={42}
                            iconManifest={iconManifest}
                          />
                        ))}
                      </Pane>
                    </Pane>
                    <Pane>
                      <Text size={400}>{DISPLAY_NAME_B}</Text>
                      <Pane marginTop={6} display="flex" gap={6} flexWrap="wrap">
                        {asArray(opener.playerB).slice(0, 5).map((token) => (
                          <IconWithLabel
                            key={`${opener.id}-b-${token}`}
                            kind="trait"
                            token={token}
                            label={prettyName(token)}
                            size={42}
                            iconManifest={iconManifest}
                          />
                        ))}
                      </Pane>
                    </Pane>
                  </Pane>
                </Pane>
              ))
            ) : (
              <Text size={400} color="muted">No opener patterns yet.</Text>
            )}
          </Pane>
        </Card>
      </Pane>

      {highlights.length ? (
        <Card elevation={0} padding={16} background="rgba(255,255,255,0.03)">
          <Heading size={500}>Session Highlights</Heading>
          <Pane marginTop={10} display="grid" gap={6}>
            {highlights.slice(0, 8).map((line, idx) => (
              <Text key={`hl-${idx}`} size={400}>- {line}</Text>
            ))}
          </Pane>
        </Card>
      ) : null}

      <Pane display="grid" gridTemplateColumns="repeat(auto-fit, minmax(320px, 1fr))" gap={12}>
        <Card elevation={0} padding={16} background="rgba(255,255,255,0.03)">
          <Heading size={500}>Journal</Heading>
          <Pane marginTop={10} display="grid" gap={10}>
            <Pane>
              <Text size={400}>Match</Text>
              <Select marginTop={6} width="100%" value={coachMatchId} onChange={(e) => setCoachMatchId(e.target.value)}>
                {filteredMatches.map((match) => (
                  <option key={match.id} value={match.id}>
                    {formatTime(match.gameDatetime)} · Set {match.setNumber ?? "?"} · Patch {match.patch || "?"}
                  </option>
                ))}
              </Select>
            </Pane>

            <Pane>
              <Text size={400}>Plan at 3-2</Text>
              <Textarea value={planAt32} onChange={(e) => setPlanAt32(e.target.value)} marginTop={6} minHeight={80} />
            </Pane>

            <Pane>
              <Text size={400}>What actually happened</Text>
              <Textarea value={executedPlan} onChange={(e) => setExecutedPlan(e.target.value)} marginTop={6} minHeight={80} />
            </Pane>

            <Pane display="flex" gap={16} flexWrap="wrap">
              <Checkbox checked={tagPanicRoll} onChange={(e) => setTagPanicRoll(e.target.checked)} label="Panic roll" />
              <Checkbox checked={tagMissedGift} onChange={(e) => setTagMissedGift(e.target.checked)} label="Missed gift" />
              <Checkbox checked={tagBothRoll} onChange={(e) => setTagBothRoll(e.target.checked)} label="Both rolled same stage" />
            </Pane>

            <Pane display="flex" gap={10} alignItems="center" flexWrap="wrap">
              <Button appearance="primary" onClick={submitJournal} disabled={!duoId || coachSaving}>
                Save Journal
              </Button>
              {coachSaving ? <Spinner size={16} /> : null}
            </Pane>
          </Pane>
        </Card>

        <Card elevation={0} padding={16} background="rgba(255,255,255,0.03)">
          <Heading size={500}>Quick Event Logger</Heading>
          <Pane marginTop={10} display="grid" gap={10}>
            <Pane display="flex" gap={10} flexWrap="wrap">
              <Pane>
                <Text size={400}>Stage</Text>
                <TextInput marginTop={6} value={quickStage} onChange={(e) => setQuickStage(e.target.value)} />
              </Pane>
              <Pane>
                <Text size={400}>Actor</Text>
                <Select marginTop={6} value={quickActor} onChange={(e) => setQuickActor(e.target.value)}>
                  <option value="A">{DISPLAY_NAME_A}</option>
                  <option value="B">{DISPLAY_NAME_B}</option>
                </Select>
              </Pane>
            </Pane>

            <Pane display="flex" gap={8} flexWrap="wrap">
              <Button onClick={() => submitQuickEvent("gift_sent")} disabled={!duoId || coachSaving}>Log Gift</Button>
              <Button onClick={() => submitQuickEvent("rescue_arrival")} disabled={!duoId || coachSaving}>Log Rescue</Button>
              <Button onClick={() => submitQuickEvent("roll_down")} disabled={!duoId || coachSaving}>Log Roll Down</Button>
            </Pane>

            <Pane padding={10} border="default" borderRadius={8} background="rgba(255,255,255,0.03)">
              <Text size={300} color="muted">
                More event coverage = stronger dynamic coaching. If guidance feels generic, log more rescue/gift/roll events.
              </Text>
            </Pane>
          </Pane>
        </Card>
      </Pane>

      {coachMessage ? <Alert intent="none" title={coachMessage} /> : null}
    </Pane>
  );
}
