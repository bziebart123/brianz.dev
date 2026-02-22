import { useEffect, useMemo, useRef, useState } from "react";
import { Card, Heading, Pane, Text } from "evergreen-ui";
import { companionArtCandidates, iconCandidates } from "../utils/tft";

const MAX_BANNER_RETRIES = 2;

function withRetryKey(url, retryKey) {
  if (!retryKey || !url) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("retry", String(retryKey));
    return parsed.toString();
  } catch {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}retry=${retryKey}`;
  }
}

export default function PlayerBannerCard({
  displayName,
  riotName,
  tagLine,
  rank,
  companion,
  companionManifest = null,
  fallbackUnitToken = "",
}) {
  const companionUrls = useMemo(
    () => companionArtCandidates(companion, companionManifest),
    [companion, companionManifest]
  );
  const unitFallbackUrls = useMemo(
    () => (fallbackUnitToken ? iconCandidates("unit", fallbackUnitToken) : []),
    [fallbackUnitToken]
  );
  const urls = useMemo(() => [...companionUrls, ...unitFallbackUrls], [companionUrls, unitFallbackUrls]);
  const [index, setIndex] = useState(0);
  const [showFallback, setShowFallback] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const retryTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    setIndex(0);
    setRetryCount(0);
    setShowFallback(false);
  }, [companion, fallbackUnitToken]);

  function handleError() {
    if (index + 1 < urls.length) {
      setIndex((value) => value + 1);
      return;
    }
    if (retryCount < MAX_BANNER_RETRIES && urls.length) {
      const nextRetry = retryCount + 1;
      setShowFallback(true);
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
      retryTimerRef.current = setTimeout(() => {
        setRetryCount(nextRetry);
        setIndex(0);
        setShowFallback(false);
      }, 650 * nextRetry);
      return;
    }
    setShowFallback(true);
  }

  return (
    <Card elevation={1} padding={0} overflow="hidden" border="default">
      <Pane
        position="relative"
        minHeight={160}
        background={
          showFallback
            ? "linear-gradient(135deg, rgba(38,44,58,1) 0%, rgba(23,28,40,1) 100%)"
            : "rgba(255,255,255,0.04)"
        }
      >
        {!showFallback && urls[index] ? (
          <img
            src={withRetryKey(urls[index], retryCount)}
            alt=""
            onError={handleError}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "50% 28%",
            }}
          />
        ) : null}
        <Pane
          position="absolute"
          inset={0}
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.35) 52%, rgba(0,0,0,0.72) 100%)",
          }}
        />
        <Pane position="absolute" left={14} right={14} bottom={12}>
          <Heading size={700} marginTop={0} style={{ color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.7)" }}>
            {riotName || displayName}#{tagLine || ""}
          </Heading>
          <Text size={300} marginTop={4} style={{ color: "#fff", opacity: 0.85, textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}>
            {rank || "Unranked"}
          </Text>
        </Pane>
      </Pane>
    </Card>
  );
}
