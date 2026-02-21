import { useEffect, useMemo, useState } from "react";
import { Pane, Text, Tooltip } from "evergreen-ui";
import { iconCandidates } from "../utils/tft";

function normalizeTraitTier(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const normalized = String(value || "").toLowerCase();
  if (normalized === "bronze") return 1;
  if (normalized === "silver") return 2;
  if (normalized === "gold") return 3;
  if (normalized === "prismatic" || normalized === "chromatic") return 4;
  return 0;
}

function traitBackgroundForTier(tier) {
  if (tier >= 4) return "rgba(130, 74, 202, 0.42)";
  if (tier === 3) return "rgba(164, 128, 45, 0.45)";
  if (tier === 2) return "rgba(114, 124, 142, 0.45)";
  if (tier === 1) return "rgba(114, 79, 58, 0.48)";
  return "rgba(20,25,34,0.95)";
}

export default function IconWithLabel({ kind, token, label, count, size = 24, iconManifest = null, traitTier = null }) {
  const urls = useMemo(() => iconCandidates(kind, token, iconManifest), [kind, token, iconManifest]);
  const [index, setIndex] = useState(0);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    setIndex(0);
    setShowFallback(false);
  }, [token, kind]);

  function handleError() {
    if (index + 1 < urls.length) {
      setIndex((value) => value + 1);
      return;
    }
    setShowFallback(true);
  }

  const traitTierValue = normalizeTraitTier(traitTier);
  const visualSize = kind === "trait" ? Math.max(24, Math.round(size * 0.5)) : size;
  const iconBg = kind === "trait" ? traitBackgroundForTier(traitTierValue) : "rgba(31,36,48,0.65)";
  const iconPadding = kind === "trait" ? Math.max(4, Math.round(visualSize * 0.14)) : 0;
  const imageSize = Math.max(14, visualSize - iconPadding * 2);

  return (
    <Tooltip content={`${label}${count ? ` x${count}` : ""}`}>
      <Pane position="relative" display="inline-flex" paddingRight={count ? 8 : 0} paddingBottom={count ? 8 : 0}>
        <Pane
          width={visualSize}
          height={visualSize}
          borderRadius={6}
          background={iconBg}
          border="default"
          display="grid"
          placeItems="center"
          overflow="hidden"
          padding={iconPadding}
        >
          {!showFallback && urls[index] ? (
            <img
              src={urls[index]}
              alt=""
              width={imageSize}
              height={imageSize}
              onError={handleError}
              style={{ borderRadius: 4, objectFit: "cover", display: "block" }}
            />
          ) : (
            <Text size={300}>{kind === "unit" ? "U" : "T"}</Text>
          )}
        </Pane>
        {count ? (
          <Pane
            position="absolute"
            right={0}
            bottom={0}
            minWidth={22}
            height={22}
            borderRadius={11}
            background="rgba(20,31,52,0.96)"
            border="1px solid rgba(93,122,183,0.55)"
            paddingX={6}
            display="grid"
            placeItems="center"
          >
            <Text size={300} style={{ color: "#f7fbff", fontWeight: 700 }}>
              {count}
            </Text>
          </Pane>
        ) : null}
      </Pane>
    </Tooltip>
  );
}
