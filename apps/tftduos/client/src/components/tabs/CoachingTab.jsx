import { useEffect, useState } from "react";
import { Badge, Button, Card, Heading, Pane, Strong, Text, Tooltip } from "evergreen-ui";
import IconWithLabel from "../IconWithLabel";
import { DISPLAY_NAME_A, DISPLAY_NAME_B } from "../../config/constants";
import { asArray, prettyName } from "../../utils/tft";

const MOBILE_BREAKPOINT = 1024;
const AI_STREAM_SPEED_MS = {
  cache: 120,
  fresh: 520,
};
const AI_TERMINAL_BOOT_LINES = [
  "Initializing duo coaching terminal...",
  "Syncing filtered duo match timeline...",
  "Profiling pressure leaks + econ pivots...",
  "Running model inference for ranked climb plan...",
  "Compiling GPT coaching suggestions...",
];

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

function normalizeMentionLabel(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeModelText(value) {
  return String(value || "").replace(/\btft\d+_[a-z0-9_]+\b/gi, (token) => prettyName(token));
}

function isWordChar(char) {
  return /[a-z0-9]/i.test(char);
}

function isBoundary(text, start, length) {
  const before = start <= 0 ? "" : text[start - 1];
  const after = start + length >= text.length ? "" : text[start + length];
  return (!before || !isWordChar(before)) && (!after || !isWordChar(after));
}

function buildMentionCatalog(filteredMatches, aiCoaching) {
  const traitStyleByToken = new Map();
  const seenMentions = new Set();
  const mentions = [];

  const addMention = ({ kind, token, alias, traitTier = null }) => {
    const normalizedAlias = normalizeMentionLabel(alias);
    if (!normalizedAlias || normalizedAlias.length < 3) return;
    const key = `${kind}:${token}:${normalizedAlias}`;
    if (seenMentions.has(key)) return;
    seenMentions.add(key);
    mentions.push({
      kind,
      token,
      alias: normalizedAlias,
      label: prettyName(token),
      traitTier,
    });
  };

  for (const match of asArray(filteredMatches)) {
    const players = [match?.playerA, match?.playerB];
    for (const player of players) {
      for (const trait of asArray(player?.traits).filter((entry) => Number(entry?.style || 0) > 0)) {
        const token = String(trait?.name || "");
        if (!token) continue;
        const tier = Number(trait?.style || 0);
        traitStyleByToken.set(token, Math.max(Number(traitStyleByToken.get(token) || 0), tier));
      }

      for (const unit of asArray(player?.units)) {
        const token = String(unit?.characterId || "");
        if (!token) continue;
        addMention({ kind: "unit", token, alias: prettyName(token) });
        addMention({ kind: "unit", token, alias: token });
      }
    }
  }

  for (const [token, tier] of traitStyleByToken.entries()) {
    addMention({ kind: "trait", token, alias: prettyName(token), traitTier: tier });
    addMention({ kind: "trait", token, alias: token, traitTier: tier });
  }

  for (const build of asArray(aiCoaching?.brief?.championBuilds)) {
    const token = String(build?.champion || "");
    if (!token) continue;
    addMention({ kind: "unit", token, alias: prettyName(token) });
    addMention({ kind: "unit", token, alias: token });
  }

  return mentions.sort((left, right) => right.alias.length - left.alias.length);
}

function splitTextByMentions(text, mentions) {
  const source = String(text || "");
  if (!source || !mentions.length) return [{ type: "text", value: source }];

  const lowerSource = source.toLowerCase();
  const output = [];
  let cursor = 0;

  while (cursor < source.length) {
    let best = null;
    for (const mention of mentions) {
      const index = lowerSource.indexOf(mention.alias, cursor);
      if (index < 0) continue;
      if (!isBoundary(lowerSource, index, mention.alias.length)) continue;
      if (!best || index < best.index || (index === best.index && mention.alias.length > best.mention.alias.length)) {
        best = { index, mention };
      }
    }

    if (!best) {
      output.push({ type: "text", value: source.slice(cursor) });
      break;
    }

    if (best.index > cursor) {
      output.push({ type: "text", value: source.slice(cursor, best.index) });
    }

    output.push({ type: "mention", mention: best.mention });
    cursor = best.index + best.mention.alias.length;
  }

  return output.filter((segment) => (segment.type === "text" ? segment.value.length > 0 : true));
}

function InlineThinking({ label = "thinking" }) {
  return (
    <span className="coaching-inline-loader" role="status" aria-live="polite">
      {label}
      <span className="coaching-inline-loader-dots" aria-hidden="true" />
    </span>
  );
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
  filteredMatches,
  iconManifest,
  rankContext,
}) {
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= MOBILE_BREAKPOINT : false
  );
  const [visibleBootLines, setVisibleBootLines] = useState(1);
  const [visibleAiLines, setVisibleAiLines] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    function onResize() {
      setIsMobileViewport(window.innerWidth <= MOBILE_BREAKPOINT);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const gptLineTextSize = 300;
  const gptIconSize = isMobileViewport ? 18 : 22;
  const placements = asArray(placementTrend).map((value) => Number(value || 0)).filter((value) => value > 0);
  const top2Rate = pct(placements.filter((value) => value <= 2).length, placements.length);
  const winRate = pct(placements.filter((value) => value <= 1).length, placements.length);
  const dynamicSignal = clamp(
    Math.round(((decisionGrade || 0) * 0.42) + ((100 - duoRisk) * 0.33) + (top2Rate * 0.25))
  );

  const regionalTraits = asArray(rankContext?.ladderMeta?.topTraits).slice(0, 4);
  const regionalChamps = asArray(rankContext?.ladderMeta?.topChampions).slice(0, 6);

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
  const mentionCatalog = buildMentionCatalog(filteredMatches, aiCoaching);
  const isAiPending = aiCoachingLoading || (!aiCoaching && !aiCoachingError);
  const totalAiLines = aiCoaching?.brief
    ? 2
      + asArray(aiCoaching?.brief?.teamPlan).slice(0, 4).length
      + asArray(aiCoaching?.brief?.metaDelta).slice(0, 4).length
      + asArray(aiCoaching?.brief?.topImprovementAreas).slice(0, 4).length
      + asArray(aiCoaching?.brief?.winConditions).slice(0, 4).length
      + asArray(aiCoaching?.brief?.fiveGamePlan).slice(0, 5).length
      + asArray(aiCoaching?.brief?.championBuilds).slice(0, 6).length
    : 0;

  useEffect(() => {
    if (!isAiPending) {
      setVisibleBootLines(AI_TERMINAL_BOOT_LINES.length);
      return undefined;
    }

    setVisibleBootLines(1);
    let cursor = 1;
    const timer = window.setInterval(() => {
      cursor += 1;
      setVisibleBootLines(Math.min(cursor, AI_TERMINAL_BOOT_LINES.length));
      if (cursor >= AI_TERMINAL_BOOT_LINES.length) {
        window.clearInterval(timer);
      }
    }, 520);

    return () => window.clearInterval(timer);
  }, [isAiPending]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (!aiCoaching?.brief || !totalAiLines) {
      setVisibleAiLines(0);
      return undefined;
    }
    if (process.env.NODE_ENV === "test") {
      setVisibleAiLines(totalAiLines);
      return undefined;
    }

    const intervalMs = aiCoaching?.cacheHit ? AI_STREAM_SPEED_MS.cache : AI_STREAM_SPEED_MS.fresh;
    setVisibleAiLines(1);
    let cursor = 1;
    const timer = window.setInterval(() => {
      cursor += 1;
      setVisibleAiLines(Math.min(cursor, totalAiLines));
      if (cursor >= totalAiLines) {
        window.clearInterval(timer);
      }
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [aiCoaching?.brief, aiCoaching?.cacheHit, totalAiLines]);

  function withLineBudget(lines, budgetStart) {
    const source = asArray(lines);
    const visibleCount = Math.max(0, Math.min(source.length, visibleAiLines - budgetStart));
    return source.slice(0, visibleCount);
  }

  const teamPlanLines = asArray(aiCoaching?.brief?.teamPlan).slice(0, 4);
  const metaDeltaLines = asArray(aiCoaching?.brief?.metaDelta).slice(0, 4);
  const improveLines = asArray(aiCoaching?.brief?.topImprovementAreas).slice(0, 4);
  const winConditionLines = asArray(aiCoaching?.brief?.winConditions).slice(0, 4);
  const plan5Lines = asArray(aiCoaching?.brief?.fiveGamePlan).slice(0, 5);
  const championBuildRows = asArray(aiCoaching?.brief?.championBuilds).slice(0, 6);

  const teamPlanOffset = 2;
  const metaDeltaOffset = teamPlanOffset + teamPlanLines.length;
  const improveOffset = metaDeltaOffset + metaDeltaLines.length;
  const winOffset = improveOffset + improveLines.length;
  const plan5Offset = winOffset + winConditionLines.length;
  const championOffset = plan5Offset + plan5Lines.length;

  function renderLineWithIcons(text, key) {
    const segments = splitTextByMentions(sanitizeModelText(text), mentionCatalog);
    return (
      <Pane key={key} className="coaching-gpt-line" display="flex" alignItems="center" gap={6} flexWrap="wrap">
        {segments.map((segment, idx) =>
          segment.type === "mention" ? (
            <IconWithLabel
              key={`${key}-mention-${idx}-${segment.mention.kind}-${segment.mention.token}`}
              kind={segment.mention.kind}
              token={segment.mention.token}
              label={segment.mention.label}
              size={gptIconSize}
              iconManifest={segment.mention.kind === "trait" ? iconManifest : null}
              traitTier={segment.mention.traitTier}
            />
          ) : (
            <Text key={`${key}-text-${idx}`} size={gptLineTextSize}>
              {segment.value}
            </Text>
          )
        )}
      </Pane>
    );
  }

  if (isAiPending) {
    return (
      <Pane className="coaching-tab-root" display="grid" gap={12}>
        <Card className="coaching-terminal-shell" elevation={0} padding={0} background="transparent" minHeight={420}>
          <Pane className="coaching-terminal-head" display="flex" alignItems="center" justifyContent="space-between" gap={12}>
            <Text size={300}>ai-coach://duo-terminal</Text>
            <Badge color="blue">THINKING</Badge>
          </Pane>
          <Pane className="coaching-terminal-body" display="grid" gap={8}>
            {AI_TERMINAL_BOOT_LINES.slice(0, visibleBootLines).map((line, idx) => (
              <Text key={`ai-terminal-line-${idx}`} className="coaching-terminal-line" size={gptLineTextSize}>
                {`> ${line}`}
              </Text>
            ))}
            <Text size={gptLineTextSize} className="coaching-terminal-line">
              {"> waiting for GPT response "}
              <InlineThinking label="loading" />
            </Text>
            <Text size={gptLineTextSize} className="coaching-terminal-line">
              Generating AI coaching...
            </Text>
            <Text size={gptLineTextSize} className="coaching-terminal-line">
              Loading the full coaching page once GPT analysis is ready.
            </Text>
          </Pane>
          <Pane className="coaching-terminal-prompt">
            <Text size={300}>
              coach@duos:~$ awaiting payload <InlineThinking />
            </Text>
          </Pane>
        </Card>
      </Pane>
    );
  }

  return (
    <Pane className="coaching-tab-root" display="grid" gap={12}>
      <Card className="coaching-terminal-shell" elevation={0} padding={0} background="transparent">
        <Pane className="coaching-terminal-head" display="flex" alignItems="center" justifyContent="space-between" gap={10} flexWrap="wrap">
          <Pane display="flex" alignItems="center" gap={8}>
            <Tooltip content="AI-first coaching dashboard with compact high-signal KPIs.">
              <Heading size={600}>Duo Coaching Console</Heading>
            </Tooltip>
            {aiCoaching?.fallback ? <Badge color="yellow">Fallback</Badge> : <Badge color="green">Live LLM</Badge>}
            {aiCoaching?.webSearchUsed ? <Badge color="blue">Web Meta</Badge> : null}
          </Pane>
          <Pane display="flex" alignItems="center" gap={8} flexWrap="wrap">
            <Badge color={toneForRisk(duoRisk)}>Duo Risk {duoRisk}%</Badge>
            <Badge color={dynamicSignal >= 70 ? "green" : dynamicSignal >= 50 ? "yellow" : "red"}>Dynamic Signal {dynamicSignal}</Badge>
            <Badge color="blue">{String(rankContext?.platform || "-").toUpperCase()}</Badge>
            {aiCoaching?.model ? <Badge color="neutral">{aiCoaching.model}</Badge> : null}
            <Button className="tft-cta-btn" onClick={() => loadAiCoaching(true)} disabled={aiCoachingLoading}>
              {aiCoachingLoading ? "Generating..." : "Refresh AI"}
            </Button>
          </Pane>
        </Pane>

        <Pane className="coaching-terminal-body" display="grid" gap={8}>
          <Text size={300} className="coaching-terminal-line">{"> boot // duo telemetry + ai modules loaded"}</Text>
          <Text size={300} className="coaching-terminal-line">{"> ============================================================"}</Text>
          <Text size={300} className="coaching-terminal-line">{"> [DUO KPIS]"}</Text>
          <Text size={gptLineTextSize} className="coaching-terminal-line"><Strong>Decision Grade</Strong>: {decisionGrade}/100</Text>
          <Text size={gptLineTextSize} className="coaching-terminal-line"><Strong>Team Top2 Rate</Strong>: {top2Rate.toFixed(1)}%</Text>
          <Text size={gptLineTextSize} className="coaching-terminal-line"><Strong>Team Win Rate</Strong>: {winRate.toFixed(1)}%</Text>
          <Text size={gptLineTextSize} className="coaching-terminal-line"><Strong>Rescue / Clutch</Strong>: {rescueRate.toFixed(1)}% / {clutchIndex.toFixed(1)}%</Text>

          <Text size={300} className="coaching-terminal-line">{"> ------------------------------------------------------------"}</Text>
          <Text size={300} className="coaching-terminal-line">{"> [REGIONAL META PRESSURE]"}</Text>
          <Text size={gptLineTextSize} className="coaching-terminal-line">
            Apex ladder sample: {Number(rankContext?.queuePopulation?.apexPopulation?.total || 0)} players | Snapshot {rankContext?.snapshotAt ? formatGeneratedTime(Date.parse(rankContext.snapshotAt)) : "unknown"}
          </Text>
          <Pane display="grid" gridTemplateColumns="repeat(auto-fit, minmax(260px, 1fr))" gap={10}>
            <Pane>
              <Text size={400} color="muted" className="coaching-terminal-line"><Strong>Most Pressured Traits</Strong></Text>
              <Pane marginTop={6} display="flex" flexWrap="wrap" gap={6}>
                {regionalTraits.length ? regionalTraits.map((trait) => (
                  <IconWithLabel
                    key={`coach-regional-trait-${trait.name}`}
                    kind="trait"
                    token={trait.name}
                    label={prettyName(trait.name)}
                    count={trait.count}
                    size={20}
                    iconManifest={iconManifest}
                  />
                )) : <Text size={300} color="muted">No trait snapshot.</Text>}
              </Pane>
            </Pane>
            <Pane>
              <Text size={400} color="muted" className="coaching-terminal-line"><Strong>Most Pressured Champions</Strong></Text>
              <Pane marginTop={6} display="flex" flexWrap="wrap" gap={6}>
                {regionalChamps.length ? regionalChamps.map((unit) => (
                  <IconWithLabel
                    key={`coach-regional-unit-${unit.characterId}`}
                    kind="unit"
                    token={unit.characterId}
                    label={prettyName(unit.characterId)}
                    count={unit.count}
                    size={20}
                    iconManifest={iconManifest}
                  />
                )) : <Text size={300} color="muted">No champion snapshot.</Text>}
              </Pane>
            </Pane>
          </Pane>

          <Text size={300} className="coaching-terminal-line">{"> ------------------------------------------------------------"}</Text>
          <Text size={300} className="coaching-terminal-line">{"> [AI COACH BRIEF]"}</Text>
          {aiCoachingLoading ? (
            <Text size={300} className="coaching-terminal-line">
              {"> waiting for updated model response "}
              <InlineThinking />
            </Text>
          ) : null}
          {aiCoachingError ? (
            <Pane className="tft-error-banner" marginTop={4}>
              <Strong>AI Coach Error</Strong>
              <Text size={400} display="block" marginTop={4}>{aiCoachingError}</Text>
            </Pane>
          ) : null}

          {aiCoaching?.brief ? (
            <Pane display="grid" gap={6}>
              {visibleAiLines >= 1 ? <Text size={gptLineTextSize} className="coaching-terminal-line"><Strong>{sanitizeModelText(aiCoaching.brief.headline || "AI Coaching Brief")}</Strong></Text> : null}
              {visibleAiLines >= 2 ? <Pane>{renderLineWithIcons(aiCoaching.brief.summary || "No summary returned.", "ai-summary")}</Pane> : null}
              <Text size={300} color="muted" display="block" className="coaching-terminal-line">
                Confidence: {aiCoaching.brief.confidence || "unknown"}
                {aiCoaching?.reason ? ` | ${aiCoaching.reason}` : ""}
                {` | Generated ${formatGeneratedTime(aiCoaching?.generatedAt)}`}
              </Text>

              {teamPlanLines.length ? (
                <Pane display="grid" gap={4}>
                  <Text size={gptLineTextSize} className="coaching-terminal-line"><Strong>Team Actions</Strong></Text>
                  {withLineBudget(teamPlanLines, teamPlanOffset).map((line, idx) => (
                    <Pane key={`ai-team-${idx}`} display="flex" alignItems="flex-start" gap={6}>
                      <Text size={gptLineTextSize}>-</Text>
                      {renderLineWithIcons(line, `ai-team-line-${idx}`)}
                    </Pane>
                  ))}
                </Pane>
              ) : null}

              {metaDeltaLines.length ? (
                <Pane display="grid" gap={4}>
                  <Text size={gptLineTextSize} className="coaching-terminal-line"><Strong>Meta vs Your Builds</Strong></Text>
                  {withLineBudget(metaDeltaLines, metaDeltaOffset).map((line, idx) => (
                    <Pane key={`ai-meta-delta-${idx}`} display="flex" alignItems="flex-start" gap={6}>
                      <Text size={gptLineTextSize}>-</Text>
                      {renderLineWithIcons(line, `ai-meta-delta-line-${idx}`)}
                    </Pane>
                  ))}
                </Pane>
              ) : null}

              {improveLines.length ? (
                <Pane display="grid" gap={4}>
                  <Text size={gptLineTextSize} className="coaching-terminal-line"><Strong>Top Improvement Areas</Strong></Text>
                  {withLineBudget(improveLines, improveOffset).map((line, idx) => (
                    <Pane key={`ai-improve-${idx}`} display="flex" alignItems="flex-start" gap={6}>
                      <Text size={gptLineTextSize}>-</Text>
                      {renderLineWithIcons(line, `ai-improve-line-${idx}`)}
                    </Pane>
                  ))}
                </Pane>
              ) : null}

              {winConditionLines.length ? (
                <Pane display="grid" gap={4}>
                  <Text size={gptLineTextSize} className="coaching-terminal-line"><Strong>Win Conditions</Strong></Text>
                  {withLineBudget(winConditionLines, winOffset).map((line, idx) => (
                    <Pane key={`ai-wincon-${idx}`} display="flex" alignItems="flex-start" gap={6}>
                      <Text size={gptLineTextSize}>-</Text>
                      {renderLineWithIcons(line, `ai-wincon-line-${idx}`)}
                    </Pane>
                  ))}
                </Pane>
              ) : null}

              {plan5Lines.length ? (
                <Pane display="grid" gap={4}>
                  <Text size={gptLineTextSize} className="coaching-terminal-line"><Strong>Next 5 Games Plan</Strong></Text>
                  {withLineBudget(plan5Lines, plan5Offset).map((line, idx) => (
                    <Pane key={`ai-plan5-${idx}`} display="flex" alignItems="flex-start" gap={6}>
                      <Text size={gptLineTextSize}>-</Text>
                      {renderLineWithIcons(line, `ai-plan5-line-${idx}`)}
                    </Pane>
                  ))}
                </Pane>
              ) : null}

              {championBuildRows.length ? (
                <Pane display="grid" gap={6}>
                  <Text size={gptLineTextSize} className="coaching-terminal-line"><Strong>Champion Build Signals</Strong></Text>
                  {withLineBudget(championBuildRows, championOffset).map((row, idx) => (
                    <Pane key={`ai-build-${idx}`} display="grid" gap={2}>
                      <Pane display="flex" alignItems="center" gap={8} flexWrap="wrap">
                        <Strong>{row.player}</Strong>
                        <Text size={gptLineTextSize}>-</Text>
                        <IconWithLabel kind="unit" token={row.champion} label={prettyName(row.champion)} size={gptIconSize} />
                        {asArray(row.items).length ? <Text size={gptLineTextSize}>| {asArray(row.items).join(", ")}</Text> : null}
                      </Pane>
                      <Text size={300} color="muted" display="block">
                        {Number(row.top2Rate || 0).toFixed(1)}% Top2 over {Number(row.games || 0)} games
                        {row.note ? ` | ${sanitizeModelText(row.note)}` : ""}
                      </Text>
                    </Pane>
                  ))}
                </Pane>
              ) : null}
            </Pane>
          ) : (
            <Text size={400} color="muted" display="block">No AI brief yet. Use Refresh AI.</Text>
          )}

          <Text size={300} className="coaching-terminal-line">{"> ------------------------------------------------------------"}</Text>
          <Text size={300} className="coaching-terminal-line">{"> [INDIVIDUAL ACTION PLANS]"}</Text>
          <Pane display="grid" gap={8}>
            {playerPlans.map((plan, idx) => (
              <Pane key={`${plan.player}-${idx}`} display="grid" gap={4}>
                <Pane display="flex" alignItems="center" gap={8} flexWrap="wrap">
                  <Strong>{plan.player}</Strong>
                  {Number.isFinite(plan.pressure) ? (
                    <Badge color={plan.pressure >= 5 ? "red" : plan.pressure >= 3 ? "yellow" : "green"}>Pressure {plan.pressure}</Badge>
                  ) : null}
                </Pane>
                <Text size={gptLineTextSize} display="block">Focus: {sanitizeModelText(plan.focus || "n/a")}</Text>
                <Pane display="grid" gap={4}>
                  {asArray(plan.actions).slice(0, 3).map((line, actionIdx) => (
                    <Pane key={`${plan.player}-action-${actionIdx}`} display="flex" alignItems="flex-start" gap={6}>
                      <Text size={gptLineTextSize}>-</Text>
                      {renderLineWithIcons(line, `${plan.player}-action-line-${actionIdx}`)}
                    </Pane>
                  ))}
                </Pane>
              </Pane>
            ))}
          </Pane>
        </Pane>

        <Pane className="coaching-terminal-prompt">
          <Text size={300}>
            coach@duos:~$ {aiCoachingLoading ? <InlineThinking label="thinking" /> : "briefing-ready"}
          </Text>
        </Pane>
      </Card>
    </Pane>
  );
}