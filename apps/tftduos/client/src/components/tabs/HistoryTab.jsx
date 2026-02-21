import { Alert, Badge, Card, Heading, Pane, Strong, Text } from "evergreen-ui";
import { DISPLAY_NAME_A, DISPLAY_NAME_B } from "../../config/constants";
import PlayerBannerCard from "../PlayerBannerCard";
import StatCard from "../StatCard";
import IconWithLabel from "../IconWithLabel";
import {
  asArray,
  estimatedLpDeltaFromTeamPlacement,
  formatDate,
  placementBadgeColor,
  prettyName,
  teamPlacementFromMatch,
} from "../../utils/tft";

function boardSlots(units) {
  const normalized = asArray(units).slice(0, 10);
  const slots = [...normalized];
  while (slots.length < 10) slots.push(null);
  return slots;
}

function starsForTier(tierValue) {
  const tier = Math.max(1, Math.min(3, Number(tierValue || 1)));
  return "★".repeat(tier);
}

const UNIT_SLOT_SIZE = 52;
const CHIP_TEXT_STYLE = { color: "#f7fbff", fontWeight: 700, fontSize: 18, lineHeight: 1 };

export default function HistoryTab({
  payload,
  latestMatchForBanner,
  kpis,
  recentTeamPlacements,
  hasFilteredMatches,
  matches,
  filteredMatches,
  iconManifest,
  companionManifest,
}) {
  return (
    <Pane display="grid" gap={12}>
      <Pane display="grid" gridTemplateColumns="repeat(auto-fit, minmax(280px, 1fr))" gap={12}>
        <PlayerBannerCard
          displayName={DISPLAY_NAME_A}
          riotName={payload.players?.a?.gameName}
          tagLine={payload.players?.a?.tagLine}
          rank={payload.players?.a?.rank}
          companion={latestMatchForBanner?.playerA?.companion}
          companionManifest={companionManifest}
          fallbackUnitToken={latestMatchForBanner?.playerA?.units?.[0]?.characterId || ""}
        />
        <PlayerBannerCard
          displayName={DISPLAY_NAME_B}
          riotName={payload.players?.b?.gameName}
          tagLine={payload.players?.b?.tagLine}
          rank={payload.players?.b?.rank}
          companion={latestMatchForBanner?.playerB?.companion}
          companionManifest={companionManifest}
          fallbackUnitToken={latestMatchForBanner?.playerB?.units?.[0]?.characterId || ""}
        />
      </Pane>
      <Pane display="grid" gridTemplateColumns="repeat(auto-fit, minmax(180px, 1fr))" gap={12}>
        <StatCard label="Games" value={kpis.gamesTogether} hint="In current filters" compact hideHint />
        <StatCard
          label="Team Avg Place"
          value={kpis.avgTeamPlacement !== null ? kpis.avgTeamPlacement.toFixed(2) : "-"}
          hint="Lower is better"
          compact
          hideHint
        />
        <StatCard
          label="Team Top 2"
          value={kpis.teamTop2Rate !== null ? `${kpis.teamTop2Rate.toFixed(1)}%` : "-"}
          hint="Top half finish"
          compact
          hideHint
        />
        <StatCard
          label="Team Win Rate"
          value={kpis.teamWinRate !== null ? `${kpis.teamWinRate.toFixed(1)}%` : "-"}
          hint="Team placement #1"
          compact
          hideHint
        />
      </Pane>
      <Card elevation={0} padding={14} background="rgba(255,255,255,0.03)">
        <Heading size={500}>Match History</Heading>
        <Pane marginTop={10} display="flex" flexWrap="wrap" gap={8}>
          {recentTeamPlacements.length ? (
            recentTeamPlacements.map((placement, idx) => (
              <Pane
                key={`recent-${idx}`}
                borderRadius={10}
                paddingX={10}
                minHeight={26}
                display="inline-flex"
                alignItems="center"
                border={`1px solid ${placement <= 2 ? "rgba(73, 194, 122, 0.55)" : "rgba(223, 84, 72, 0.55)"}`}
                background={placement <= 2 ? "rgba(43, 143, 90, 0.24)" : "rgba(178, 56, 49, 0.24)"}
              >
                <Text size={500} style={CHIP_TEXT_STYLE}>
                  #{placement}
                </Text>
              </Pane>
            ))
          ) : (
            <Text size={300} color="muted">No recent games in current filter.</Text>
          )}
        </Pane>
      </Card>

      {!hasFilteredMatches ? (
        <Alert intent="warning" title={`Loaded ${matches.length} matches but none match current filters.`} />
      ) : null}

      {filteredMatches.map((match) => {
        const teamPlacement = teamPlacementFromMatch(match);
        const lpDelta = estimatedLpDeltaFromTeamPlacement(teamPlacement);
        const isTopTwo = teamPlacement <= 2;
        return (
        <Card key={match.id} elevation={0} padding={14} background="rgba(255,255,255,0.03)">
          <Pane display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={8}>
            <Pane display="flex" alignItems="center" gap={8} flexWrap="wrap">
              <Pane
                className="history-chip"
                borderRadius={10}
                paddingX={10}
                minHeight={28}
                display="inline-flex"
                alignItems="center"
                border={`1px solid ${isTopTwo ? "rgba(73, 194, 122, 0.55)" : "rgba(223, 84, 72, 0.55)"}`}
                background={isTopTwo ? "rgba(43, 143, 90, 0.24)" : "rgba(178, 56, 49, 0.24)"}
              >
                <Text size={500} style={CHIP_TEXT_STYLE}>
                  Team #{teamPlacement}
                </Text>
              </Pane>
              <Pane
                className="history-chip"
                borderRadius={10}
                paddingX={10}
                minHeight={28}
                display="inline-flex"
                alignItems="center"
                border="1px solid rgba(93, 122, 183, 0.52)"
                background="rgba(20, 31, 52, 0.92)"
              >
                <Text size={500} style={CHIP_TEXT_STYLE}>
                  LP {lpDelta >= 0 ? `+${lpDelta}` : lpDelta}
                </Text>
              </Pane>
            </Pane>
            <Text size={300} color="muted">
              Set {match.setNumber ?? "?"} · Patch {match.patch || "?"} · {formatDate(match.gameDatetime)}
            </Text>
          </Pane>

          <Pane display="grid" gridTemplateColumns="repeat(auto-fit, minmax(260px, 1fr))" gap={12} marginTop={12}>
            <Card padding={10} elevation={0} background="rgba(255,255,255,0.04)">
              <Pane display="flex" justifyContent="space-between" alignItems="center" marginBottom={8} gap={8} flexWrap="wrap">
                <Pane display="flex" alignItems="center" gap={8} flexWrap="wrap">
                  <Strong>{DISPLAY_NAME_A}</Strong>
                  <Badge className="history-stat-badge" color={placementBadgeColor(match.playerA?.placement)}>
                    #{match.playerA?.placement ?? "?"}
                  </Badge>
                </Pane>
                <Pane className="history-meta-badges" display="flex" gap={8} flexWrap="wrap">
                  <Badge className="history-stat-badge" color="neutral">Lvl {match.playerA?.level ?? "?"}</Badge>
                  <Badge className="history-stat-badge" color="neutral">Dmg {match.playerA?.totalDamageToPlayers ?? "?"}</Badge>
                </Pane>
              </Pane>
              <Pane display="flex" flexWrap="wrap" gap={8} marginTop={8}>
                {asArray(match.playerA?.traits)
                  .filter((x) => x.style > 0)
                  .map((trait) => (
                    <IconWithLabel
                      key={`a-trait-${match.id}-${trait.name}`}
                      kind="trait"
                      token={trait.name}
                      label={prettyName(trait.name)}
                      traitTier={trait.style}
                      size={56}
                      iconManifest={iconManifest}
                    />
                  ))}
              </Pane>
              <Pane className="history-unit-row" display="flex" flexWrap="nowrap" gap={4} marginTop={8}>
                {boardSlots(match.playerA?.units).map((unit, idx) =>
                  unit?.characterId ? (
                    <Pane
                      key={`a-unit-${match.id}-${unit.characterId}-${idx}`}
                      display="grid"
                      justifyItems="center"
                      gap={2}
                      data-testid="a-board-slot"
                    >
                      <IconWithLabel
                        kind="unit"
                        token={unit.characterId}
                        label={prettyName(unit.characterId)}
                        size={UNIT_SLOT_SIZE}
                        iconManifest={iconManifest}
                      />
                      <Text size={300} style={{ color: "#ffd97a", fontWeight: 700, lineHeight: 1 }}>
                        {starsForTier(unit.tier)}
                      </Text>
                    </Pane>
                  ) : (
                    <Pane key={`a-empty-${match.id}-${idx}`} display="grid" justifyItems="center" data-testid="a-board-slot">
                      <Pane
                        width={UNIT_SLOT_SIZE}
                        height={UNIT_SLOT_SIZE}
                        borderRadius={6}
                        border="1px dashed rgba(133, 155, 204, 0.42)"
                        background="rgba(255,255,255,0.02)"
                      />
                    </Pane>
                  )
                )}
              </Pane>
            </Card>
            <Card padding={10} elevation={0} background="rgba(255,255,255,0.04)">
              <Pane display="flex" justifyContent="space-between" alignItems="center" marginBottom={8} gap={8} flexWrap="wrap">
                <Pane display="flex" alignItems="center" gap={8} flexWrap="wrap">
                  <Strong>{DISPLAY_NAME_B}</Strong>
                  <Badge className="history-stat-badge" color={placementBadgeColor(match.playerB?.placement)}>
                    #{match.playerB?.placement ?? "?"}
                  </Badge>
                </Pane>
                <Pane className="history-meta-badges" display="flex" gap={8} flexWrap="wrap">
                  <Badge className="history-stat-badge" color="neutral">Lvl {match.playerB?.level ?? "?"}</Badge>
                  <Badge className="history-stat-badge" color="neutral">Dmg {match.playerB?.totalDamageToPlayers ?? "?"}</Badge>
                </Pane>
              </Pane>
              <Pane display="flex" flexWrap="wrap" gap={8} marginTop={8}>
                {asArray(match.playerB?.traits)
                  .filter((x) => x.style > 0)
                  .map((trait) => (
                    <IconWithLabel
                      key={`b-trait-${match.id}-${trait.name}`}
                      kind="trait"
                      token={trait.name}
                      label={prettyName(trait.name)}
                      traitTier={trait.style}
                      size={56}
                      iconManifest={iconManifest}
                    />
                  ))}
              </Pane>
              <Pane className="history-unit-row" display="flex" flexWrap="nowrap" gap={4} marginTop={8}>
                {boardSlots(match.playerB?.units).map((unit, idx) =>
                  unit?.characterId ? (
                    <Pane
                      key={`b-unit-${match.id}-${unit.characterId}-${idx}`}
                      display="grid"
                      justifyItems="center"
                      gap={2}
                      data-testid="b-board-slot"
                    >
                      <IconWithLabel
                        kind="unit"
                        token={unit.characterId}
                        label={prettyName(unit.characterId)}
                        size={UNIT_SLOT_SIZE}
                        iconManifest={iconManifest}
                      />
                      <Text size={300} style={{ color: "#ffd97a", fontWeight: 700, lineHeight: 1 }}>
                        {starsForTier(unit.tier)}
                      </Text>
                    </Pane>
                  ) : (
                    <Pane key={`b-empty-${match.id}-${idx}`} display="grid" justifyItems="center" data-testid="b-board-slot">
                      <Pane
                        width={UNIT_SLOT_SIZE}
                        height={UNIT_SLOT_SIZE}
                        borderRadius={6}
                        border="1px dashed rgba(133, 155, 204, 0.42)"
                        background="rgba(255,255,255,0.02)"
                      />
                    </Pane>
                  )
                )}
              </Pane>
            </Card>
          </Pane>
        </Card>
        );
      })}
    </Pane>
  );
}

