import { Pane, Text } from "evergreen-ui";

export default function MetricBar({ label, value, color = "teal" }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <Pane>
      <Pane display="flex" justifyContent="space-between" marginBottom={6}>
        <Text size={300}>{label}</Text>
        <Text size={300}>{safeValue.toFixed(0)}%</Text>
      </Pane>
      <Pane height={8} borderRadius={6} background="rgba(255,255,255,0.08)" overflow="hidden">
        <Pane
          height="100%"
          width={`${safeValue}%`}
          background={color}
          borderRadius={6}
        />
      </Pane>
    </Pane>
  );
}

