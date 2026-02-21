import { Card, Heading, Pane, Strong, Text, Tooltip } from "evergreen-ui";
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

function TeamPlacementChart({ values, startLabel, endLabel }) {
  const width = 960;
  const height = 210;
  const padLeft = 46;
  const padRight = 16;
  const padTop = 14;
  const padBottom = 30;
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
        <text x={8} y={14} fontSize="12" fill="rgba(230,238,255,0.72)">Team Placement (1 is best)</text>

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

        <text x={padLeft} y={height - 8} fontSize="12" fill="rgba(230,238,255,0.72)">{startLabel}</text>
        <text x={width - padRight} y={height - 8} textAnchor="end" fontSize="12" fill="rgba(230,238,255,0.72)">{endLabel}</text>
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
  const successfulFlipRate = Number(scorecard?.rescueIndex?.successfulFlipRate || 0);
  const giftMetrics = scorecard?.giftEfficiency?.metrics || null;
  const giftStatus = String(scorecard?.giftEfficiency?.status || "needs_gift_events");

  const sameTeamGames = Number(kpis.sameTeamGames || 0);
  const teamTop4Rate = Number(kpis.teamTop4Rate || 0);
  const avgTeamDamage = sorted.length
    ? average(
        sorted.map(
          (match) => Number(match?.playerA?.totalDamageToPlayers || 0) + Number(match?.playerB?.totalDamageToPlayers || 0)
        )
      )
    : 0;

  const rangeStart = formatDateLabel(sorted[0]?.gameDatetime);
  const rangeEnd = formatDateLabel(sorted[sorted.length - 1]?.gameDatetime);

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
          <StatCard label="Team Avg Place" value={kpis.avgTeamPlacement !== null ? kpis.avgTeamPlacement.toFixed(2) : "-"} compact hideHint labelTooltip="Average duo team placement across filtered games. Lower is better." />
          <StatCard label="Team Top 2" value={kpis.teamTop2Rate !== null ? `${kpis.teamTop2Rate.toFixed(1)}%` : "-"} compact hideHint labelTooltip="Percent of filtered games where your duo team finishes top 2." />
          <StatCard label="Team Top 4" value={filteredMatches.length ? `${teamTop4Rate.toFixed(1)}%` : "-"} compact hideHint labelTooltip="Percent of filtered games where your duo team finishes top 4." />
          <StatCard label="Team Win Rate" value={kpis.teamWinRate !== null ? `${kpis.teamWinRate.toFixed(1)}%` : "-"} compact hideHint labelTooltip="Percent of filtered games where your duo team finishes #1." />
          <StatCard label="Same-Team Games" value={sameTeamGames} compact hideHint labelTooltip="Shared-match games where both players are detected on the same Double Up team." />
          <StatCard label="Avg Team Damage" value={filteredMatches.length ? avgTeamDamage.toFixed(1) : "-"} compact hideHint labelTooltip="Average combined player damage to opponents (player A + player B)." />
          <StatCard label="Placement Volatility" value={teamPlacements.length ? stdDev(teamPlacements).toFixed(2) : "-"} compact hideHint labelTooltip="Standard deviation of team placements. Lower means more consistent outcomes." />
          <StatCard
            label="Rescue / Clutch"
            value={`${rescueRate.toFixed(0)}% / ${clutchIndex.toFixed(0)}%`}
            compact
            hideHint
            labelTooltip="Rescue Rate = rescue_arrival events / all logged events. Clutch Index = late-stage successful rescues / rescue_arrival events."
            valueTooltip={`Successful flip rate: ${successfulFlipRate.toFixed(0)}%`}
          />
        </Pane>
      </Card>

      <Card elevation={0} padding={16} background="rgba(255,255,255,0.03)">
        <Pane display="flex" justifyContent="space-between" alignItems="center" gap={8} flexWrap="wrap">
          <SectionTitle
            title="Team Placement Trend"
            tooltip="Line chart of team placement over time. Axis labels show placement rank (#1 best)."
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
          <TeamPlacementChart values={teamPlacements} startLabel={rangeStart} endLabel={rangeEnd} />
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
    </Pane>
  );
}
