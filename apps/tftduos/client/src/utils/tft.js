export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function toEpochMs(value) {
  const raw = Number(value || 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return raw < 1e12 ? raw * 1000 : raw;
}

export function prettyName(value, fallback = "Unknown") {
  if (!value) return fallback;
  return value
    .replace(/^tft\d+_/i, "")
    .replace(/^set\d+_/i, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function normalizeTftToken(value) {
  return String(value || "")
    .replace(/[^a-z0-9_]/gi, "")
    .toLowerCase();
}

export function iconCandidates(kind, token, iconManifest = null) {
  const normalized = normalizeTftToken(token);
  if (!normalized) return [];
  const seen = new Set();
  const out = [];
  const push = (value) => {
    if (!value || seen.has(value)) return;
    seen.add(value);
    out.push(value);
  };

  if (kind === "trait" && iconManifest?.traits) {
    const short = normalized.replace(/^tft\d+_/, "");
    push(iconManifest.traits[normalized]);
    if (short) {
      Object.entries(iconManifest.traits).forEach(([key, value]) => {
        if (key === short || key.endsWith(`_${short}`)) push(value);
      });
    }
  }

  if (kind === "unit") {
    const setMatch = normalized.match(/^tft(\d+)_([a-z0-9_]+)$/);
    const set = setMatch?.[1] || "";
    const short = setMatch?.[2] || normalized.replace(/^tft\d+_/, "");
    const variants = [...new Set([normalized, short])];
    variants.forEach((value) => {
      const withSet = set ? `.tft_set${set}` : "";
      push(`https://raw.communitydragon.org/latest/game/assets/characters/${value}/hud/${value}_square${withSet}.png`);
      push(`https://raw.communitydragon.org/latest/game/assets/characters/${value}/hud/${value}_square${withSet}.tex.png`);
      push(`https://raw.communitydragon.org/latest/game/assets/characters/${value}/hud/${value}_square.png`);
      push(`https://raw.communitydragon.org/latest/game/assets/characters/${value}/hud/${value}_square.tex.png`);
    });
    return out;
  }

  if (kind === "trait") {
    const match = normalized.match(/^tft(\d+)_([a-z0-9_]+)$/);
    const set = match?.[1] || "";
    const trait = match?.[2] || normalized.replace(/^tft\d+_/, "");
    const setPrefix = set ? `trait_icon_${set}_${trait}` : `trait_icon_${trait}`;
    push(`https://raw.communitydragon.org/latest/game/assets/ux/traiticons/${setPrefix}.tft_set${set}.png`);
    push(`https://raw.communitydragon.org/latest/game/assets/ux/traiticons/${setPrefix}.tft_set${set}.tex.png`);
    push(`https://raw.communitydragon.org/latest/game/assets/ux/traiticons/${setPrefix}.png`);
    push(`https://raw.communitydragon.org/latest/game/assets/ux/traiticons/${setPrefix}.tex.png`);
    push(`https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/ux/traiticons/traiticon_${trait}.png`);
    return out;
  }

  return out;
}

export function companionArtCandidates(companion) {
  const rawToken =
    companion?.content_ID || companion?.contentId || companion?.species || companion?.item_ID || "";
  const normalized = normalizeTftToken(rawToken);
  if (!normalized) return [];

  const tokens = [...new Set([normalized, normalized.replace(/^tft\d+_/, "")].filter(Boolean))];
  const urls = [];
  const push = (value) => {
    if (!value || urls.includes(value)) return;
    urls.push(value);
  };

  tokens.forEach((token) => {
    push(`https://raw.communitydragon.org/latest/game/assets/loadouts/companions/${token}.png`);
    push(`https://raw.communitydragon.org/latest/game/assets/loadouts/companions/${token}.tex.png`);
    push(`https://raw.communitydragon.org/latest/game/assets/loadouts/companions/icons2d/${token}.png`);
    push(`https://raw.communitydragon.org/latest/game/assets/loadouts/companions/splashes/${token}.png`);
    push(
      `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/loadouts/companions/${token}.png`
    );
    push(
      `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/loadouts/companions/icons2d/${token}.png`
    );
  });

  return urls;
}

export function formatTime(ms) {
  const epochMs = toEpochMs(ms);
  if (!epochMs) return "Unknown time";
  return new Date(epochMs).toLocaleString();
}

export function formatDuration(totalSeconds) {
  if (!totalSeconds && totalSeconds !== 0) return "-";
  const min = Math.floor(totalSeconds / 60);
  const sec = Math.floor(totalSeconds % 60);
  return `${min}:${String(sec).padStart(2, "0")}`;
}

export function placementBadgeColor(placement) {
  const value = Number(placement || 8);
  if (value <= 1) return "green";
  if (value <= 4) return "teal";
  if (value <= 6) return "yellow";
  return "red";
}

export function patchFromVersion(version) {
  const match = String(version || "").match(/(\d+)\.(\d+)/);
  if (!match) return null;
  return `${match[1]}.${match[2]}`;
}

export function comparePatchVersionsDesc(a, b) {
  const aParts = String(a || "").split(".").map(Number);
  const bParts = String(b || "").split(".").map(Number);
  const maxLen = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < maxLen; i += 1) {
    const av = Number.isFinite(aParts[i]) ? aParts[i] : 0;
    const bv = Number.isFinite(bParts[i]) ? bParts[i] : 0;
    if (av !== bv) return bv - av;
  }
  return 0;
}

export function summarizeFromMatches(matches) {
  if (!matches.length) {
    return {
      kpis: {
        gamesTogether: 0,
        sameTeamGames: 0,
        sameTeamTop4Rate: null,
        avgPlacementA: 0,
        avgPlacementB: 0,
        avgTeamPlacement: null,
        teamTop4Rate: null,
        teamWinRate: null,
        teamPlacements: [],
      },
      metaTraits: [],
      metaUnits: [],
      suggestions: [],
    };
  }

  const aPlacements = matches.map((m) => m.playerA?.placement || 8);
  const bPlacements = matches.map((m) => m.playerB?.placement || 8);
  const sameTeam = matches.filter((m) => m.sameTeam);
  const sameTeamPlacements = sameTeam.map((m) => Math.max(m.playerA?.placement || 8, m.playerB?.placement || 8));
  const top4Count = sameTeamPlacements.filter((p) => p <= 4).length;
  const teamPlacements = matches.map((m) => Math.max(m.playerA?.placement || 8, m.playerB?.placement || 8));
  const teamTop4Count = teamPlacements.filter((p) => p <= 4).length;
  const teamWinCount = teamPlacements.filter((p) => p === 1).length;

  const traitCounts = {};
  const unitCounts = {};
  matches.forEach((match) => {
    asArray(match.lobby).forEach((player) => {
      asArray(player.traits)
        .filter((trait) => trait.style > 0)
        .forEach((trait) => {
          traitCounts[trait.name] = (traitCounts[trait.name] || 0) + 1;
        });
      asArray(player.units).forEach((unit) => {
        if (unit.characterId) {
          unitCounts[unit.characterId] = (unitCounts[unit.characterId] || 0) + 1;
        }
      });
    });
  });

  const metaTraits = Object.entries(traitCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  const metaUnits = Object.entries(unitCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([characterId, count]) => ({ characterId, count }));

  const avgA = aPlacements.reduce((sum, v) => sum + v, 0) / aPlacements.length;
  const avgB = bPlacements.reduce((sum, v) => sum + v, 0) / bPlacements.length;
  const avgTeam = sameTeamPlacements.length
    ? sameTeamPlacements.reduce((sum, v) => sum + v, 0) / sameTeamPlacements.length
    : null;

  const suggestions = [];
  if (sameTeam.length < 5) {
    suggestions.push("Small same-team sample size. Queue together in Double Up for stronger trend confidence.");
  }
  if (avgTeam !== null && avgTeam > 4.5) {
    suggestions.push("Team average is outside Top 4. Stabilize one board early and let the other greed economy.");
  }
  if (metaTraits.length >= 3) {
    suggestions.push(
      `Most contested traits: ${metaTraits
        .slice(0, 3)
        .map((x) => prettyName(x.name))
        .join(", ")}. Plan one uncontested pivot each game.`
    );
  }

  return {
    kpis: {
      gamesTogether: matches.length,
      sameTeamGames: sameTeam.length,
      sameTeamTop4Rate: sameTeam.length ? (top4Count / sameTeam.length) * 100 : null,
      avgPlacementA: avgA,
      avgPlacementB: avgB,
      avgTeamPlacement: avgTeam,
      teamTop4Rate: teamPlacements.length ? (teamTop4Count / teamPlacements.length) * 100 : null,
      teamWinRate: teamPlacements.length ? (teamWinCount / teamPlacements.length) * 100 : null,
      teamPlacements,
    },
    metaTraits,
    metaUnits,
    suggestions,
  };
}



