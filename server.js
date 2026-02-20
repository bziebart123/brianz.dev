import dotenv from "dotenv";
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { buildDuoHighlights, buildDuoScorecard, buildPersonalizedPlaybook } from "./lib/duoAnalytics.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);
const riotApiKey = process.env.RIOT_API_KEY;
const debugTftPayload = process.env.DEBUG_TFT_PAYLOAD === "1";
const cache = new Map();
app.use(express.json({ limit: "1mb" }));
const PERSISTED_CACHE_PATH = path.join(process.cwd(), ".cache", "duo-history-cache.json");
const PERSISTED_CACHE_VERSION = 1;
const ANALYTICS_STORE_PATH = path.join(process.cwd(), ".cache", "duo-analytics-store.json");
const ANALYTICS_STORE_VERSION = 1;
let persistedCache = {
  version: PERSISTED_CACHE_VERSION,
  players: {},
};
let persistedCacheLoaded = false;
let analyticsStore = {
  version: ANALYTICS_STORE_VERSION,
  duos: {},
};
let analyticsStoreLoaded = false;
let tftIconManifestCache = {
  loadedAt: 0,
  bySet: {},
};

const CACHE_TTL = {
  account: 5 * 60 * 1000,
  matchIds: 2 * 60 * 1000,
  match: 24 * 60 * 60 * 1000,
  summoner: 5 * 60 * 1000,
  rank: 60 * 1000,
};

const QUEUE_LABELS = {
  1090: "Ranked",
  1100: "Normal",
  1110: "Hyper Roll",
  1130: "Double Up",
  1160: "Ranked",
  6110: "Revival",
};

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

function getFromCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCache(key, value, ttl) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttl,
  });
  return value;
}

