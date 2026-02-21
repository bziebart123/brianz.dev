import { Badge, Card, Heading, Pane, Strong, Text } from "evergreen-ui";
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
    placements,
    damages,
  };
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
  const playerADamageTrend = sorted.map((match) => Number(match?.playerA?.totalDamageToPlayers || 0));
  const playerBDamageTrend = sorted.map((match) => Number(match?.playerB?.totalDamageToPlayers || 0));

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

  const playerA = summarizePlayer(
    filteredMatches,
    "playerA",
    DISPLAY_NAME_A,
    coachingInsights?.summary?.a
  );
  const playerB = summarizePlayer(
    filteredMatches,
    "playerB",
    DISPLAY_NAME_B,
    coachingInsights?.summary?.b
  );

  const decisionGrade = Number(scorecard?.decisionQuality?.grade || 0);
  const rescueRate = Number(scorecard?.rescueIndex?.rescueRate || 0);
  const clutchIndex = Number(scorecard?.rescueIndex?.clutchIndex || 0);

  return (
    <Pane display="grid" gap={12}>
      <Card elevation={0} padding={16} background="rgba(255,255,255,0.03)">
        <Pane display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={10}>
          <Heading size={600}>Duo Performance Dashboard</Heading>
          <Badge color="blue">{filteredMatches.length} games in filter</Badge>
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

      <Pane display="grid" gridTemplateColumns="repeat(auto-fit, minmax(280px, 1fr))" gap={12}>
        <Card elevation={0} padding={16} background="rgba(255,255,255,0.03)">
          <Heading size={500}>Team Placement Trend</Heading>
          <Pane marginTop={8}>
            <Sparkline values={teamPlacements} width={240} height={64} />
          </Pane>
          <Pane marginTop={10} display="flex" gap={8} flexWrap="wrap">
            <Badge color={momentum >= 0 ? "green" : "red"}>
              Momentum {momentum >= 0 ? "+" : ""}{momentum.toFixed(2)}
            </Badge>
            <Badge color="neutral">Recent Avg {recentAvg ? recentAvg.toFixed(2) : "-"}</Badge>
          </Pane>
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
                    <Badge color="neutral">{row.games} games</Badge>
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

        <Card elevation={0} padding={16} background="rgba(255,255,255,0.03)">
          <Heading size={500}>Damage Trend</Heading>
          <Pane marginTop={10} display="grid" gap={12}>
            <Pane>
              <Text size={400} color="muted">{DISPLAY_NAME_A}</Text>
              <Pane marginTop={6}>
                <Sparkline values={playerADamageTrend} width={240} height={54} />
              </Pane>
            </Pane>
            <Pane>
              <Text size={400} color="muted">{DISPLAY_NAME_B}</Text>
              <Pane marginTop={6}>
                <Sparkline values={playerBDamageTrend} width={240} height={54} />
              </Pane>
            </Pane>
          </Pane>
        </Card>
      </Pane>

      <Pane display="grid" gridTemplateColumns="repeat(auto-fit, minmax(320px, 1fr))" gap={12}>
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
