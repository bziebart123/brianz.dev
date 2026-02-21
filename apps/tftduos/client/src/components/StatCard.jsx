import { Card, Heading, Text, Tooltip } from "evergreen-ui";

export default function StatCard({
  label,
  value,
  hint,
  compact = false,
  hideHint = false,
  labelTooltip = "",
  valueTooltip = "",
}) {
  const labelNode = (
    <Text size={400} color="muted">
      {label}
    </Text>
  );

  const valueNode = (
    <Heading size={700} marginTop={compact ? 4 : 6}>
      {value}
    </Heading>
  );

  return (
    <Card
      elevation={0}
      background="rgba(255,255,255,0.03)"
      border="default"
      paddingX={14}
      paddingY={compact ? 10 : 14}
    >
      {labelTooltip ? <Tooltip content={labelTooltip}>{labelNode}</Tooltip> : labelNode}
      {valueTooltip ? <Tooltip content={valueTooltip}>{valueNode}</Tooltip> : valueNode}
      {hint && !hideHint ? (
        <Text size={300} color="muted" display="block" marginTop={6}>
          {hint}
        </Text>
      ) : null}
    </Card>
  );
}