async function riotRequest(url) {
  const response = await fetch(url, {
    headers: {
      "X-Riot-Token": riotApiKey,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`Riot API request failed (${response.status}).`);
    error.status = response.status;
    error.body = body;
    error.retryAfter = response.headers.get("Retry-After");
    throw error;
  }

  return response.json();
}

async function riotRequestCached(url, ttl) {
  const key = `riot:${url}`;
  const hit = getFromCache(key);
  if (hit) return hit;
  const data = await riotRequest(url);
  return setCache(key, data, ttl);
}

function summarizeUnits(units = []) {
  return units.map((unit) => ({
    characterId: unit.character_id || null,
    name: unit.name || null,
    tier: unit.tier ?? null,
    rarity: unit.rarity ?? null,
    itemNames: safeCountArray(unit.itemNames),
    // Alias maintained for backward compatibility with existing UI code.
    items: safeCountArray(unit.itemNames),
  }));
}

function summarizeCompanion(companion) {
  if (!companion || typeof companion !== "object") return null;
  return {
    contentId: companion.content_ID ?? null,
    itemId: companion.item_ID ?? null,
    skinId: companion.skin_ID ?? null,
    species: companion.species ?? null,
    raw: companion,
  };
}

function summarizeArena(participant) {
  // TFT match-v1 payload currently does not expose arena-specific fields.
  // We return a stable placeholder shape so downstream consumers can rely on it.
  return {
    arenaId: null,
    skinId: null,
    available: false,
    source: "tft-match-v1",
  };
}

function summarizeTraits(traits = []) {
  return traits
    .map((trait) => ({
      name: trait.name,
      numUnits: trait.num_units,
      style: trait.style,
      tierCurrent: trait.tier_current,
    }))
    .sort((a, b) => b.style - a.style || b.numUnits - a.numUnits);
}

function hasField(obj, fieldName) {
  return Boolean(obj && Object.prototype.hasOwnProperty.call(obj, fieldName));
}

function safeCountArray(value) {
  return Array.isArray(value) ? value : [];
}

function queueLabel(queueId) {
  return QUEUE_LABELS[queueId] || `Queue ${queueId || "?"}`;
}

async function ensurePersistedCacheLoaded() {
  if (persistedCacheLoaded) return;
  try {
    const raw = await fs.readFile(PERSISTED_CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      parsed.version === PERSISTED_CACHE_VERSION &&
      parsed.players &&
      typeof parsed.players === "object"
    ) {
      persistedCache = parsed;
    }
  } catch {
    persistedCache = {
      version: PERSISTED_CACHE_VERSION,
      players: {},
    };
  }
  persistedCacheLoaded = true;
}

async function savePersistedCache() {
  await fs.mkdir(path.dirname(PERSISTED_CACHE_PATH), { recursive: true });
  await fs.writeFile(PERSISTED_CACHE_PATH, JSON.stringify(persistedCache), "utf8");
}

async function ensureAnalyticsStoreLoaded() {
  if (analyticsStoreLoaded) return;
  try {
    const raw = await fs.readFile(ANALYTICS_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      parsed.version === ANALYTICS_STORE_VERSION &&
      parsed.duos &&
      typeof parsed.duos === "object"
    ) {
      analyticsStore = parsed;
    }
  } catch {
    analyticsStore = {
      version: ANALYTICS_STORE_VERSION,
      duos: {},
    };
  }
  analyticsStoreLoaded = true;
}

async function saveAnalyticsStore() {
  await fs.mkdir(path.dirname(ANALYTICS_STORE_PATH), { recursive: true });
  await fs.writeFile(ANALYTICS_STORE_PATH, JSON.stringify(analyticsStore), "utf8");
}

function uniquePreserveOrder(values) {
  return [...new Set(values)];
}

function playerCacheKey(routingRegion, puuid) {
  return `${routingRegion}:${puuid}`;
}

function stableDuoId(puuidA, puuidB) {
  return [String(puuidA || ""), String(puuidB || "")].sort().join("::");
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function parseStage(stageRaw) {
  const raw = String(stageRaw || "").trim();
  const [majorRaw, minorRaw] = raw.split(/[-.]/);
  const major = Number(majorRaw);
  const minor = Number(minorRaw);
  return {
    stageMajor: Number.isFinite(major) ? major : null,
    stageMinor: Number.isFinite(minor) ? minor : null,
  };
}

function normalizeIconKey(value) {
  return String(value || "")
    .replace(/[^a-z0-9_]/gi, "")
    .toLowerCase();
}

function iconPathToUrl(iconPath) {
  const raw = String(iconPath || "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const asPng = lower.replace(/\.tex$/i, ".png");
  return `https://raw.communitydragon.org/latest/game/${asPng}`;
}

async function ensureTftIconManifestLoaded() {
  const ttlMs = 6 * 60 * 60 * 1000;
  if (Date.now() - tftIconManifestCache.loadedAt < ttlMs && Object.keys(tftIconManifestCache.bySet).length) {
    return;
  }

  const cdragon = await fetch("https://raw.communitydragon.org/latest/cdragon/tft/en_us.json");
  if (!cdragon.ok) {
    throw new Error(`Failed to load TFT icon manifest (${cdragon.status}).`);
  }
  const data = await cdragon.json();
  const setData = safeCountArray(data?.setData);
  const allItems = safeCountArray(data?.items);

  const augmentIconByApi = {};
  for (const item of allItems) {
    const apiName = String(item?.apiName || "");
    const icon = iconPathToUrl(item?.icon);
    if (apiName && icon && /augment/i.test(apiName)) {
      augmentIconByApi[normalizeIconKey(apiName)] = icon;
    }
  }

  const bySet = {};
  for (const setEntry of setData) {
    const setNumber = String(setEntry?.number || "").trim();
    if (!setNumber) continue;
    const traits = {};
    const augments = {};

    for (const trait of safeCountArray(setEntry?.traits)) {
      const apiName = String(trait?.apiName || "");
      const icon = iconPathToUrl(trait?.icon);
      if (apiName && icon) {
        traits[normalizeIconKey(apiName)] = icon;
      }
    }

    for (const augmentApi of safeCountArray(setEntry?.augments)) {
      const key = normalizeIconKey(augmentApi);
      const icon = augmentIconByApi[key];
      if (key && icon) {
        augments[key] = icon;
      }
    }

    bySet[setNumber] = { traits, augments };
  }

  tftIconManifestCache = {
    loadedAt: Date.now(),
    bySet,
  };
}

function ensureDuoRecord({
  duoId,
  playerAPuuid,
  playerBPuuid,
  gameNameA,
  tagLineA,
  gameNameB,
  tagLineB,
  region,
  platform,
}) {
  if (!analyticsStore.duos[duoId]) {
    analyticsStore.duos[duoId] = {
      duoId,
      createdAt: Date.now(),
      playerAPuuid,
      playerBPuuid,
      context: {
        gameNameA,
        tagLineA,
        gameNameB,
        tagLineB,
        region,
        platform,
      },
      matchesById: {},
      events: [],
      journals: [],
      weeklyGoals: [],
      playbookSnapshot: null,
    };
  }
  return analyticsStore.duos[duoId];
}

function normalizeEvent(rawEvent, fallbackMatchId = null) {
  const type = String(rawEvent?.type || "").trim();
  if (!type) return null;
  const fromStage = parseStage(rawEvent?.stage);
  const stageMajor = Number(rawEvent?.stageMajor ?? fromStage.stageMajor);
  const stageMinor = Number(rawEvent?.stageMinor ?? fromStage.stageMinor);
  const event = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type,
    matchId: rawEvent?.matchId || fallbackMatchId || null,
    stageMajor: Number.isFinite(stageMajor) ? stageMajor : null,
    stageMinor: Number.isFinite(stageMinor) ? stageMinor : null,
    actorSlot: rawEvent?.actorSlot || null,
    targetSlot: rawEvent?.targetSlot || null,
    payload: rawEvent?.payload && typeof rawEvent.payload === "object" ? rawEvent.payload : {},
    createdAt: Date.now(),
  };
  if (event.stageMajor !== null && event.stageMinor !== null) {
    event.stage = `${event.stageMajor}.${event.stageMinor}`;
  }
  return event;
}

function getDuoWindowData(duoRecord, windowDays = 30) {
  const days = Math.max(1, Math.min(365, Number(windowDays || 30)));
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const matches = Object.values(duoRecord.matchesById || {}).filter(
    (match) => Number(match?.gameDatetime || 0) >= cutoff
  );
  const matchIds = new Set(matches.map((match) => match.id));
  const events = asArray(duoRecord.events).filter(
    (event) => !event.matchId || matchIds.has(event.matchId) || Number(event.createdAt || 0) >= cutoff
  );
  return { matches, events, cutoff };
}

function patchFromGameVersion(gameVersion) {
  const raw = String(gameVersion || "");
  const match = raw.match(/(\d+)\.(\d+)/);
  if (!match) return null;
  return `${match[1]}.${match[2]}`;
}

function formatRank(entries = []) {
  if (!entries.length) return "Unranked";

  const ranked = entries.find((entry) => entry.queueType === "RANKED_TFT");
  const doubleUp = entries.find((entry) => entry.queueType === "RANKED_TFT_DOUBLE_UP");
  const hyper = entries.find((entry) => entry.queueType === "RANKED_TFT_TURBO");

  const selected = ranked || doubleUp || hyper || entries[0];
  return `${selected.tier} ${selected.rank} (${selected.leaguePoints} LP)`;
}

async function fetchPlayerData({
  gameName,
  tagLine,
  routingRegion,
  platformRegion,
  maxHistory,
  deltaHours,
}) {
  const account = await riotRequestCached(
    `https://${routingRegion}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
      gameName
    )}/${encodeURIComponent(tagLine)}`,
    CACHE_TTL.account
  );

  const key = playerCacheKey(routingRegion, account.puuid);
  const playerHistory = persistedCache.players[key];
  const hasFreshLocalHistory =
    Boolean(playerHistory?.updatedAt) &&
    Date.now() - playerHistory.updatedAt < deltaHours * 60 * 60 * 1000 &&
    safeCountArray(playerHistory?.matchIds).length > 0;

  let matchIds = [];
  if (hasFreshLocalHistory) {
    const knownIds = safeCountArray(playerHistory.matchIds);
    const knownSet = new Set(knownIds);
    const deltaIds = [];

    for (let start = 0; start < maxHistory; start += 100) {
      const chunkCount = Math.min(100, maxHistory - start);
      const chunk = await riotRequestCached(
        `https://${routingRegion}.api.riotgames.com/tft/match/v1/matches/by-puuid/${
          account.puuid
        }/ids?start=${start}&count=${chunkCount}`,
        CACHE_TTL.matchIds
      );
      const list = safeCountArray(chunk);
      if (!list.length) break;

      let reachedKnown = false;
      for (const id of list) {
        if (knownSet.has(id)) {
          reachedKnown = true;
          break;
        }
        deltaIds.push(id);
      }

      if (reachedKnown || list.length < chunkCount) {
        break;
      }
    }

    matchIds = uniquePreserveOrder([...deltaIds, ...knownIds]).slice(0, maxHistory);
  } else {
    const ids = [];
    for (let start = 0; start < maxHistory; start += 100) {
      const chunkCount = Math.min(100, maxHistory - start);
      const chunk = await riotRequestCached(
        `https://${routingRegion}.api.riotgames.com/tft/match/v1/matches/by-puuid/${
          account.puuid
        }/ids?start=${start}&count=${chunkCount}`,
        CACHE_TTL.matchIds
      );
      const list = safeCountArray(chunk);
      if (!list.length) break;
      ids.push(...list);
      if (list.length < chunkCount) break;
    }
    matchIds = ids;
  }

  persistedCache.players[key] = {
    updatedAt: Date.now(),
    matchIds: matchIds.slice(0, maxHistory),
  };
  await savePersistedCache();

  let rank = "Unranked";
  try {
    const summoner = await riotRequestCached(
      `https://${platformRegion}.api.riotgames.com/tft/summoner/v1/summoners/by-puuid/${account.puuid}`,
      CACHE_TTL.summoner
    );
    const leagueEntries = await riotRequestCached(
      `https://${platformRegion}.api.riotgames.com/tft/league/v1/entries/by-summoner/${summoner.id}`,
      CACHE_TTL.rank
    );
    rank = formatRank(leagueEntries);
  } catch {
    rank = "Unranked";
  }

  return {
    account,
    matchIds: safeCountArray(matchIds),
    rank,
  };
}

function summarizeParticipant(participant) {
  return {
    puuid: participant.puuid,
    riotIdGameName: participant.riotIdGameName ?? null,
    riotIdTagline: participant.riotIdTagline ?? null,
    placement: participant.placement ?? null,
    win: participant.win ?? null,
    level: participant.level ?? null,
    lastRound: participant.last_round ?? null,
    goldLeft: participant.gold_left ?? null,
    playersEliminated: participant.players_eliminated ?? null,
    totalDamageToPlayers: participant.total_damage_to_players ?? null,
    timeEliminated: participant.time_eliminated ?? null,
    partnerGroupId: participant.partner_group_id ?? null,
    missions: participant.missions ?? null,
    hasAugmentsField: hasField(participant, "augments"),
    augments: participant.augments ?? [],
    companion: summarizeCompanion(participant.companion),
    arena: summarizeArena(participant),
    traits: summarizeTraits(participant.traits),
    units: summarizeUnits(participant.units),
  };
}

function analyzeDuoTrends(matches) {
  if (!matches.length) {
    return {
      kpis: null,
      meta: {
        traits: [],
        units: [],
      },
      suggestions: [],
    };
  }

  const aPlacements = matches.map((m) => m.playerA.placement || 8);
  const bPlacements = matches.map((m) => m.playerB.placement || 8);
  const duoTeamGames = matches.filter((m) => m.sameTeam);
  const duoPlacements = duoTeamGames.map((m) => Math.max(m.playerA.placement || 8, m.playerB.placement || 8));
  const duoTop4 = duoPlacements.filter((p) => p <= 4).length;

  const traitCounts = {};
  const unitCounts = {};
  matches.forEach((match) => {
    safeCountArray(match.lobby).forEach((player) => {
      safeCountArray(player.traits)
        .filter((trait) => trait.style > 0)
        .forEach((trait) => {
          traitCounts[trait.name] = (traitCounts[trait.name] || 0) + 1;
        });
      safeCountArray(player.units).forEach((unit) => {
        if (unit.characterId) {
          unitCounts[unit.characterId] = (unitCounts[unit.characterId] || 0) + 1;
        }
      });
    });
  });

  const topTraits = Object.entries(traitCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));
  const topUnits = Object.entries(unitCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([characterId, count]) => ({ characterId, count }));

  const avgA = aPlacements.reduce((sum, x) => sum + x, 0) / aPlacements.length;
  const avgB = bPlacements.reduce((sum, x) => sum + x, 0) / bPlacements.length;
  const avgTeam = duoPlacements.length
    ? duoPlacements.reduce((sum, x) => sum + x, 0) / duoPlacements.length
    : null;

  const suggestionList = [];
  if (duoTeamGames.length === 0) {
    suggestionList.push(
      "Most shared matches are not detected as same-team Double Up. Queue together in Double Up to get clearer duo coaching."
    );
  }
  if (avgTeam && avgTeam > 4.5) {
    suggestionList.push(
      "Team average placement is outside Top 4. Try one consistent frontline carry-support split to reduce mid-game instability."
    );
  }
  if (topTraits.length > 0) {
    const metaNames = topTraits.slice(0, 3).map((x) => queueLabel(x.name) || x.name);
    suggestionList.push(
      `Current lobby trend shows heavy repetition of ${topTraits
        .slice(0, 3)
        .map((x) => x.name)
        .join(", ")}. Plan backup lines when these are contested early.`
    );
  }
  if (matches.some((m) => !m.playerA.hasAugmentsField || !m.playerB.hasAugmentsField)) {
    suggestionList.push(
      "Riot is not consistently returning augment data in this queue/set, so advice is weighted toward unit/trait trends."
    );
  }

  return {
    kpis: {
      gamesTogether: matches.length,
      sameTeamGames: duoTeamGames.length,
      sameTeamTop4Rate: duoTeamGames.length ? (duoTop4 / duoTeamGames.length) * 100 : null,
      avgPlacementA: avgA,
      avgPlacementB: avgB,
      avgTeamPlacement: avgTeam,
      placementsA: aPlacements,
      placementsB: bPlacements,
      teamPlacements: duoPlacements,
    },
    meta: {
      traits: topTraits,
      units: topUnits,
    },
    suggestions: suggestionList,
  };
}

app.get("/api/tft/duo-history", async (req, res) => {
  try {
    if (!riotApiKey) {
      return res.status(500).json({
        error: "RIOT_API_KEY is missing on the server. Add it to your .env file.",
      });
    }

    await ensurePersistedCacheLoaded();
    await ensureAnalyticsStoreLoaded();

    const gameNameA = String(req.query.gameNameA || "").trim();
    const tagLineA = String(req.query.tagLineA || "").trim();
    const gameNameB = String(req.query.gameNameB || "").trim();
    const tagLineB = String(req.query.tagLineB || "").trim();
    const routingRegion = String(req.query.region || "americas").trim().toLowerCase();
    const platformRegion = String(req.query.platform || "na1").trim().toLowerCase();
    const count = Math.min(Math.max(Number(req.query.count || 40), 1), 200);
    const maxHistory = Math.min(Math.max(Number(req.query.maxHistory || 200), 50), 1000);
    const deltaHours = Math.min(Math.max(Number(req.query.deltaHours || 24), 1), 168);

    if (!gameNameA || !tagLineA || !gameNameB || !tagLineB) {
      return res.status(400).json({
        error: "gameName/tagLine for both players are required.",
      });
    }

    if (!["americas", "europe", "asia"].includes(routingRegion)) {
      return res.status(400).json({
        error: "region must be one of: americas, europe, asia",
      });
    }

    const [playerA, playerB] = await Promise.all([
      fetchPlayerData({
        gameName: gameNameA,
        tagLine: tagLineA,
        routingRegion,
        platformRegion,
        maxHistory,
        deltaHours,
      }),
      fetchPlayerData({
        gameName: gameNameB,
        tagLine: tagLineB,
        routingRegion,
        platformRegion,
        maxHistory,
        deltaHours,
      }),
    ]);

    const idsB = new Set(playerB.matchIds);
    const sharedIds = playerA.matchIds.filter((id) => idsB.has(id)).slice(0, count);

    const matches = [];
    for (const id of sharedIds) {
      const match = await riotRequestCached(
        `https://${routingRegion}.api.riotgames.com/tft/match/v1/matches/${id}`,
        CACHE_TTL.match
      );

      const participants = safeCountArray(match?.info?.participants);
      const participantA = participants.find((p) => p.puuid === playerA.account.puuid);
      const participantB = participants.find((p) => p.puuid === playerB.account.puuid);
      if (!participantA || !participantB) continue;

      const summaryA = summarizeParticipant(participantA);
      const summaryB = summarizeParticipant(participantB);
      const sameTeam =
        summaryA.partnerGroupId &&
        summaryB.partnerGroupId &&
        summaryA.partnerGroupId === summaryB.partnerGroupId;

      const lobby = participants
        .map((p) => summarizeParticipant(p))
        .sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99));

      matches.push({
        id,
        queueId: match?.info?.queue_id || null,
        queueLabel: queueLabel(match?.info?.queue_id),
        gameDatetime: match?.info?.game_datetime || null,
        gameLength: match?.info?.game_length || null,
        setNumber: match?.info?.tft_set_number || null,
        gameVersion: match?.info?.game_version || null,
        patch: patchFromGameVersion(match?.info?.game_version),
        playerA: summaryA,
        playerB: summaryB,
        sameTeam,
        lobby,
      });
    }

    const analysis = analyzeDuoTrends(matches);
    const duoId = stableDuoId(playerA.account.puuid, playerB.account.puuid);
    const duoRecord = ensureDuoRecord({
      duoId,
      playerAPuuid: playerA.account.puuid,
      playerBPuuid: playerB.account.puuid,
      gameNameA: playerA.account.gameName,
      tagLineA: playerA.account.tagLine,
      gameNameB: playerB.account.gameName,
      tagLineB: playerB.account.tagLine,
      region: routingRegion,
      platform: platformRegion,
    });

    for (const match of matches) {
      duoRecord.matchesById[match.id] = match;
    }
    const maxMatches = 600;
    const sortedMatchIds = Object.keys(duoRecord.matchesById).sort((left, right) => {
      const leftTime = Number(duoRecord.matchesById[left]?.gameDatetime || 0);
      const rightTime = Number(duoRecord.matchesById[right]?.gameDatetime || 0);
      return rightTime - leftTime;
    });
    for (const staleId of sortedMatchIds.slice(maxMatches)) {
      delete duoRecord.matchesById[staleId];
    }
    await saveAnalyticsStore();

    const matchIdSet = new Set(matches.map((match) => match.id));
    const eventLog = asArray(duoRecord.events).filter((event) => !event.matchId || matchIdSet.has(event.matchId));
    const analysisV2 = buildDuoScorecard({ matches, eventLog });
    const playbook = buildPersonalizedPlaybook({ matches, eventLog });
    const highlights = buildDuoHighlights({ matches, eventLog });

    if (debugTftPayload) {
      console.log("[DEBUG_TFT_DUO]", {
        sharedMatches: matches.length,
        sameTeam: analysis?.kpis?.sameTeamGames ?? 0,
      });
    }

    const latestMatch = matches[0] || null;
    return res.json({
      players: {
        a: {
          gameName: playerA.account.gameName,
          tagLine: playerA.account.tagLine,
          puuid: playerA.account.puuid,
          rank: playerA.rank,
          tactician: latestMatch?.playerA?.companion || null,
          arena: latestMatch?.playerA?.arena || null,
        },
        b: {
          gameName: playerB.account.gameName,
          tagLine: playerB.account.tagLine,
          puuid: playerB.account.puuid,
          rank: playerB.rank,
          tactician: latestMatch?.playerB?.companion || null,
          arena: latestMatch?.playerB?.arena || null,
        },
      },
      region: routingRegion,
      platform: platformRegion,
      duoId,
      count: matches.length,
      maxHistoryScanned: maxHistory,
      deltaHours,
      matches,
      analysis,
      analysisV2,
      playbook,
      highlights,
    });
  } catch (error) {
    const isRateLimit = error.status === 429;
    const retryAfterSeconds = Number(error.retryAfter || "0");
    const status = error.status || 500;
    return res.status(status).json({
      error: isRateLimit
        ? `Riot rate limit hit (429). Try again in ${retryAfterSeconds || 5} seconds.`
        : error.message || "Unexpected server error.",
      details: error.body || null,
      retryAfterSeconds: retryAfterSeconds || null,
    });
  }
});

