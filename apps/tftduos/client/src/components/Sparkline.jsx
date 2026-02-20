import { Pane, Text } from "evergreen-ui";

export default function Sparkline({ values = [], width = 280, height = 72 }) {
  if (!values.length) {
    return (
      <Pane
        width={width}
        height={height}
        border="default"
        borderRadius={6}
        display="grid"
        placeItems="center"
      >
        <Text size={300} color="muted">No data</Text>
      </Pane>
    );
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(1, max - min);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const points = values
    .map((value, index) => {
      const x = Math.round(index * step);
      const y = Math.round(((max - value) / range) * (height - 10)) + 5;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <Pane border="default" borderRadius={6} padding={6} background="rgba(255,255,255,0.03)">
      <svg width={width} height={height}>
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.9"
        />
      </svg>
    </Pane>
  );
}

