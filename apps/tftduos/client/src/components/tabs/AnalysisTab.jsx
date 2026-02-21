import { Card, Heading, Pane, Strong, Text } from "evergreen-ui";
import { DISPLAY_NAME_A, DISPLAY_NAME_B } from "../../config/constants";
import { asArray, prettyName, teamPlacementFromMatch, toEpochMs } from "../../utils/tft";
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

function AnalysisChip({ children, tone = "neutral" }) {
  return (
    <Pane className={`analysis-chip analysis-chip--${tone}`}>
      <Text size={400}>{children}</Text>
    </Pane>
  );
}

function TeamPlacementChart({ values }) {
  const width = 960;
  const height = 210;
  const padLeft = 46;
  const padRight = 16;
  const padTop = 14;
  const padBottom = 28;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  if (!values.length) {
    return (
      <Pane border="default" borderRadius={8} padding={12} background="rgba(255,255,255,0.03)">
        <Text size={400} color="muted">No placement data yet.</Text>
      </Pane>
    );
  }

  const minPlacement = 1;
  const maxPlacement = 4;
  const step = values.length > 1 ? plotWidth / (values.length - 1) : plotWidth;
  const yForPlacement = (placement) => {
    const normalized = (placement - minPlacement) / (maxPlacement - minPlacement || 1);
    return padTop + normalized * plotHeight;
  };

  const points = values
    .map((value, index) => {
      const x = padLeft + index * step;
      const clamped = Math.max(minPlacement, Math.min(maxPlacement, Number(value || 4)));
      const y = yForPlacement(clamped);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <Pane border="default" borderRadius={8} padding={8} background="rgba(255,255,255,0.03)">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {[1, 2, 3, 4].map((placement) => {
          const y = yForPlacement(placement);
          return (
            <g key={`axis-${placement}`}>
              <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="rgba(177,194,226,0.2)" strokeWidth="1" />
              <text x={padLeft - 10} y={y + 4} textAnchor="end" fontSize="12" fill="rgba(230,238,255,0.8)">
                #{placement}
              </text>
            </g>
          );
        })}

        <polyline
          points={points}
          fill="none"
          stroke="rgba(121,195,255,0.95)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <text x={padLeft} y={height - 8} fontSize="12" fill="rgba(230,238,255,0.72)">Oldest</text>
        <text x={width - padRight} y={height - 8} textAnchor="end" fontSize="12" fill="rgba(230,238,255,0.72)">Latest</text>
      </svg>
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
}) {
  const sorted = [...filteredMatches].sort((a, b) => toEpochMs(a.gameDatetime) - toEpochMs(b.gameDatetime));
  const teamPlacements = sorted.map((match) => teamPlacementFromMatch(match));

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

  const decisionGrade = Number(scorecard?.decisionQuality?.grade || 0);
  const rescueRate = Number(scorecard?.rescueIndex?.rescueRate || 0);
  const clutchIndex = Number(scorecard?.rescueIndex?.clutchIndex || 0);

  return (
    <Pane className="analysis-tab-root" display="grid" gap={12}>
      <Card elevation={0} padding={16} background="rgba(255,255,255,0.03)">
        <Pane display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={10}>
          <Heading size={600}>Duo Performance Dashboard</Heading>
          <AnalysisChip tone="neutral">{filteredMatches.length} games in filter</AnalysisChip>
        </Pane>

        <Pane marginTop={12} display="grid" gridTemplateColumns="repeat(auto-fit, minmax(180px, 1fr))" gap={12}>
          <StatCard label="Team Avg Place" value={kpis.avgTeamPlacement !== null ? kpis.avgTeamPlacement.toFixed(2) : "-"} compact hideHint />
          <StatCard label="Team Top 2" value={kpis.teamTop2Rate !== null ? `${kpis.teamTop2Rate.toFixed(1)}%` : "-"} compact hideHint />
          <StatCard label="Team Win Rate" value={kpis.teamWinRate !== null ? `${kpis.teamWinRate.toFixed(1)}%` : "-"} compact hideHint />
          <StatCard label="Placement Volatility" value={teamPlacements.length ? stdDev(teamPlacements).toFixed(2) : "-"} compact hideHint />
          <StatCard label="Decision Grade" value={decisionGrade ? `${decisionGrade}/100` : "-"} compact hideHint />
          <StatCard label="Rescue / Clutch" value={`${rescueRate.toFixed(0)}% / ${clutchIndex.toFixed(0)}%`} compact hideHint />
        </Pane>
      </Card>

      <Card elevation={0} padding={16} background="rgba(255,255,255,0.03)">
        <Pane display="flex" justifyContent="space-between" alignItems="center" gap={8} flexWrap="wrap">
          <Heading size={500}>Team Placement Trend</Heading>
          <Pane display="flex" gap={8} flexWrap="wrap">
            <AnalysisChip tone={momentum >= 0 ? "good" : "bad"}>
              Momentum {momentum >= 0 ? "+" : ""}{momentum.toFixed(2)}
            </AnalysisChip>
            <AnalysisChip tone="neutral">Recent Avg {recentAvg ? recentAvg.toFixed(2) : "-"}</AnalysisChip>
          </Pane>
        </Pane>
        <Pane marginTop={10}>
          <TeamPlacementChart values={teamPlacements} />
        </Pane>
      </Card>

      <Pane display="grid" gridTemplateColumns="repeat(auto-fit, minmax(320px, 1fr))" gap={12}>
        <Card elevation={0} padding={16} background="rgba(255,255,255,0.03)">
          <Heading size={500}>Placement Distribution</Heading>
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
          <Heading size={500}>Patch Performance</Heading>
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
        <Heading size={500}>Meta Pressure</Heading>
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
              <Text key={`suggestion-${index}`} size={400}>- {item}</Text>
            ))
          ) : (
            <Text size={400} color="muted">No strong macro signal yet.</Text>
          )}
        </Pane>
      </Card>

      <Pane className="analysis-player-grid" display="grid" gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap={12}>
        {[playerA, playerB].map((player) => (
          <Card key={player.label} elevation={0} padding={16} background="rgba(255,255,255,0.03)">
            <Heading size={500}>{player.label} Breakdown</Heading>
            <Pane marginTop={10} display="grid" gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap={8}>
              <Text size={400}>Avg Place: {player.games ? player.avgPlacement.toFixed(2) : "-"}</Text>
              <Text size={400}>Top4: {player.games ? `${player.top4Rate.toFixed(1)}%` : "-"}</Text>
              <Text size={400}>Avg Damage: {player.avgDamage.toFixed(1)}</Text>
              <Text size={400}>Avg Level: {player.avgLevel.toFixed(2)}</Text>
              <Text size={400}>Consistency: {player.consistency.toFixed(2)}</Text>
              <Text size={400}>Low-resource losses: {player.lowGoldLosses + player.lowDamageLosses}</Text>
            </Pane>

            <Pane marginTop={12}>
              <Text size={400} color="muted">Damage Trend</Text>
              <Pane marginTop={6}>
                <Sparkline values={player.damages} height={64} responsive canvasWidth={520} />
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
    </Pane>
  );
}
