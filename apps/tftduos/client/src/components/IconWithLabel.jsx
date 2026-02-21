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
  if (tier >= 4) {
    return "linear-gradient(145deg, rgba(250,252,255,0.46) 0%, rgba(170,244,255,0.44) 28%, rgba(255,222,244,0.44) 62%, rgba(206,255,224,0.44) 100%)";
  }
  if (tier === 3) return "linear-gradient(145deg, rgba(116,83,20,0.92) 0%, rgba(201,153,45,0.88) 55%, rgba(121,87,20,0.92) 100%)";
  if (tier === 2) return "linear-gradient(145deg, rgba(72,80,95,0.94) 0%, rgba(129,141,158,0.88) 55%, rgba(76,86,101,0.94) 100%)";
  if (tier === 1) return "linear-gradient(145deg, rgba(96,62,37,0.94) 0%, rgba(165,106,66,0.88) 55%, rgba(101,64,39,0.94) 100%)";
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
