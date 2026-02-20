import { useEffect, useMemo, useState } from "react";
import { Pane, Text, Tooltip } from "evergreen-ui";
import { iconCandidates } from "../utils/tft";

export default function IconWithLabel({ kind, token, label, count, size = 24, iconManifest = null }) {
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

  const iconBg = kind === "trait" ? "rgba(20,25,34,0.95)" : "rgba(31,36,48,0.65)";
  const iconPadding = kind === "trait" ? Math.max(6, Math.round(size * 0.18)) : 0;
  const imageSize = Math.max(14, size - iconPadding * 2);

  return (
    <Tooltip content={`${label}${count ? ` x${count}` : ""}`}>
      <Pane position="relative" display="inline-flex">
        <Pane
          width={size}
          height={size}
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
            right={-6}
            bottom={-6}
            minWidth={22}
            height={22}
            borderRadius={11}
            background="tint2"
            border="default"
            paddingX={6}
            display="grid"
            placeItems="center"
          >
            <Text size={300}>{count}</Text>
          </Pane>
        ) : null}
      </Pane>
    </Tooltip>
  );
}

