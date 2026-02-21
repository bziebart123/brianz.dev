import { Card, Heading, Text } from "evergreen-ui";

export default function StatCard({ label, value, hint, compact = false, hideHint = false }) {
  return (
    <Card
      elevation={0}
      background="rgba(255,255,255,0.03)"
      border="default"
      paddingX={14}
      paddingY={compact ? 10 : 14}
    >
      <Text size={400} color="muted">
        {label}
      </Text>
      <Heading size={700} marginTop={compact ? 4 : 6}>
        {value}
      </Heading>
      {hint && !hideHint ? (
        <Text size={300} color="muted" display="block" marginTop={6}>
          {hint}
        </Text>
      ) : null}
    </Card>
  );
}