app.get("/api/tft/icon-manifest", async (req, res) => {
  try {
    await ensureTftIconManifestLoaded();
    const setParam = String(req.query.set || "").trim();
    const setsParam = String(req.query.sets || "").trim();
    const requestedSets = new Set();

    if (setParam) requestedSets.add(setParam);
    if (setsParam) {
      for (const token of setsParam.split(",").map((x) => x.trim()).filter(Boolean)) {
        requestedSets.add(token);
      }
    }

    const responseSets = {};
    if (requestedSets.size === 0) {
      Object.assign(responseSets, tftIconManifestCache.bySet);
    } else {
      for (const setNumber of requestedSets) {
        if (tftIconManifestCache.bySet[setNumber]) {
          responseSets[setNumber] = tftIconManifestCache.bySet[setNumber];
        }
      }
    }

    return res.json({
      loadedAt: tftIconManifestCache.loadedAt,
      sets: responseSets,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Failed to load TFT icon manifest.",
    });
  }
});

app.post("/api/duo/events/batch", async (req, res) => {
  try {
    await ensureAnalyticsStoreLoaded();
    const duoId = String(req.body?.duoId || "").trim();
    const matchId = String(req.body?.matchId || "").trim() || null;
    const events = asArray(req.body?.events);

    if (!duoId) {
      return res.status(400).json({ error: "duoId is required." });
    }
    if (!analyticsStore.duos[duoId]) {
      return res.status(404).json({ error: "Unknown duoId. Analyze duo history first to initialize duo record." });
    }
    if (!events.length) {
      return res.status(400).json({ error: "events array is required." });
    }

    const duoRecord = analyticsStore.duos[duoId];
    const normalized = events.map((event) => normalizeEvent(event, matchId)).filter(Boolean);
    if (!normalized.length) {
      return res.status(400).json({ error: "No valid events to insert." });
    }

    duoRecord.events.push(...normalized);
    if (duoRecord.events.length > 6000) {
      duoRecord.events = duoRecord.events.slice(-6000);
    }
    await saveAnalyticsStore();

    return res.json({
      ok: true,
      inserted: normalized.length,
      totalEvents: duoRecord.events.length,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to ingest events." });
  }
});

app.post("/api/duo/journal", async (req, res) => {
  try {
    await ensureAnalyticsStoreLoaded();
    const duoId = String(req.body?.duoId || "").trim();
    const matchId = String(req.body?.matchId || "").trim() || null;
    const planAt32 = String(req.body?.planAt32 || "").trim();
    const executed = Boolean(req.body?.executed);
    const tags = asArray(req.body?.tags).map((tag) => String(tag).trim()).filter(Boolean).slice(0, 8);

    if (!duoId) {
      return res.status(400).json({ error: "duoId is required." });
    }
    if (!analyticsStore.duos[duoId]) {
      return res.status(404).json({ error: "Unknown duoId. Analyze duo history first to initialize duo record." });
    }

    const duoRecord = analyticsStore.duos[duoId];
    const journal = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      matchId,
      planAt32: planAt32 || null,
      executed,
      tags,
      createdAt: Date.now(),
    };
    duoRecord.journals.push(journal);
    if (duoRecord.journals.length > 1000) {
      duoRecord.journals = duoRecord.journals.slice(-1000);
    }

    const intentEvent = normalizeEvent(
      {
        type: "intent_tag",
        matchId,
        stage: "3.2",
        payload: {
          planAt32: planAt32 || null,
          executed,
          tags,
        },
      },
      matchId
    );
    if (intentEvent) {
      duoRecord.events.push(intentEvent);
    }

    for (const tag of tags) {
      const tagEvent = normalizeEvent(
        {
          type: "mistake_tag",
          matchId,
          stage: "3.2",
          payload: { tag },
        },
        matchId
      );
      if (tagEvent) duoRecord.events.push(tagEvent);
    }

    if (duoRecord.events.length > 6000) {
      duoRecord.events = duoRecord.events.slice(-6000);
    }
    await saveAnalyticsStore();

    return res.json({
      ok: true,
      journalId: journal.id,
      totalJournals: duoRecord.journals.length,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to save journal." });
  }
});

app.get("/api/duo/scorecard", async (req, res) => {
  try {
    await ensureAnalyticsStoreLoaded();
    const duoId = String(req.query.duoId || "").trim();
    const windowDays = Math.max(1, Math.min(365, Number(req.query.windowDays || 30)));

    if (!duoId) {
      return res.status(400).json({ error: "duoId is required." });
    }
    const duoRecord = analyticsStore.duos[duoId];
    if (!duoRecord) {
      return res.status(404).json({ error: "duoId not found." });
    }

    const { matches, events } = getDuoWindowData(duoRecord, windowDays);
    const scorecard = buildDuoScorecard({ matches, eventLog: events });
    const playbook = buildPersonalizedPlaybook({ matches, eventLog: events });
    const highlights = buildDuoHighlights({ matches, eventLog: events });

    return res.json({
      duoId,
      windowDays,
      matchCount: matches.length,
      eventCount: events.length,
      scorecard,
      playbook,
      highlights,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to compute scorecard." });
  }
});

app.get("/api/duo/playbook", async (req, res) => {
  try {
    await ensureAnalyticsStoreLoaded();
    const duoId = String(req.query.duoId || "").trim();
    const windowDays = Math.max(1, Math.min(365, Number(req.query.windowDays || 30)));
    if (!duoId) {
      return res.status(400).json({ error: "duoId is required." });
    }
    const duoRecord = analyticsStore.duos[duoId];
    if (!duoRecord) {
      return res.status(404).json({ error: "duoId not found." });
    }
    const { matches, events } = getDuoWindowData(duoRecord, windowDays);
    const playbook = buildPersonalizedPlaybook({ matches, eventLog: events });
    duoRecord.playbookSnapshot = playbook;
    await saveAnalyticsStore();
    return res.json({
      duoId,
      windowDays,
      playbook,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to build playbook." });
  }
});

app.get("/api/duo/highlights", async (req, res) => {
  try {
    await ensureAnalyticsStoreLoaded();
    const duoId = String(req.query.duoId || "").trim();
    const windowDays = Math.max(1, Math.min(365, Number(req.query.windowDays || 30)));
    if (!duoId) {
      return res.status(400).json({ error: "duoId is required." });
    }
    const duoRecord = analyticsStore.duos[duoId];
    if (!duoRecord) {
      return res.status(404).json({ error: "duoId not found." });
    }
    const { matches, events } = getDuoWindowData(duoRecord, windowDays);
    const highlights = buildDuoHighlights({ matches, eventLog: events });
    return res.json({
      duoId,
      windowDays,
      highlights,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load highlights." });
  }
});

app.listen(port, () => {
  console.log(`TFT API server listening on http://localhost:${port}`);
});
