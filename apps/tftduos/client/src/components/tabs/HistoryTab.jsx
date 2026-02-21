import { Alert, Badge, Card, Heading, Pane, Strong, Text } from "evergreen-ui";
import { DISPLAY_NAME_A, DISPLAY_NAME_B } from "../../config/constants";
import PlayerBannerCard from "../PlayerBannerCard";
import StatCard from "../StatCard";
import IconWithLabel from "../IconWithLabel";
import { asArray, formatDuration, formatTime, placementBadgeColor, prettyName } from "../../utils/tft";

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
        <StatCard label="Games" value={kpis.gamesTogether} hint="In current filters" />
        <StatCard
          label="Team Avg Place"
          value={kpis.avgTeamPlacement !== null ? kpis.avgTeamPlacement.toFixed(2) : "-"}
          hint="Lower is better"
        />
        <StatCard
          label="Team Top 4"
          value={kpis.teamTop4Rate !== null ? `${kpis.teamTop4Rate.toFixed(1)}%` : "-"}
          hint="Team placement <= 4"
        />
        <StatCard
          label="Team Win Rate"
          value={kpis.teamWinRate !== null ? `${kpis.teamWinRate.toFixed(1)}%` : "-"}
          hint="Team placement #1"
        />
      </Pane>
      <Card elevation={0} padding={14} background="rgba(255,255,255,0.03)">
        <Heading size={500}>Recent Form</Heading>
        <Pane marginTop={10} display="flex" flexWrap="wrap" gap={8}>
          {recentTeamPlacements.length ? (
            recentTeamPlacements.map((placement, idx) => (
              <Badge key={`recent-${idx}`} color={placement <= 4 ? "green" : placement <= 6 ? "yellow" : "red"}>
                #{placement}
              </Badge>
            ))
          ) : (
            <Text size={300} color="muted">No recent games in current filter.</Text>
          )}
        </Pane>
      </Card>

      {!hasFilteredMatches ? (
        <Alert intent="warning" title={`Loaded ${matches.length} matches but none match current filters.`} />
      ) : null}

      {filteredMatches.map((match) => (
        <Card key={match.id} elevation={0} padding={14} background="rgba(255,255,255,0.03)">
          <Pane display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={8}>
            <Pane display="flex" alignItems="center" gap={10}>
              <Heading size={500}>{match.queueLabel}</Heading>
              <Badge color={placementBadgeColor(Math.max(match.playerA?.placement || 8, match.playerB?.placement || 8))}>
                Team #{Math.max(match.playerA?.placement || 8, match.playerB?.placement || 8)}
              </Badge>
            </Pane>
            <Badge color="neutral">{formatDuration(match.gameLength)}</Badge>
          </Pane>

          <Text size={300} color="muted" display="block" marginTop={6}>
            Set {match.setNumber ?? "?"} · Patch {match.patch || "?"} · {formatTime(match.gameDatetime)}
          </Text>

          <Pane display="grid" gridTemplateColumns="repeat(auto-fit, minmax(260px, 1fr))" gap={12} marginTop={12}>
            <Card padding={10} elevation={0} background="rgba(255,255,255,0.04)">
              <Pane display="flex" justifyContent="space-between" alignItems="center" marginBottom={8}>
                <Strong>{DISPLAY_NAME_A}</Strong>
                <Badge color={placementBadgeColor(match.playerA?.placement)}>#{match.playerA?.placement ?? "?"}</Badge>
              </Pane>
              <Pane display="flex" gap={8} marginBottom={8} flexWrap="wrap">
                <Badge color="neutral">Lvl {match.playerA?.level ?? "?"}</Badge>
                <Badge color="neutral">Dmg {match.playerA?.totalDamageToPlayers ?? "?"}</Badge>
              </Pane>
              <Pane display="flex" flexWrap="wrap" gap={8} marginTop={8}>
                {asArray(match.playerA?.traits)
                  .filter((x) => x.style > 0)
                  .slice(0, 3)
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
              <Pane display="flex" flexWrap="wrap" gap={8} marginTop={8}>
                {asArray(match.playerA?.units)
                  .slice(0, 4)
                  .map((unit) => (
                    <IconWithLabel
                      key={`a-unit-${match.id}-${unit.characterId}`}
                      kind="unit"
                      token={unit.characterId}
                      label={prettyName(unit.characterId)}
                      size={68}
                      iconManifest={iconManifest}
                    />
                  ))}
              </Pane>
            </Card>
            <Card padding={10} elevation={0} background="rgba(255,255,255,0.04)">
              <Pane display="flex" justifyContent="space-between" alignItems="center" marginBottom={8}>
                <Strong>{DISPLAY_NAME_B}</Strong>
                <Badge color={placementBadgeColor(match.playerB?.placement)}>#{match.playerB?.placement ?? "?"}</Badge>
              </Pane>
              <Pane display="flex" gap={8} marginBottom={8} flexWrap="wrap">
                <Badge color="neutral">Lvl {match.playerB?.level ?? "?"}</Badge>
                <Badge color="neutral">Dmg {match.playerB?.totalDamageToPlayers ?? "?"}</Badge>
              </Pane>
              <Pane display="flex" flexWrap="wrap" gap={8} marginTop={8}>
                {asArray(match.playerB?.traits)
                  .filter((x) => x.style > 0)
                  .slice(0, 3)
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
              <Pane display="flex" flexWrap="wrap" gap={8} marginTop={8}>
                {asArray(match.playerB?.units)
                  .slice(0, 4)
                  .map((unit) => (
                    <IconWithLabel
                      key={`b-unit-${match.id}-${unit.characterId}`}
                      kind="unit"
                      token={unit.characterId}
                      label={prettyName(unit.characterId)}
                      size={68}
                      iconManifest={iconManifest}
                    />
                  ))}
              </Pane>
            </Card>
          </Pane>
        </Card>
      ))}
    </Pane>
  );
}

