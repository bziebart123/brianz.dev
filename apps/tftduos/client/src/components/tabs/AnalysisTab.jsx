import { Card, Heading, Pane, Text } from "evergreen-ui";
import StatCard from "../StatCard";
import IconWithLabel from "../IconWithLabel";
import { prettyName } from "../../utils/tft";

export default function AnalysisTab({ kpis, computed, iconManifest }) {
  return (
    <Pane display="grid" gap={12}>
      <Pane display="grid" gridTemplateColumns="repeat(auto-fit, minmax(180px, 1fr))" gap={12}>
        <StatCard label="Avg Place A" value={kpis.avgPlacementA?.toFixed(2)} />
        <StatCard label="Avg Place B" value={kpis.avgPlacementB?.toFixed(2)} />
        <StatCard
          label="Duo Top4%"
          value={kpis.sameTeamTop4Rate !== null ? `${kpis.sameTeamTop4Rate.toFixed(1)}%` : "-"}
        />
        <StatCard
          label="Duo Avg Place"
          value={kpis.avgTeamPlacement !== null ? kpis.avgTeamPlacement.toFixed(2) : "-"}
        />
      </Pane>

      <Card elevation={0} padding={16}>
        <Heading size={500}>Meta Traits</Heading>
        <Pane marginTop={8} display="flex" flexWrap="wrap" gap={8}>
          {computed.metaTraits.length ? (
            computed.metaTraits.map((trait) => (
              <IconWithLabel
                key={trait.name}
                kind="trait"
                token={trait.name}
                label={prettyName(trait.name)}
                count={trait.count}
                traitTier={trait.style}
                size={60}
                iconManifest={iconManifest}
              />
            ))
          ) : (
            <Text size={300} color="muted">No trait trend yet.</Text>
          )}
        </Pane>
      </Card>

      <Card elevation={0} padding={16}>
        <Heading size={500}>Meta Units</Heading>
        <Pane marginTop={8} display="flex" flexWrap="wrap" gap={8}>
          {computed.metaUnits.length ? (
            computed.metaUnits.map((unit) => (
              <IconWithLabel
                key={unit.characterId}
                kind="unit"
                token={unit.characterId}
                label={prettyName(unit.characterId)}
                count={unit.count}
                size={60}
                iconManifest={iconManifest}
              />
            ))
          ) : (
            <Text size={300} color="muted">No unit trend yet.</Text>
          )}
        </Pane>
      </Card>

      <Card elevation={0} padding={16}>
        <Heading size={500}>Suggestions</Heading>
        <Pane marginTop={8} display="grid" gap={6}>
          {computed.suggestions.length ? (
            computed.suggestions.map((item, i) => (
              <Text key={`${item}-${i}`} size={300}>• {item}</Text>
            ))
          ) : (
            <Text size={300} color="muted">No strong pattern yet in this filtered sample.</Text>
          )}
        </Pane>
      </Card>
    </Pane>
  );
}

