import { Card, Heading, Text } from "evergreen-ui";

export default function StatCard({ label, value, hint }) {
  return (
    <Card elevation={0} background="rgba(255,255,255,0.03)" border="default" padding={20}>
      <Text size={400} color="muted">
        {label}
      </Text>
      <Heading size={700} marginTop={10}>
        {value}
      </Heading>
      {hint ? (
        <Text size={400} color="muted" display="block" marginTop={8}>
          {hint}
        </Text>
      ) : null}
    </Card>
  );
}

