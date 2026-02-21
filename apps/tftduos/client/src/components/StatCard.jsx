import { Card, Heading, Text, Tooltip } from "evergreen-ui";

export default function StatCard({
  label,
  value,
  hint,
  compact = false,
  hideHint = false,
  labelTooltip = "",
  valueTooltip = "",
  tone = "neutral",
}) {
  const toneStyles = {
    good: {
      background: "rgba(46, 166, 111, 0.12)",
      borderColor: "rgba(98, 224, 165, 0.62)",
    },
    bad: {
      background: "rgba(196, 75, 75, 0.14)",
      borderColor: "rgba(236, 118, 118, 0.62)",
    },
    neutral: {
      background: "rgba(255,255,255,0.03)",
      borderColor: "rgba(190, 206, 235, 0.45)",
    },
  };
  const toneStyle = toneStyles[tone] || toneStyles.neutral;

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
      border="default"
      paddingX={14}
      paddingY={compact ? 10 : 14}
      style={toneStyle}
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
