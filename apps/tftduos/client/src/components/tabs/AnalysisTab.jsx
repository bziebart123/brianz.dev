import { useEffect, useMemo, useState } from "react";
import { Card, Heading, Pane, Strong, Text, Tooltip } from "evergreen-ui";
import { DISPLAY_NAME_A, DISPLAY_NAME_B } from "../../config/constants";
import {
  asArray,
  companionArtCandidates,
  estimatedLpDeltaFromTeamPlacement,
  prettyName,
  teamPlacementFromMatch,
  toEpochMs,
} from "../../utils/tft";
import IconWithLabel from "../IconWithLabel";
import MetricBar from "../MetricBar";
import Sparkline from "../Sparkline";
import StatCard from "../StatCard";

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdDev(values) {
  if (!values.length) return 0;
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function topEntries(map, limit = 5) {
  return Object.entries(map)
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit);
}

function kpiTone(value, { higherIsBetter = true, good, bad }) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "neutral";
  if (higherIsBetter) {
    if (numeric >= good) return "good";
    if (numeric <= bad) return "bad";
    return "neutral";
  }
  if (numeric <= good) return "good";
  if (numeric >= bad) return "bad";
  return "neutral";
}

function formatDateLabel(value) {
  const epoch = toEpochMs(value);
  if (!epoch) return "-";
  return new Date(epoch).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function summarizePlayer(matches, key, label, sideKey) {
  const placements = [];
  const damages = [];
  const levels = [];
  const traitCounts = {};
  const unitCounts = {};

  for (const match of matches) {
    const player = match?.[key];
    if (!player) continue;

    placements.push(Number(player.placement || 8));
    damages.push(Number(player.totalDamageToPlayers || 0));
    levels.push(Number(player.level || 0));

    asArray(player.traits)
      .filter((trait) => Number(trait?.style || 0) > 0)
      .forEach((trait) => {
        const name = String(trait.name || "");
        if (!name) return;
        traitCounts[name] = (traitCounts[name] || 0) + 1;
      });

    asArray(player.units).forEach((unit) => {
      const characterId = String(unit.characterId || "");
      if (!characterId) return;
      unitCounts[characterId] = (unitCounts[characterId] || 0) + 1;
    });
  }

  const lowGoldLosses = Number(sideKey?.lowGoldLosses || 0);
  const lowDamageLosses = Number(sideKey?.lowDamageLosses || 0);

  return {
    label,
    games: placements.length,
    avgPlacement: average(placements),
    top4Rate: placements.length ? (placements.filter((value) => value <= 4).length / placements.length) * 100 : 0,
    avgDamage: average(damages),
    avgLevel: average(levels),
    consistency: stdDev(placements),
    lowGoldLosses,
    lowDamageLosses,
    topTraits: topEntries(traitCounts, 4),
    topUnits: topEntries(unitCounts, 6),
    damages,
  };
}

function AnalysisChip({ children, tone = "neutral", tooltip = "" }) {
  const content = (
    <Pane className={`analysis-chip analysis-chip--${tone}`}>
      <Text size={400}>{children}</Text>
    </Pane>
  );
  return tooltip ? <Tooltip content={tooltip}>{content}</Tooltip> : content;
}

function SectionTitle({ title, tooltip }) {
  return (
    <Tooltip content={tooltip}>
      <Heading size={500}>{title}</Heading>
    </Tooltip>
  );
}

function TeamRankChart({ values, startLabel, endLabel }) {
  const width = 960;
  const height = 220;
  const padLeft = 54;
  const padRight = 16;
  const padTop = 20;
  const padBottom = 32;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  if (!values.length) {
    return (
      <Pane border="default" borderRadius={8} padding={12} background="rgba(255,255,255,0.03)">
        <Text size={400} color="muted">No rank trend data yet.</Text>
      </Pane>
    );
  }

  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const padding = Math.max(15, Math.round((maxValue - minValue) * 0.12));
  const yMin = minValue - padding;
  const yMax = maxValue + padding;
  const yRange = Math.max(1, yMax - yMin);
  const step = values.length > 1 ? plotWidth / (values.length - 1) : plotWidth;

  const yForValue = (value) => padTop + ((yMax - value) / yRange) * plotHeight;

  const points = values
    .map((value, index) => {
      const x = padLeft + index * step;
      const y = yForValue(value);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const ticks = Array.from({ length: 5 }, (_, index) => {
    const value = yMax - (index * (yRange / 4));
    return {
      value,
      y: yForValue(value),
    };
  });

  return (
    <Pane border="default" borderRadius={8} padding={8} background="rgba(255,255,255,0.03)">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <text x={8} y={14} fontSize="12" fill="rgba(230,238,255,0.72)">Estimated LP / rank score (cumulative)</text>

        {ticks.map((tick, idx) => (
          <g key={`lp-axis-${idx}`}>
            <line x1={padLeft} y1={tick.y} x2={width - padRight} y2={tick.y} stroke="rgba(177,194,226,0.2)" strokeWidth="1" />
            <text x={padLeft - 10} y={tick.y + 4} textAnchor="end" fontSize="12" fill="rgba(230,238,255,0.8)">
              {Math.round(tick.value)}
            </text>
          </g>
        ))}

        <polyline
          points={points}
          fill="none"
          stroke="rgba(121,195,255,0.95)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <text x={padLeft} y={height - 8} fontSize="12" fill="rgba(230,238,255,0.72)">{startLabel}</text>
        <text x={width - padRight} y={height - 8} textAnchor="end" fontSize="12" fill="rgba(230,238,255,0.72)">{endLabel}</text>
      </svg>
    </Pane>
  );
}

function BlameAvatar({ companion, companionManifest, label }) {
  const companionUrls = useMemo(
    () => companionArtCandidates(companion, companionManifest),
    [companion, companionManifest]
  );
  const urls = useMemo(() => companionUrls, [companionUrls]);
  const [index, setIndex] = useState(0);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    setIndex(0);
    setShowFallback(false);
  }, [companion]);

  function handleError() {
    if (index + 1 < urls.length) {
      setIndex((value) => value + 1);
      return;
    }
    setShowFallback(true);
  }

  return (
    <Pane
      width={48}
      height={48}
      borderRadius={8}
      border="default"
      background="rgba(255,255,255,0.05)"
      overflow="hidden"
      display="grid"
      placeItems="center"
      flexShrink={0}
    >
      {!showFallback && urls[index] ? (
        <img
          src={urls[index]}
          alt={`${label} avatar`}
          onError={handleError}
          width={48}
          height={48}
          style={{ objectFit: "cover", display: "block" }}
        />
      ) : (
        <Text size={500} style={{ fontWeight: 700 }}>{String(label || "?").slice(0, 1)}</Text>
      )}
    </Pane>
  );
}

export default function AnalysisTab({
  kpis,
  computed,
  iconManifest,
  filteredMatches,
  scorecard,
  coachingInsights,
  companionManifest,
}) {
  const sorted = [...filteredMatches].sort((a, b) => toEpochMs(a.gameDatetime) - toEpochMs(b.gameDatetime));
  const teamPlacements = sorted.map((match) => teamPlacementFromMatch(match));
  const rankSeries = [];
  let cumulativeLp = 0;
  for (const placement of teamPlacements) {
    cumulativeLp += estimatedLpDeltaFromTeamPlacement(placement);
    rankSeries.push(cumulativeLp);
  }

  const placementDistribution = [1, 2, 3, 4].map((placement) => {
    const count = teamPlacements.filter((value) => value === placement).length;
    const rate = teamPlacements.length ? (count / teamPlacements.length) * 100 : 0;
    return { placement, count, rate };
  });

  const recentPlacements = teamPlacements.slice(-8);
  const priorPlacements = teamPlacements.slice(-16, -8);
  const recentAvg = average(recentPlacements);
  const priorAvg = average(priorPlacements);
  const momentum = priorPlacements.length ? priorAvg - recentAvg : 0;

  const patchBuckets = {};
  for (const match of filteredMatches) {
    const patch = String(match.patch || "Unknown");
    if (!patchBuckets[patch]) {
      patchBuckets[patch] = {
        patch,
        placements: [],
        top2: 0,
      };
    }
    const placement = teamPlacementFromMatch(match);
    patchBuckets[patch].placements.push(placement);
    if (placement <= 2) patchBuckets[patch].top2 += 1;
  }

  const patchRows = Object.values(patchBuckets)
    .map((row) => ({
      ...row,
      games: row.placements.length,
      avgPlacement: average(row.placements),
      top2Rate: row.placements.length ? (row.top2 / row.placements.length) * 100 : 0,
    }))
    .sort((left, right) => left.avgPlacement - right.avgPlacement || right.games - left.games)
    .slice(0, 5);

  const playerA = summarizePlayer(sorted, "playerA", DISPLAY_NAME_A, coachingInsights?.summary?.a);
  const playerB = summarizePlayer(sorted, "playerB", DISPLAY_NAME_B, coachingInsights?.summary?.b);

  const rescueRate = Number(scorecard?.rescueIndex?.rescueRate || 0);
  const clutchIndex = Number(scorecard?.rescueIndex?.clutchIndex || 0);
  const rescueEvents = Number(scorecard?.rescueIndex?.rescueEvents || 0);
  const totalEvents = Number(scorecard?.rescueIndex?.totalEvents || 0);
  const clutchWins = Number(scorecard?.rescueIndex?.clutchWins || 0);
  const successfulFlips = Number(scorecard?.rescueIndex?.successfulFlips || 0);

  const giftMetrics = scorecard?.giftEfficiency?.metrics || null;
  const giftStatus = String(scorecard?.giftEfficiency?.status || "needs_gift_events");

  const decisionGrade = Number(scorecard?.decisionQuality?.grade || 0);
  const rescueClutchScore =
    rescueEvents > 0
      ? (rescueRate * 0.4) + (clutchIndex * 0.6)
      : Number.NaN;
  const avgTeamDamage = sorted.length
    ? average(
        sorted.map(
          (match) => Number(match?.playerA?.totalDamageToPlayers || 0) + Number(match?.playerB?.totalDamageToPlayers || 0)
        )
      )
    : 0;

  const rangeStart = formatDateLabel(sorted[0]?.gameDatetime);
  const rangeEnd = formatDateLabel(sorted[sorted.length - 1]?.gameDatetime);
  const latestMatch = sorted.length ? sorted[sorted.length - 1] : null;
  const blameProfiles = {
    [DISPLAY_NAME_A]: {
      companion: latestMatch?.playerA?.companion || null,
    },
    [DISPLAY_NAME_B]: {
      companion: latestMatch?.playerB?.companion || null,
    },
  };

  const blameAwards = [
    {
      title: "Placement Liability",
      description: "Higher average placement is worse.",
      metricLabel: "Avg Place",
      a: playerA.avgPlacement,
      b: playerB.avgPlacement,
      higherIsWorse: true,
      format: (value) => value.toFixed(2),
    },
    {
      title: "Variance Goblin",
      description: "Higher placement volatility creates more swingy results.",
      metricLabel: "Consistency (std dev)",
      a: playerA.consistency,
      b: playerB.consistency,
      higherIsWorse: true,
      format: (value) => value.toFixed(2),
    },
    {
      title: "Low-Impact Losses",
      description: "More low-damage losses usually means weak board conversion.",
      metricLabel: "Low dmg losses",
      a: playerA.lowDamageLosses,
      b: playerB.lowDamageLosses,
      higherIsWorse: true,
      format: (value) => String(value),
    },
    {
      title: "Econ Emergency",
      description: "More low-gold losses often means unstable econ management.",
      metricLabel: "Low gold losses",
      a: playerA.lowGoldLosses,
      b: playerB.lowGoldLosses,
      higherIsWorse: true,
      format: (value) => String(value),
    },
    {
      title: "Damage Passenger",
      description: "Lower average damage means less pressure applied in fights.",
      metricLabel: "Avg damage",
      a: playerA.avgDamage,
      b: playerB.avgDamage,
      higherIsWorse: false,
      format: (value) => value.toFixed(1),
    },
  ].map((award) => {
    const a = Number(award.a || 0);
    const b = Number(award.b || 0);
    if (!playerA.games || !playerB.games) {
      return {
        ...award,
        result: "Need more games",
      };
    }
    if (a === b) {
      return {
        ...award,
        loser: null,
        result: `Tie (${playerA.label} ${award.format(a)} | ${playerB.label} ${award.format(b)})`,
      };
    }
    const loser = award.higherIsWorse
      ? (a > b ? playerA.label : playerB.label)
      : (a < b ? playerA.label : playerB.label);
    return {
      ...award,
      loser,
      result: `${loser} (${playerA.label} ${award.format(a)} | ${playerB.label} ${award.format(b)})`,
    };
  });

  return (
    <Pane className="analysis-tab-root" display="grid" gap={12}>
      <Card elevation={0} padding={16} background="rgba(255,255,255,0.03)">
        <Pane display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={10}>
          <Tooltip content="Combined team and individual performance KPIs computed from currently filtered matches and event-derived scorecard metrics.">
            <Heading size={600}>Duo Performance Dashboard</Heading>
          </Tooltip>
          <AnalysisChip tone="neutral" tooltip="Number of matches currently included after timeline/set/patch filters.">
            {filteredMatches.length} games in filter
          </AnalysisChip>
        </Pane>

        <Pane marginTop={12} display="grid" gridTemplateColumns="repeat(auto-fit, minmax(180px, 1fr))" gap={12}>
          <StatCard
            label="Team Avg Place"
            value={kpis.avgTeamPlacement !== null ? kpis.avgTeamPlacement.toFixed(2) : "-"}
            compact
            hideHint
            tone={kpiTone(kpis.avgTeamPlacement, { higherIsBetter: false, good: 2.5, bad: 3.3 })}
            labelTooltip="Average duo team placement across filtered games. Lower is better."
          />
          <StatCard
            label="Team Top 2"
            value={kpis.teamTop2Rate !== null ? `${kpis.teamTop2Rate.toFixed(1)}%` : "-"}
            compact
            hideHint
            tone={kpiTone(kpis.teamTop2Rate, { higherIsBetter: true, good: 45, bad: 30 })}
            labelTooltip="Percent of filtered games where your duo team finishes top 2."
          />
          <StatCard
            label="Team Win Rate"
            value={kpis.teamWinRate !== null ? `${kpis.teamWinRate.toFixed(1)}%` : "-"}
            compact
            hideHint
            tone={kpiTone(kpis.teamWinRate, { higherIsBetter: true, good: 20, bad: 10 })}
            labelTooltip="Percent of filtered games where your duo team finishes #1."
          />
          <StatCard
            label="Avg Team Damage"
            value={filteredMatches.length ? avgTeamDamage.toFixed(1) : "-"}
            compact
            hideHint
            tone={kpiTone(avgTeamDamage, { higherIsBetter: true, good: 130, bad: 95 })}
            labelTooltip="Average combined player damage to opponents (player A + player B)."
          />
          <StatCard
            label="Decision Grade"
            value={decisionGrade ? `${decisionGrade}/100` : "-"}
            compact
            hideHint
            tone={kpiTone(decisionGrade, { higherIsBetter: true, good: 70, bad: 50 })}
            labelTooltip="Composite score from decision-quality heuristics and outcome/process mix."
          />
          <StatCard
            label="Rescue / Clutch"
            value={rescueEvents > 0 ? `${rescueRate.toFixed(1)}% / ${clutchIndex.toFixed(1)}%` : "- / -"}
            compact
            tone={kpiTone(rescueClutchScore, { higherIsBetter: true, good: 30, bad: 15 })}
            hint={
              rescueEvents > 0
                ? `Rescue events ${rescueEvents}/${totalEvents || 0}, clutch wins ${clutchWins}/${rescueEvents}, flips ${successfulFlips}/${rescueEvents}`
                : "No rescue events logged yet."
            }
            labelTooltip="Rescue Rate = rescue_arrival events / all logged events. Clutch Index = stage 4+ successful rescues / rescue_arrival events."
            valueTooltip={`Rescue events: ${rescueEvents}/${totalEvents || 0}. Clutch wins: ${clutchWins}/${rescueEvents || 0}.`}
          />
        </Pane>
      </Card>

      <Card elevation={0} padding={16} background="rgba(255,255,255,0.03)">
        <Pane display="flex" justifyContent="space-between" alignItems="center" gap={8} flexWrap="wrap">
          <SectionTitle
            title="Team Rank Trend"
            tooltip="Estimated cumulative rank trajectory from filtered games using placement-based LP approximation (+35, +20, -15, -30)."
          />
          <Pane display="flex" gap={8} flexWrap="wrap">
            <AnalysisChip tone={momentum >= 0 ? "good" : "bad"} tooltip="Momentum = prior average placement minus recent average placement; positive means trend is improving.">
              Momentum {momentum >= 0 ? "+" : ""}{momentum.toFixed(2)}
            </AnalysisChip>
            <AnalysisChip tone="neutral" tooltip="Average team placement over the most recent 8 games in filter.">
              Recent Avg {recentAvg ? recentAvg.toFixed(2) : "-"}
            </AnalysisChip>
          </Pane>
        </Pane>
        <Pane marginTop={10}>
          <TeamRankChart values={rankSeries} startLabel={rangeStart} endLabel={rangeEnd} />
        </Pane>
      </Card>

      <Pane display="grid" gridTemplateColumns="repeat(auto-fit, minmax(320px, 1fr))" gap={12}>
        <Card elevation={0} padding={16} background="rgba(255,255,255,0.03)">
          <SectionTitle title="Placement Distribution" tooltip="How often your team lands in each final placement bucket (#1 through #4)." />
          <Pane marginTop={10} display="grid" gap={8}>
            {placementDistribution.map((row) => (
              <MetricBar
                key={`placement-${row.placement}`}
                label={`Team #${row.placement} (${row.count})`}
                value={row.rate}
                color={row.placement <= 2 ? "#2ea66f" : row.placement === 3 ? "#c08d3f" : "#bd4b4b"}
              />
            ))}
          </Pane>
        </Card>

        <Card elevation={0} padding={16} background="rgba(255,255,255,0.03)">
          <SectionTitle title="Patch Performance" tooltip="Patch-by-patch results using filtered matches: lower average placement and higher Top2 indicate better patch form." />
          <Pane marginTop={10} display="grid" gap={8}>
            {patchRows.length ? (
              patchRows.map((row) => (
                <Pane key={`patch-${row.patch}`} padding={8} border="default" borderRadius={6}>
                  <Pane display="flex" justifyContent="space-between" alignItems="center" gap={8} flexWrap="wrap">
                    <Strong>Patch {row.patch}</Strong>
                    <AnalysisChip tone="neutral">{row.games} games</AnalysisChip>
                  </Pane>
                  <Pane marginTop={6} display="grid" gridTemplateColumns="1fr 1fr" gap={8}>
                    <Text size={400}>Avg place {row.avgPlacement.toFixed(2)}</Text>
                    <Text size={400}>Top2 {row.top2Rate.toFixed(1)}%</Text>
                  </Pane>
                </Pane>
              ))
            ) : (
              <Text size={400} color="muted">Not enough patch data yet.</Text>
            )}
          </Pane>
        </Card>
      </Pane>

      <Card elevation={0} padding={16} background="rgba(255,255,255,0.03)">
        <SectionTitle
          title="Blame Game"
          tooltip="Worst-stat awards by player across filtered matches. This is intentionally blunt and should be used as a review prompt, not absolute truth."
        />
        <Pane marginTop={10} display="grid" gridTemplateColumns="repeat(auto-fit, minmax(260px, 1fr))" gap={10}>
          {blameAwards.map((award) => (
            <Pane key={award.title} border="default" borderRadius={8} padding={10} background="rgba(255,255,255,0.03)">
              <Pane display="flex" alignItems="center" gap={10}>
                {award.loser ? (
                  <BlameAvatar
                    companion={blameProfiles[award.loser]?.companion}
                    companionManifest={companionManifest}
                    label={award.loser}
                  />
                ) : (
                  <Pane width={48} height={48} />
                )}
                <Pane>
                  <Strong>{award.title}</Strong>
                  <Text size={300} display="block" marginTop={4} color="muted">{award.description}</Text>
                </Pane>
              </Pane>
              <Text size={400} display="block" marginTop={8}>{award.metricLabel}: {award.result}</Text>
            </Pane>
          ))}
        </Pane>
      </Card>

      <Card elevation={0} padding={16} background="rgba(255,255,255,0.03)">
        <SectionTitle title="Meta Pressure" tooltip="What your lobbies are playing most often; use this to plan uncontested lines and pivots." />
        <Pane marginTop={10}>
          <Text size={400} color="muted">Most common traits in your lobbies</Text>
          <Pane marginTop={8} display="flex" flexWrap="wrap" gap={8}>
            {computed.metaTraits.length ? (
              computed.metaTraits.slice(0, 8).map((trait) => (
                <IconWithLabel
                  key={trait.name}
                  kind="trait"
                  token={trait.name}
                  label={prettyName(trait.name)}
                  count={trait.count}
                  traitTier={trait.style}
                  size={58}
                  iconManifest={iconManifest}
                />
              ))
            ) : (
              <Text size={400} color="muted">No trait trend yet.</Text>
            )}
          </Pane>
        </Pane>

        <Pane marginTop={12}>
          <Text size={400} color="muted">Most common units in your lobbies</Text>
          <Pane marginTop={8} display="flex" flexWrap="wrap" gap={8}>
            {computed.metaUnits.length ? (
              computed.metaUnits.slice(0, 10).map((unit) => (
                <IconWithLabel
                  key={unit.characterId}
                  kind="unit"
                  token={unit.characterId}
                  label={prettyName(unit.characterId)}
                  count={unit.count}
                  size={52}
                  iconManifest={iconManifest}
                />
              ))
            ) : (
              <Text size={400} color="muted">No unit trend yet.</Text>
            )}
          </Pane>
        </Pane>

        <Pane marginTop={12} display="grid" gap={6}>
          {computed.suggestions.length ? (
            computed.suggestions.slice(0, 4).map((item, index) => (
              <Tooltip key={`suggestion-${index}`} content="Client-side extrapolated recommendation from filtered outcome + lobby trend signals.">
                <Text size={400}>- {item}</Text>
              </Tooltip>
            ))
          ) : (
            <Text size={400} color="muted">No strong macro signal yet.</Text>
          )}
        </Pane>
      </Card>

      <Pane className="analysis-player-grid" display="grid" gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap={12}>
        {[playerA, playerB].map((player) => (
          <Card key={player.label} elevation={0} padding={16} background="rgba(255,255,255,0.03)">
            <Tooltip content="Player-specific profile derived from filtered match outcomes and in-match stat aggregates.">
              <Heading size={500}>{player.label} Breakdown</Heading>
            </Tooltip>
            <Pane marginTop={10} display="grid" gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap={8}>
              <Tooltip content="Average final placement for this player in filtered games."><Text size={400}>Avg Place: {player.games ? player.avgPlacement.toFixed(2) : "-"}</Text></Tooltip>
              <Tooltip content="Percent of filtered games with this player finishing top 4."><Text size={400}>Top4: {player.games ? `${player.top4Rate.toFixed(1)}%` : "-"}</Text></Tooltip>
              <Tooltip content="Average player damage dealt to opponents per game."><Text size={400}>Avg Damage: {player.avgDamage.toFixed(1)}</Text></Tooltip>
              <Tooltip content="Average level reached by this player."><Text size={400}>Avg Level: {player.avgLevel.toFixed(2)}</Text></Tooltip>
              <Tooltip content="Placement standard deviation for this player; lower is more stable."><Text size={400}>Consistency: {player.consistency.toFixed(2)}</Text></Tooltip>
              <Tooltip content="Losses where this player had low resource/damage stress signals."><Text size={400}>Low-resource losses: {player.lowGoldLosses + player.lowDamageLosses}</Text></Tooltip>
            </Pane>

            <Pane marginTop={12}>
              <Tooltip content="Player damage time-series across filtered games (oldest to latest).">
                <Text size={400} color="muted">Damage Trend</Text>
              </Tooltip>
              <Pane marginTop={6}>
                <Sparkline values={player.damages} height={64} responsive canvasWidth={520} />
              </Pane>
              <Pane marginTop={4} display="flex" justifyContent="space-between">
                <Text size={300} color="muted">{rangeStart}</Text>
                <Text size={300} color="muted">{rangeEnd}</Text>
              </Pane>
            </Pane>

            <Pane marginTop={12}>
              <Text size={400} color="muted">Top Traits</Text>
              <Pane marginTop={8} display="flex" flexWrap="wrap" gap={8}>
                {player.topTraits.length ? (
                  player.topTraits.map(([trait, count]) => (
                    <IconWithLabel
                      key={`${player.label}-trait-${trait}`}
                      kind="trait"
                      token={trait}
                      label={prettyName(trait)}
                      count={count}
                      size={52}
                      iconManifest={iconManifest}
                    />
                  ))
                ) : (
                  <Text size={400} color="muted">No trait data</Text>
                )}
              </Pane>
            </Pane>

            <Pane marginTop={12}>
              <Text size={400} color="muted">Top Units</Text>
              <Pane marginTop={8} display="flex" flexWrap="wrap" gap={8}>
                {player.topUnits.length ? (
                  player.topUnits.map(([unit, count]) => (
                    <IconWithLabel
                      key={`${player.label}-unit-${unit}`}
                      kind="unit"
                      token={unit}
                      label={prettyName(unit)}
                      count={count}
                      size={48}
                      iconManifest={iconManifest}
                    />
                  ))
                ) : (
                  <Text size={400} color="muted">No unit data</Text>
                )}
              </Pane>
            </Pane>
          </Card>
        ))}
      </Pane>

      <Card elevation={0} padding={16} background="rgba(255,255,255,0.03)">
        <SectionTitle
          title="Gift Intelligence"
          tooltip="Gift metrics come from logged gift_sent events (manual/event tracker ingestion), not directly from Riot match payload."
        />
        <Pane marginTop={10} display="grid" gap={8}>
          {giftStatus === "ok" && giftMetrics ? (
            <Pane display="grid" gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap={8}>
              <MetricBar label="Early Gift Rate" value={giftMetrics.earlyGiftRate} color="#55b6ff" />
              <MetricBar label="Item Gift Rate" value={giftMetrics.itemGiftRate} color="#7ad27a" />
              <MetricBar label="Gift ROI" value={giftMetrics.giftROI} color="#2ea66f" />
              <MetricBar label="Bench Waste Rate" value={giftMetrics.benchWasteRate} color="#bd4b4b" />
            </Pane>
          ) : (
            <Text size={400} color="muted">
              No gift events ingested yet. Current Riot payload does not expose gift sender/receiver or item/champion gift events directly.
              To get team and individual gift analysis, keep logging `gift_sent` events with actor slot and payload tags.
            </Text>
          )}
        </Pane>
      </Card>
    </Pane>
  );
}
