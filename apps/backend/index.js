import dotenv from "dotenv";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDuoHighlights, buildDuoScorecard, buildPersonalizedPlaybook } from "./lib/duoAnalytics.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../tftduos/.env") });

const app = express();
const port = Number(process.env.PORT || 3001);
const riotApiKey = process.env.RIOT_API_KEY;
const openAiApiKey = String(process.env.OPENAI_API_KEY || "").trim();
const openAiModel = String(process.env.OPENAI_MODEL || "gpt-4o-mini").trim();
const openAiTimeoutMs = Math.max(3000, Number(process.env.OPENAI_TIMEOUT_MS || 15000));
const openAiWebSearchEnabled = String(process.env.OPENAI_WEB_SEARCH_ENABLED || "1") !== "0";
const renderApiKey = String(process.env.RENDER_API_KEY || "").trim();
const renderApiBaseUrl = String(process.env.RENDER_API_BASE_URL || "https://api.render.com/v1")
  .trim()
  .replace(/\/+$/, "");
const renderDashboardServiceIds = String(process.env.RENDER_DASHBOARD_SERVICE_IDS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const debugTftPayload = process.env.DEBUG_TFT_PAYLOAD === "1";
const allowedOrigins = String(process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const rateLimitWindowMs = Math.max(1000, Number(process.env.RATE_LIMIT_WINDOW_MS || 60000));
const rateLimitMaxRequests = Math.max(1, Number(process.env.RATE_LIMIT_MAX_REQUESTS || 90));
const cache = new Map();
const requestBuckets = new Map();
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  const origin = String(req.headers.origin || "");
  const isAllowed =
    !origin ||
    allowedOrigins.length === 0 ||
    allowedOrigins.includes(origin);

  if (isAllowed && origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  if (isAllowed) {
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }
    return next();
  }

  return res.status(403).json({ error: "Origin not allowed." });
});

app.use("/api", (req, res, next) => {
  const now = Date.now();
  const key = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
  const bucket = requestBuckets.get(key);

  if (!bucket || now - bucket.windowStart > rateLimitWindowMs) {
    requestBuckets.set(key, { windowStart: now, count: 1 });
    return next();
  }

  if (bucket.count >= rateLimitMaxRequests) {
    const retryAfter = Math.max(1, Math.ceil((rateLimitWindowMs - (now - bucket.windowStart)) / 1000));
    res.setHeader("Retry-After", String(retryAfter));
    return res.status(429).json({
      error: "Too many requests. Please try again shortly.",
      retryAfterSeconds: retryAfter,
    });
  }

  bucket.count += 1;
  return next();
});
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
let companionManifestCache = {
  loadedAt: 0,
  byItemId: {},
  byContentId: {},
};

const CACHE_TTL = {
  account: 5 * 60 * 1000,
  matchIds: 2 * 60 * 1000,
  match: 24 * 60 * 60 * 1000,
  summoner: 5 * 60 * 1000,
  rank: 60 * 1000,
  ladder: 10 * 60 * 1000,
  ladderMatch: 10 * 60 * 1000,
};

const QUEUE_LABELS = {
  1090: "Ranked",
  1100: "Normal",
  1110: "Hyper Roll",
  1130: "Double Up",
  1160: "Ranked",
  6110: "Revival",
};

function asFiniteNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toIso(value) {
  const ms = Number(value || 0);
  return Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : null;
}

function parseMetricUnitToGb(value, unit) {
  const n = asFiniteNumber(value, null);
  if (n === null) return null;
  const normalized = String(unit || "").trim().toLowerCase();
  if (!normalized || normalized === "gb") return n;
  if (normalized === "mb") return n / 1024;
  if (normalized === "kb") return n / (1024 * 1024);
  if (normalized === "b" || normalized === "byte" || normalized === "bytes") return n / (1024 * 1024 * 1024);
  return n;
}

function metricResourceId(labels) {
  for (const label of asArray(labels)) {
    const field = String(label?.field || "").toLowerCase();
    if (field === "resource" || field === "service") {
      return String(label?.value || "").trim();
    }
  }
  return "";
}

function summarizeMetricSeries(seriesCollection) {
  const series = asArray(seriesCollection);
  let total = 0;
  let sum = 0;
  let sampleCount = 0;
  let max = null;
  let unit = null;
  const byResource = {};

  for (const item of series) {
    const resourceId = metricResourceId(item?.labels);
    const itemUnit = String(item?.unit || "").trim();
    if (!unit && itemUnit) unit = itemUnit;

    const values = asArray(item?.values)
      .map((value) => ({
        ts: Date.parse(String(value?.timestamp || "")),
        value: asFiniteNumber(value?.value, null),
      }))
      .filter((value) => value.value !== null);

    if (!values.length) continue;

    let latest = values[0];
    for (const point of values) {
      sampleCount += 1;
      total += point.value;
      sum += point.value;
      if (max === null || point.value > max) {
        max = point.value;
      }
      if (point.ts >= latest.ts) {
        latest = point;
      }
    }

    if (resourceId) {
      byResource[resourceId] = {
        latestValue: latest.value,
        latestAt: toIso(latest.ts),
        unit: itemUnit || unit || null,
        samples: values.length,
      };
    }
  }

  return {
    seriesCount: series.length,
    sampleCount,
    total,
    avg: sampleCount ? sum / sampleCount : null,
    max,
    unit,
    byResource,
  };
}

async function renderApiRequest(pathname, query = {}) {
  if (!renderApiKey) {
    const error = new Error("RENDER_API_KEY is missing.");
    error.status = 500;
    throw error;
  }

  const url = new URL(`${renderApiBaseUrl}${pathname}`);
  for (const [key, value] of Object.entries(query || {})) {
    if (value === null || value === undefined || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${renderApiKey}`,
      Accept: "application/json",
    },
  });
  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw || null;
  }

  if (!response.ok) {
    const error = new Error(`Render API request failed (${response.status}).`);
    error.status = response.status;
    error.body = data;
    throw error;
  }
  return data;
}

async function fetchRenderServices() {
  const results = [];
  let cursor = "";
  let page = 0;
  const maxPages = 10;

  while (page < maxPages) {
    const rows = await renderApiRequest("/services", {
      limit: 100,
      includePreviews: false,
      ...(cursor ? { cursor } : {}),
    });
    const list = asArray(rows);
    if (!list.length) break;

    results.push(...list.map((entry) => entry?.service || entry).filter(Boolean));
    const lastCursor = list[list.length - 1]?.cursor;
    if (!lastCursor) break;
    cursor = String(lastCursor);
    page += 1;
  }

  return results;
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/site-performance/render/overview", async (req, res) => {
  try {
    const hours = Math.max(1, Math.min(168, Number(req.query.hours || 24)));
    const resolutionSeconds = Math.max(30, Math.min(3600, Number(req.query.resolutionSeconds || 300)));
    const endTimeMs = Date.now();
    const startTimeMs = endTimeMs - hours * 60 * 60 * 1000;
    const startTime = new Date(startTimeMs).toISOString();
    const endTime = new Date(endTimeMs).toISOString();

    const allServices = await fetchRenderServices();
    const services = allServices
      .filter((service) => {
        if (!service?.id) return false;
        if (renderDashboardServiceIds.length > 0) {
          return renderDashboardServiceIds.includes(service.id);
        }
        const type = String(service?.type || "");
        return [
          "web_service",
          "static_site",
          "private_service",
          "background_worker",
          "cron_job",
        ].includes(type);
      })
      .map((service) => ({
        id: service.id,
        name: service.name || service.id,
        type: service.type || "unknown",
        suspended: service.suspended || "unknown",
        dashboardUrl: service.dashboardUrl || null,
        region:
          service?.serviceDetails?.region ||
          service?.serviceDetails?.envSpecificDetails?.region ||
          null,
        runtime:
          service?.serviceDetails?.plan ||
          service?.serviceDetails?.runtime ||
          service?.serviceDetails?.instanceType ||
          null,
      }));

    if (!services.length) {
      return res.json({
        ok: true,
        generatedAt: Date.now(),
        window: { hours, resolutionSeconds, startTime, endTime },
        services: [],
        summary: {
          serviceCount: 0,
          totalHttpRequests: 0,
          totalBandwidthBytes: 0,
          avgCpuPercent: null,
          avgMemoryGb: null,
          peakMemoryGb: null,
        },
        metrics: {},
        warnings: ["No Render services matched this dashboard filter."],
      });
    }

    const resource = services.map((service) => service.id).join(",");
    const metricQuery = {
      startTime,
      endTime,
      resolutionSeconds,
      resource,
      aggregationMethod: "AVG",
    };

    const metricEndpoints = {
      httpRequests: "/metrics/http-requests",
      bandwidth: "/metrics/bandwidth",
      cpu: "/metrics/cpu",
      memory: "/metrics/memory",
      instanceCount: "/metrics/instance-count",
    };

    const metrics = {};
    const warnings = [];

    await Promise.all(
      Object.entries(metricEndpoints).map(async ([key, pathname]) => {
        try {
          const response = await renderApiRequest(pathname, metricQuery);
          metrics[key] = summarizeMetricSeries(response);
        } catch (error) {
          metrics[key] = {
            seriesCount: 0,
            sampleCount: 0,
            total: 0,
            avg: null,
            max: null,
            unit: null,
            byResource: {},
          };
          warnings.push(`${key}: ${error?.message || "metric unavailable"}`);
        }
      })
    );

    const avgMemoryGb = parseMetricUnitToGb(metrics?.memory?.avg, metrics?.memory?.unit);
    const peakMemoryGb = parseMetricUnitToGb(metrics?.memory?.max, metrics?.memory?.unit);

    return res.json({
      ok: true,
      generatedAt: Date.now(),
      window: { hours, resolutionSeconds, startTime, endTime },
      services,
      summary: {
        serviceCount: services.length,
        totalHttpRequests: Math.round(Number(metrics?.httpRequests?.total || 0)),
        totalBandwidthBytes: Number(metrics?.bandwidth?.total || 0),
        avgCpuPercent: metrics?.cpu?.avg ?? null,
        avgMemoryGb,
        peakMemoryGb,
      },
      metrics,
      warnings,
    });
  } catch (error) {
    return res.status(error?.status || 500).json({
      ok: false,
      error:
        error?.status === 500 && String(error?.message || "").includes("RENDER_API_KEY")
          ? "RENDER_API_KEY is missing on the backend service."
          : error?.message || "Failed to load Render dashboard metrics.",
      details: error?.body || null,
    });
  }
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

function riotPlatformUrl(platformRegion, pathname) {
  return `https://${platformRegion}.api.riotgames.com${pathname}`;
}

function riotRoutingUrl(routingRegion, pathname) {
  return `https://${routingRegion}.api.riotgames.com${pathname}`;
}

async function fetchTftApexLeague(platformRegion, tier, queue = "RANKED_TFT") {
  return riotRequestCached(
    riotPlatformUrl(platformRegion, `/tft/league/v1/${tier.toLowerCase()}leagues/by-queue/${encodeURIComponent(queue)}`),
    CACHE_TTL.ladder
  );
}

async function fetchTftTierDivisionPage(platformRegion, {
  queue = "RANKED_TFT",
  tier = "DIAMOND",
  division = "I",
  page = 1,
} = {}) {
  return riotRequestCached(
    riotPlatformUrl(platformRegion, `/tft/league/v1/entries/${encodeURIComponent(queue)}/${encodeURIComponent(tier)}/${encodeURIComponent(division)}?page=${encodeURIComponent(String(page))}`),
    CACHE_TTL.ladder
  );
}

function sampleTopLadderEntries(apexSnapshots, sampleSize = 10) {
  const entries = [];
  for (const snapshot of apexSnapshots) {
    for (const entry of asArray(snapshot?.entries)) {
      if (!entry?.summonerId) continue;
      entries.push({
        tier: snapshot?.tier || null,
        rank: entry?.rank || null,
        leaguePoints: Number(entry?.leaguePoints || 0),
        wins: Number(entry?.wins || 0),
        losses: Number(entry?.losses || 0),
        summonerId: entry.summonerId,
      });
    }
  }

  return entries
    .sort((left, right) => right.leaguePoints - left.leaguePoints || right.wins - left.wins)
    .slice(0, sampleSize);
}

function summarizeQueuePopulation(apexSnapshots, tierDivisionSamples) {
  const challenger = asArray(apexSnapshots.find((entry) => entry?.tier === "CHALLENGER")?.entries).length;
  const grandmaster = asArray(apexSnapshots.find((entry) => entry?.tier === "GRANDMASTER")?.entries).length;
  const master = asArray(apexSnapshots.find((entry) => entry?.tier === "MASTER")?.entries).length;
  const apexTotal = challenger + grandmaster + master;
  const sampleTotal = asArray(tierDivisionSamples).reduce(
    (sum, sample) => sum + Number(sample?.pageSize || 0),
    0
  );
  const estimatedRankedPopulationLowerBound = apexTotal + sampleTotal;
  const apexCutoffPercentile = estimatedRankedPopulationLowerBound
    ? Number(((apexTotal / estimatedRankedPopulationLowerBound) * 100).toFixed(2))
    : null;

  return {
    rankedQueue: "RANKED_TFT",
    apexPopulation: {
      challenger,
      grandmaster,
      master,
      total: apexTotal,
    },
    tierPageSamples: tierDivisionSamples,
    estimatedRankedPopulationLowerBound,
    percentileHints: {
      apexCutoffPercentile,
      note: "Percentile hints are lower-bound estimates from apex + sampled tier pages, not full-ladder census.",
    },
  };
}

function summarizeTopLadderMetaFromMatches(topMatches) {
  const traitCounts = {};
  const championCounts = {};

  for (const snapshot of topMatches) {
    for (const trait of asArray(snapshot?.traits)) {
      const name = String(trait?.name || "");
      if (!name) continue;
      traitCounts[name] = (traitCounts[name] || 0) + 1;
    }
    for (const unit of asArray(snapshot?.units)) {
      const characterId = String(unit?.characterId || "");
      if (!characterId) continue;
      championCounts[characterId] = (championCounts[characterId] || 0) + 1;
    }
  }

  const topTraits = Object.entries(traitCounts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));
  const topChampions = Object.entries(championCounts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 12)
    .map(([characterId, count]) => ({ characterId, count }));

  return {
    topTraits,
    topChampions,
    sampledTopPlayers: topMatches.length,
  };
}

async function buildRankContextCached({ routingRegion, platformRegion }) {
  const cacheKey = `rank-context:${routingRegion}:${platformRegion}`;
  const hit = getFromCache(cacheKey);
  if (hit) return hit;
  const data = await buildRankContext({ routingRegion, platformRegion });
  return setCache(cacheKey, data, CACHE_TTL.ladder);
}

async function buildRankContext({ routingRegion, platformRegion }) {
  const queue = "RANKED_TFT";
  const [challenger, grandmaster, master, diamondI, emeraldI] = await Promise.all([
    fetchTftApexLeague(platformRegion, "challenger", queue),
    fetchTftApexLeague(platformRegion, "grandmaster", queue),
    fetchTftApexLeague(platformRegion, "master", queue),
    fetchTftTierDivisionPage(platformRegion, { queue, tier: "DIAMOND", division: "I", page: 1 }),
    fetchTftTierDivisionPage(platformRegion, { queue, tier: "EMERALD", division: "I", page: 1 }),
  ]);

  const apexSnapshots = [challenger, grandmaster, master].map((entry) => ({
    tier: String(entry?.tier || "").toUpperCase(),
    entries: asArray(entry?.entries),
  }));

  const tierDivisionSamples = [
    { tier: "DIAMOND", division: "I", page: 1, pageSize: asArray(diamondI).length },
    { tier: "EMERALD", division: "I", page: 1, pageSize: asArray(emeraldI).length },
  ];

  const topSummoners = sampleTopLadderEntries(apexSnapshots, 10);
  const topMatches = [];
  for (const entry of topSummoners) {
    try {
      const summoner = await riotRequestCached(
        riotPlatformUrl(platformRegion, `/tft/summoner/v1/summoners/${entry.summonerId}`),
        CACHE_TTL.ladder
      );
      const matchIds = await riotRequestCached(
        riotRoutingUrl(routingRegion, `/tft/match/v1/matches/by-puuid/${summoner.puuid}/ids?start=0&count=1`),
        CACHE_TTL.ladderMatch
      );
      const matchId = asArray(matchIds)[0];
      if (!matchId) continue;
      const match = await riotRequestCached(
        riotRoutingUrl(routingRegion, `/tft/match/v1/matches/${matchId}`),
        CACHE_TTL.ladderMatch
      );
      const participant = asArray(match?.info?.participants).find((item) => item?.puuid === summoner.puuid);
      if (!participant) continue;
      topMatches.push({
        summonerId: entry.summonerId,
        tier: entry.tier,
        rank: entry.rank,
        leaguePoints: entry.leaguePoints,
        traits: summarizeTraits(participant.traits).filter((trait) => Number(trait?.style || 0) > 0),
        units: summarizeUnits(participant.units),
      });
    } catch {
      // Keep context generation best-effort; partial ladder snapshots are still useful.
    }
  }

  return {
    region: routingRegion,
    platform: platformRegion,
    snapshotAt: new Date().toISOString(),
    queuePopulation: summarizeQueuePopulation(apexSnapshots, tierDivisionSamples),
    ladderMeta: summarizeTopLadderMetaFromMatches(topMatches),
  };
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

function mergeCosmeticFields(...sources) {
  const merged = {};
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    for (const [key, value] of Object.entries(source)) {
      if (value === null || value === undefined || value === "") continue;
      merged[key] = value;
    }
  }
  return merged;
}

function summarizeArena(cosmetics) {
  const arenaId = cosmetics?.fields?.arenaId ?? null;
  const skinId = cosmetics?.fields?.arenaSkinId ?? null;
  if (arenaId !== null || skinId !== null) {
    return {
      arenaId,
      skinId,
      available: true,
      source: cosmetics.source,
    };
  }

  // Preserve existing fallback shape for clients that read the legacy `arena` object directly.
  return {
    arenaId: null,
    skinId: null,
    available: false,
    source: cosmetics?.source || "tft-match-v1",
  };
}

function summarizeCosmetics(participant) {
  const riotMatchFields = mergeCosmeticFields({
    arenaId: participant?.arena_id,
    arenaSkinId: participant?.arena_skin_id,
    boomId: participant?.boom_id,
    tacticianItemId: participant?.companion?.item_ID,
    tacticianSkinId: participant?.companion?.skin_ID,
  });
  const legacyFallbackFields = mergeCosmeticFields({
    tacticianItemId: participant?.companion?.itemId,
    tacticianSkinId: participant?.companion?.skinId,
    arenaId: participant?.arenaId,
    arenaSkinId: participant?.arenaSkinId,
  });
  const enrichedFields = mergeCosmeticFields(riotMatchFields, legacyFallbackFields);
  const available = Object.keys(enrichedFields).length > 0;

  return {
    version: 1,
    available,
    source: available ? "tft-match-v1+companion" : "tft-match-v1",
    fields: available ? enrichedFields : {},
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

function riotMatchIdsEndpoint(routingRegion, puuid, query = {}) {
  const url = new URL(
    `https://${routingRegion}.api.riotgames.com/tft/match/v1/matches/by-puuid/${puuid}/ids`
  );
  for (const [key, value] of Object.entries(query || {})) {
    if (value === null || value === undefined || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
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

function companionIconPathToUrl(loadoutsIconPath) {
  const raw = String(loadoutsIconPath || "").trim();
  if (!raw) return null;
  const withoutPrefix = raw
    .replace(/^\/lol-game-data\/assets/i, "")
    .replace(/^\/lol-game-data/i, "");
  return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default${withoutPrefix}`.toLowerCase();
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

async function ensureCompanionManifestLoaded() {
  const ttlMs = 6 * 60 * 60 * 1000;
  if (Date.now() - companionManifestCache.loadedAt < ttlMs && Object.keys(companionManifestCache.byItemId).length) {
    return;
  }

  const response = await fetch(
    "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/companions.json"
  );
  if (!response.ok) {
    throw new Error(`Failed to load companion manifest (${response.status}).`);
  }
  const companions = await response.json();
  const byItemId = {};
  const byContentId = {};

  for (const entry of safeCountArray(companions)) {
    const itemId = String(entry?.itemId || "").trim();
    const contentId = String(entry?.contentId || "").trim().toLowerCase();
    const iconUrl = companionIconPathToUrl(entry?.loadoutsIcon);
    if (!iconUrl) continue;
    const summary = {
      iconUrl,
      name: entry?.name || null,
      speciesName: entry?.speciesName || null,
      rarity: entry?.rarity || null,
    };
    if (itemId) byItemId[itemId] = summary;
    if (contentId) byContentId[contentId] = summary;
  }

  companionManifestCache = {
    loadedAt: Date.now(),
    byItemId,
    byContentId,
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
  const previousSyncMs = Number(
    playerHistory?.lastSuccessfulSyncAt || playerHistory?.updatedAt || 0
  );
  const hasKnownIds = safeCountArray(playerHistory?.matchIds).length > 0;
  const hasFreshLocalHistory =
    Boolean(playerHistory?.updatedAt) &&
    Date.now() - playerHistory.updatedAt < deltaHours * 60 * 60 * 1000 &&
    hasKnownIds;

  const syncDiagnostics = {
    usedTimeWindow: false,
    usedPaginationFallback: false,
    fallbackPaginationMode: null,
    timeWindowFallbackReason: null,
    previousSyncAt: previousSyncMs > 0 ? new Date(previousSyncMs).toISOString() : null,
    lastSuccessfulSyncAt: null,
    timeWindow: {
      startTime: null,
      requests: 0,
      idsFound: 0,
    },
    pagination: {
      requests: 0,
      idsFound: 0,
    },
  };

  let matchIds = [];
  let usedTimeWindow = false;
  const knownIds = safeCountArray(playerHistory?.matchIds);
  const knownSet = new Set(knownIds);
  const canUseTimeWindow = previousSyncMs > 0 && knownIds.length > 0;
  if (canUseTimeWindow) {
    try {
      usedTimeWindow = true;
      syncDiagnostics.usedTimeWindow = true;
      // Riot match-v1 uses epoch seconds for time filters.
      const startTime = Math.max(0, Math.floor(previousSyncMs / 1000) - 5);
      syncDiagnostics.timeWindow.startTime = startTime;
      const deltaIds = [];

      for (let start = 0; start < maxHistory; start += 100) {
        const chunkCount = Math.min(100, maxHistory - start);
        const endpoint = riotMatchIdsEndpoint(routingRegion, account.puuid, {
          startTime,
          start,
          count: chunkCount,
        });
        syncDiagnostics.timeWindow.requests += 1;
        const chunk = await riotRequestCached(endpoint, CACHE_TTL.matchIds);
        const list = safeCountArray(chunk);
        if (!list.length) break;
        for (const id of list) {
          if (!knownSet.has(id)) deltaIds.push(id);
        }
        if (list.length < chunkCount) break;
      }
      syncDiagnostics.timeWindow.idsFound = deltaIds.length;
      matchIds = uniquePreserveOrder([...deltaIds, ...knownIds]).slice(0, maxHistory);
    } catch (error) {
      usedTimeWindow = false;
      syncDiagnostics.usedTimeWindow = false;
      syncDiagnostics.timeWindowFallbackReason =
        error?.status === 400
          ? "time-window-query-rejected"
          : error?.status === 404
            ? "time-window-endpoint-unavailable"
            : "time-window-request-failed";
    }
  }

  if (!usedTimeWindow && hasFreshLocalHistory) {
    syncDiagnostics.usedPaginationFallback = true;
    syncDiagnostics.fallbackPaginationMode = "delta";
    const deltaIds = [];
    const ids = [];
    for (let start = 0; start < maxHistory; start += 100) {
      const chunkCount = Math.min(100, maxHistory - start);
      const endpoint = riotMatchIdsEndpoint(routingRegion, account.puuid, {
        start,
        count: chunkCount,
      });
      syncDiagnostics.pagination.requests += 1;
      const chunk = await riotRequestCached(endpoint, CACHE_TTL.matchIds);
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
      ids.push(...list);
      if (reachedKnown) break;
      if (list.length < chunkCount) break;
    }
    syncDiagnostics.pagination.idsFound = deltaIds.length;
    matchIds = uniquePreserveOrder([...deltaIds, ...knownIds, ...ids]).slice(0, maxHistory);
  }

  if (!matchIds.length) {
    syncDiagnostics.usedPaginationFallback = true;
    syncDiagnostics.fallbackPaginationMode = hasKnownIds ? "full-refresh" : "first-load";
    const ids = [];
    for (let start = 0; start < maxHistory; start += 100) {
      const chunkCount = Math.min(100, maxHistory - start);
      const endpoint = riotMatchIdsEndpoint(routingRegion, account.puuid, {
        start,
        count: chunkCount,
      });
      syncDiagnostics.pagination.requests += 1;
      const chunk = await riotRequestCached(endpoint, CACHE_TTL.matchIds);
      const list = safeCountArray(chunk);
      if (!list.length) break;
      ids.push(...list);
      if (list.length < chunkCount) break;
    }
    syncDiagnostics.pagination.idsFound = ids.length;
    matchIds = ids;
  }

  const now = Date.now();
  syncDiagnostics.lastSuccessfulSyncAt = new Date(now).toISOString();

  persistedCache.players[key] = {
    updatedAt: now,
    lastSuccessfulSyncAt: now,
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
    syncDiagnostics,
  };
}

function summarizeParticipant(participant) {
  const cosmetics = summarizeCosmetics(participant);
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
    cosmetics,
    arena: summarizeArena(cosmetics),
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

function stripMarkdownCodeFence(text) {
  const value = String(text || "").trim();
  if (!value.startsWith("```")) return value;
  return value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function safeJsonParse(text, fallback) {
  try {
    return JSON.parse(stripMarkdownCodeFence(text));
  } catch {
    return fallback;
  }
}

function safeTopTraits(participant, limit = 4) {
  return asArray(participant?.traits)
    .filter((trait) => Number(trait?.style || 0) > 0 && trait?.name)
    .sort((left, right) => Number(right.style || 0) - Number(left.style || 0) || Number(right.numUnits || 0) - Number(left.numUnits || 0))
    .slice(0, limit)
    .map((trait) => ({
      name: String(trait.name),
      style: Number(trait.style || 0),
      numUnits: Number(trait.numUnits || 0),
    }));
}

function safeCoreUnits(participant, limit = 8) {
  return asArray(participant?.units)
    .filter((unit) => unit?.characterId)
    .sort((left, right) => Number(right.tier || 0) - Number(left.tier || 0) || Number(right.rarity || 0) - Number(left.rarity || 0))
    .slice(0, limit)
    .map((unit) => ({
      characterId: String(unit.characterId),
      tier: Number(unit.tier || 0),
      rarity: Number(unit.rarity || 0),
      items: asArray(unit.itemNames).map((item) => String(item)).filter(Boolean).slice(0, 3),
    }));
}

function dedupeStrings(values, limit = 10) {
  const out = [];
  const seen = new Set();
  for (const value of asArray(values)) {
    const token = String(value || "").trim();
    if (!token || seen.has(token)) continue;
    seen.add(token);
    out.push(token);
    if (out.length >= limit) break;
  }
  return out;
}

function teamPlacementFromPayloadMatch(match) {
  const a = Number(match?.playerA?.placement || 8);
  const b = Number(match?.playerB?.placement || 8);
  const worst = Math.max(a, b);
  return Math.max(1, Math.min(4, Math.ceil(worst / 2)));
}

function traitPairKey(match) {
  const aTop = String(match?.playerA?.traits?.[0]?.name || "").trim();
  const bTop = String(match?.playerB?.traits?.[0]?.name || "").trim();
  if (!aTop || !bTop) return "";
  return `${aTop} + ${bTop}`;
}

function buildDeterministicCoachFindings(payload) {
  const matches = asArray(payload?.matches);
  const sample = matches.length;
  const placements = matches.map(teamPlacementFromPayloadMatch);
  const top2Matches = matches.filter((m) => teamPlacementFromPayloadMatch(m) <= 2);
  const bot2Matches = matches.filter((m) => teamPlacementFromPayloadMatch(m) >= 3);
  const avgPlacement = placements.length
    ? placements.reduce((sum, value) => sum + value, 0) / placements.length
    : 0;

  let lowGoldLosses = 0;
  let lowDamageLosses = 0;
  let overlapTraitPressure = 0;
  const traitPairCounts = {};
  const buildCounts = {};

  for (const match of matches) {
    const teamPlacement = teamPlacementFromPayloadMatch(match);
    const aGold = Number(match?.playerA?.goldLeft || 0);
    const bGold = Number(match?.playerB?.goldLeft || 0);
    const aDmg = Number(match?.playerA?.damage || 0);
    const bDmg = Number(match?.playerB?.damage || 0);
    if (teamPlacement >= 3 && (aGold <= 5 || bGold <= 5)) lowGoldLosses += 1;
    if (teamPlacement >= 3 && (aDmg < 50 || bDmg < 50)) lowDamageLosses += 1;

    const pair = traitPairKey(match);
    if (pair) traitPairCounts[pair] = (traitPairCounts[pair] || 0) + 1;

    const lobbyTraits = asArray(payload?.metaSnapshot?.lobbyTraits).map((entry) => String(entry?.name || ""));
    const ownTraits = [
      ...asArray(match?.playerA?.traits).map((entry) => String(entry?.name || "")),
      ...asArray(match?.playerB?.traits).map((entry) => String(entry?.name || "")),
    ].filter(Boolean);
    const overlap = ownTraits.filter((trait) => lobbyTraits.includes(trait)).length;
    overlapTraitPressure += overlap;

    for (const unit of asArray(match?.playerA?.coreUnits)) {
      const champion = String(unit?.characterId || "");
      if (!champion) continue;
      const items = asArray(unit?.items).map((item) => String(item)).filter(Boolean).sort();
      const itemsKey = items.join(" + ") || "no-items";
      const key = `A|${champion}|${itemsKey}`;
      if (!buildCounts[key]) {
        buildCounts[key] = { player: payload?.players?.a || "Player A", champion, items, games: 0, top2: 0 };
      }
      buildCounts[key].games += 1;
      if (teamPlacement <= 2) buildCounts[key].top2 += 1;
    }

    for (const unit of asArray(match?.playerB?.coreUnits)) {
      const champion = String(unit?.characterId || "");
      if (!champion) continue;
      const items = asArray(unit?.items).map((item) => String(item)).filter(Boolean).sort();
      const itemsKey = items.join(" + ") || "no-items";
      const key = `B|${champion}|${itemsKey}`;
      if (!buildCounts[key]) {
        buildCounts[key] = { player: payload?.players?.b || "Player B", champion, items, games: 0, top2: 0 };
      }
      buildCounts[key].games += 1;
      if (teamPlacement <= 2) buildCounts[key].top2 += 1;
    }
  }

  const sortedTraitPairs = Object.entries(traitPairCounts)
    .sort((left, right) => right[1] - left[1])
    .map(([pair, count]) => ({ pair, count }));

  const championBuilds = Object.values(buildCounts)
    .map((row) => ({
      ...row,
      top2Rate: row.games ? (row.top2 / row.games) * 100 : 0,
    }))
    .filter((row) => row.games >= 2)
    .sort((left, right) => right.top2Rate - left.top2Rate || right.games - left.games)
    .slice(0, 8)
    .map((row) => ({
      player: row.player,
      champion: row.champion,
      items: row.items,
      games: row.games,
      top2Rate: Number(row.top2Rate.toFixed(1)),
      note: row.top2Rate >= 55 ? "High-conversion build" : "Monitor; medium conversion",
    }));

  const topImprovementAreas = [];
  if (avgPlacement > 2.75) {
    topImprovementAreas.push(`Average team placement is ${avgPlacement.toFixed(2)}. Stabilize one low-variance board before both greed.`);
  }
  if (lowGoldLosses >= Math.max(2, Math.floor(sample * 0.18))) {
    topImprovementAreas.push(`Low-gold losses: ${lowGoldLosses}/${sample}. Delay panic all-ins unless immediate lethal risk.`);
  }
  if (lowDamageLosses >= Math.max(2, Math.floor(sample * 0.16))) {
    topImprovementAreas.push(`Low-damage losses: ${lowDamageLosses}/${sample}. Prioritize earlier carry completion over marginal econ greed.`);
  }
  if (overlapTraitPressure >= Math.max(6, sample)) {
    topImprovementAreas.push(`Trait overlap pressure is high (${overlapTraitPressure} overlap hits). You are over-indexing contested lines.`);
  }
  if (!topImprovementAreas.length) {
    topImprovementAreas.push("No severe issue pattern detected in this window; tighten execution consistency.");
  }

  const winConditions = [];
  if (sortedTraitPairs.length) {
    const bestPair = sortedTraitPairs[0];
    winConditions.push(
      `Most repeatable trait split: ${bestPair.pair} (${bestPair.count} games). Keep this as default when uncontested.`
    );
  }
  if (top2Matches.length && bot2Matches.length) {
    const top2AvgLevel = top2Matches.reduce(
      (sum, match) => sum + Number(match?.playerA?.level || 0) + Number(match?.playerB?.level || 0),
      0
    ) / (top2Matches.length * 2);
    const bot2AvgLevel = bot2Matches.reduce(
      (sum, match) => sum + Number(match?.playerA?.level || 0) + Number(match?.playerB?.level || 0),
      0
    ) / (bot2Matches.length * 2);
    winConditions.push(
      `Top2 avg level ${top2AvgLevel.toFixed(2)} vs Bottom2 ${bot2AvgLevel.toFixed(2)}. Earlier stabilization correlates with stronger finishes.`
    );
  }
  if (championBuilds.length) {
    const bestBuild = championBuilds[0];
    winConditions.push(
      `${bestBuild.player} build signal: ${bestBuild.champion} + ${bestBuild.items.join(", ") || "flex"} -> Top2 ${bestBuild.top2Rate}% (${bestBuild.games} games).`
    );
  }
  if (!winConditions.length) {
    winConditions.push("Not enough high-confidence win-condition signals yet. Increase same-team sample and event logging.");
  }

  const fiveGamePlan = [
    "Game 1-2: force one tempo + one econ role by Stage 2 carousel; avoid double-greed starts.",
    "Game 1-5: pre-commit one pivot line each if primary traits are contested by 2+ players.",
    "Game 1-5: log one rescue/gift/roll event every game to improve coaching confidence.",
    "Game 3-5: if both rolled same stage in prior game, enforce roll staggering next queue.",
    "After 5 games: keep only adjustments that improved Top2 rate vs current baseline.",
  ];

  return {
    sampleSize: sample,
    avgTeamPlacement: Number(avgPlacement.toFixed(2)),
    topImprovementAreas: topImprovementAreas.slice(0, 4),
    winConditions: winConditions.slice(0, 4),
    fiveGamePlan,
    championBuilds,
    confidenceBand: sample >= 25 ? "high" : sample >= 12 ? "medium" : "low",
  };
}

function extractResponsesModelOutput(parsedResponse) {
  if (!parsedResponse || typeof parsedResponse !== "object") return {};

  const directText = String(parsedResponse?.output_text || "").trim();
  if (directText) {
    const parsed = safeJsonParse(directText, null);
    if (parsed && typeof parsed === "object") return parsed;
  }

  const contents = asArray(parsedResponse?.output).flatMap((entry) => asArray(entry?.content));
  for (const content of contents) {
    const maybeJson = content?.json;
    if (maybeJson && typeof maybeJson === "object") return maybeJson;

    const maybeText = String(content?.text || "").trim();
    if (maybeText) {
      const parsed = safeJsonParse(maybeText, null);
      if (parsed && typeof parsed === "object") return parsed;
    }
  }

  return {};
}

function summarizeResponsesOutput(parsedResponse) {
  const outputSummary = asArray(parsedResponse?.output)
    .map((entry) => {
      const contentTypes = asArray(entry?.content).map((content) => String(content?.type || "unknown"));
      return `${String(entry?.type || "unknown")}:${contentTypes.join("|") || "none"}`;
    })
    .join(", ");
  return outputSummary || "none";
}

function fallbackAiCoaching(payload) {
  const decisionGrade = Number(payload?.metrics?.decisionGrade || 0);
  const top2Rate = Number(payload?.metrics?.top2Rate || 0);
  const avgPlacement = Number(payload?.metrics?.avgPlacement || 0);
  const momentum = Number(payload?.metrics?.momentum || 0);
  const duoRisk = Number(payload?.metrics?.duoRisk || 0);
  const playerAName = String(payload?.players?.a || "Player A");
  const playerBName = String(payload?.players?.b || "Player B");
  const fallback = {
    headline: "LLM unavailable - deterministic coaching fallback",
    summary: `Decision ${decisionGrade}/100, Top2 ${top2Rate.toFixed(1)}%, Avg ${avgPlacement.toFixed(
      2
    )}, Momentum ${momentum >= 0 ? "+" : ""}${momentum.toFixed(2)}, Risk ${duoRisk}%.`,
    metaRead: [
      "Meta comparison is inferred from your lobby trends in the current filter.",
      "Assume contested lines are high if your top traits/units mirror lobby-most-played lists.",
    ],
    teamPlan: [
      "Commit one tempo and one econ role by Stage 2 carousel.",
      "If both players are bleeding, only one player rolls hard at a time.",
      "Log one event each game (gift/rescue/roll) to improve coaching precision.",
    ],
    playerPlans: [
      {
        player: playerAName,
        focus: "Stability and conversion",
        actions: [
          "Avoid panic roll below 10 gold before Stage 4 unless lethal is imminent.",
          "Slam one DPS component earlier when damage trend is low.",
        ],
      },
      {
        player: playerBName,
        focus: "Support timing and clutch setup",
        actions: [
          "Pre-call one rescue trigger each stage and execute immediately.",
          "Send gifts only when partner has immediate spike conversion.",
        ],
      },
    ],
    patchContext: "No live patch-note feed attached in this request; recommendations are trend-inferred.",
    metaDelta: [
      "Your builds are compared against lobby-trend proxies, not a live external comp tier feed.",
    ],
    topImprovementAreas: [
      "Fallback mode: use deterministic issue detection while live AI is unavailable.",
    ],
    winConditions: [
      "Fallback mode: prioritize your most repeatable uncontested trait split.",
    ],
    fiveGamePlan: [
      "Next 5 games: lock one tempo + one econ role by Stage 2.",
      "Next 5 games: each player pre-commits one pivot line.",
      "Next 5 games: log one coaching event per game for stronger analysis.",
    ],
    championBuilds: [],
    confidence: "low",
    sources: ["local-fallback"],
  };
  return fallback;
}

async function fetchOpenAiCoaching(payload, deterministicFindings = null) {
  if (!openAiApiKey) {
    return {
      fallback: true,
      data: fallbackAiCoaching(payload),
      reason: "OPENAI_API_KEY missing",
      webSearchUsed: false,
    };
  }

  const systemPrompt = [
    "You are an expert TFT Double Up coach focused on helping a duo climb rank.",
    "You must compare their current filtered match patterns against current patch/meta expectations.",
    "In your analysis include: contested lines, unit/item tendencies, likely buff/nerf pressure, and rank-appropriate risk.",
    "If web sources are available, use them for current patch builds, items, and buff/nerf context.",
    "If web sources are unavailable or uncertain, explicitly say assumptions are inferred from lobby trends and current patch id.",
    "Never fabricate exact patch-note facts that are not supported by provided data or citations.",
    "Return strict JSON only.",
    "Use only supplied numbers; never invent stats.",
    "Keep advice concise, concrete, and execution-focused.",
  ].join(" ");

  const userPrompt = JSON.stringify({
    task: "Generate a rank-climbing coaching briefing for this duo.",
    context: {
      objective:
        payload?.objective ||
        "Climb rank in TFT Double Up as a duo.",
      deterministicFindings: deterministicFindings || {},
      requiredComparisons: [
        "Compare duo tendencies vs current web/meta pressure.",
        "Identify where their unit/item patterns look outdated or over-contested.",
        "Suggest safer alternatives for their current rank and sample size.",
      ],
    },
    schema: {
      headline: "string",
      summary: "string",
      metaRead: ["string"],
      teamPlan: ["string"],
      playerPlans: [{ player: "string", focus: "string", actions: ["string"] }],
      patchContext: "string",
      metaDelta: ["string"],
      topImprovementAreas: ["string"],
      winConditions: ["string"],
      fiveGamePlan: ["string"],
      championBuilds: [{ player: "string", champion: "string", items: ["string"], games: "number", top2Rate: "number", note: "string" }],
      confidence: "low|medium|high",
      sources: ["string"],
    },
    input: payload,
  });

  try {
    async function fetchWithTimeout(url, init) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), openAiTimeoutMs);
      try {
        return await fetch(url, {
          ...init,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
    }

    function normalizeModelOutput(modelOutput, citations = []) {
      return {
        headline: String(modelOutput?.headline || "AI Coaching Brief"),
        summary: String(modelOutput?.summary || ""),
        metaRead: asArray(modelOutput?.metaRead).map((x) => String(x)).filter(Boolean).slice(0, 5),
        teamPlan: asArray(modelOutput?.teamPlan).map((x) => String(x)).filter(Boolean).slice(0, 5),
        playerPlans: asArray(modelOutput?.playerPlans)
          .map((row) => ({
            player: String(row?.player || ""),
            focus: String(row?.focus || ""),
            actions: asArray(row?.actions).map((x) => String(x)).filter(Boolean).slice(0, 4),
          }))
          .filter((row) => row.player && (row.focus || row.actions.length))
          .slice(0, 3),
        patchContext: String(modelOutput?.patchContext || ""),
        metaDelta: asArray(modelOutput?.metaDelta).map((x) => String(x)).filter(Boolean).slice(0, 5),
        topImprovementAreas: asArray(modelOutput?.topImprovementAreas).map((x) => String(x)).filter(Boolean).slice(0, 4),
        winConditions: asArray(modelOutput?.winConditions).map((x) => String(x)).filter(Boolean).slice(0, 4),
        fiveGamePlan: asArray(modelOutput?.fiveGamePlan).map((x) => String(x)).filter(Boolean).slice(0, 5),
        championBuilds: asArray(modelOutput?.championBuilds)
          .map((row) => ({
            player: String(row?.player || ""),
            champion: String(row?.champion || ""),
            items: asArray(row?.items).map((x) => String(x)).filter(Boolean).slice(0, 4),
            games: Number(row?.games || 0),
            top2Rate: Number(row?.top2Rate || 0),
            note: String(row?.note || ""),
          }))
          .filter((row) => row.player && row.champion)
          .slice(0, 8),
        confidence: ["low", "medium", "high"].includes(String(modelOutput?.confidence || ""))
          ? String(modelOutput.confidence)
          : String(deterministicFindings?.confidenceBand || "medium"),
        sources: dedupeStrings(
          [
            ...asArray(modelOutput?.sources).map((x) => String(x)).filter(Boolean),
            ...citations,
          ],
          10
        ),
      };
    }

    async function requestResponses(useWebSearch) {
      try {
        const responsePayload = {
          model: openAiModel,
          temperature: 0.45,
          text: {
            format: {
              type: "json_schema",
              name: "duo_coaching_brief",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  headline: { type: "string" },
                  summary: { type: "string" },
                  metaRead: { type: "array", items: { type: "string" } },
                  teamPlan: { type: "array", items: { type: "string" } },
                  playerPlans: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        player: { type: "string" },
                        focus: { type: "string" },
                        actions: { type: "array", items: { type: "string" } },
                      },
                      required: ["player", "focus", "actions"],
                    },
                  },
                  patchContext: { type: "string" },
                  metaDelta: { type: "array", items: { type: "string" } },
                  topImprovementAreas: { type: "array", items: { type: "string" } },
                  winConditions: { type: "array", items: { type: "string" } },
                  fiveGamePlan: { type: "array", items: { type: "string" } },
                  championBuilds: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        player: { type: "string" },
                        champion: { type: "string" },
                        items: { type: "array", items: { type: "string" } },
                        games: { type: "number" },
                        top2Rate: { type: "number" },
                        note: { type: "string" },
                      },
                      required: ["player", "champion", "items", "games", "top2Rate", "note"],
                    },
                  },
                  confidence: { type: "string", enum: ["low", "medium", "high"] },
                  sources: { type: "array", items: { type: "string" } },
                },
                required: [
                  "headline",
                  "summary",
                  "metaRead",
                  "teamPlan",
                  "playerPlans",
                  "patchContext",
                  "metaDelta",
                  "topImprovementAreas",
                  "winConditions",
                  "fiveGamePlan",
                  "championBuilds",
                  "confidence",
                  "sources",
                ],
              },
            },
          },
          input: [
            { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
            { role: "user", content: [{ type: "input_text", text: userPrompt }] },
          ],
          tools: useWebSearch
            ? [
                {
                  type: "web_search_preview",
                  search_context_size: "medium",
                },
              ]
            : [],
        };

        const response = await fetchWithTimeout("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openAiApiKey}`,
          },
          body: JSON.stringify(responsePayload),
        });

        const raw = await response.text();
        if (!response.ok) {
          return {
            ok: false,
            reason: `OpenAI request failed (${response.status})`,
            detail: raw.slice(0, 500),
            modelOutput: {},
            citations: [],
            outputSummary: "none",
          };
        }

        const parsedResponse = safeJsonParse(raw, {});
        const modelOutput = extractResponsesModelOutput(parsedResponse);
        const citations = dedupeStrings(
          asArray(parsedResponse?.output)
            .flatMap((entry) => asArray(entry?.content))
            .flatMap((contentEntry) => asArray(contentEntry?.annotations))
            .map((annotation) => annotation?.url || annotation?.title)
        );

        return {
          ok: true,
          reason: null,
          detail: null,
          modelOutput,
          citations,
          outputSummary: summarizeResponsesOutput(parsedResponse),
        };
      } catch (error) {
        return {
          ok: false,
          reason: error?.name === "AbortError"
            ? `OpenAI responses request timed out${useWebSearch ? " (web search)" : ""}`
            : "OpenAI responses request error",
          detail: String(error?.message || ""),
          modelOutput: {},
          citations: [],
          outputSummary: "none",
        };
      }
    }

    async function requestChatCompletions() {
      try {
        const response = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openAiApiKey}`,
          },
          body: JSON.stringify({
            model: openAiModel,
            temperature: 0.35,
            max_tokens: 1100,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          }),
        });

        const raw = await response.text();
        if (!response.ok) {
          return {
            ok: false,
            reason: `OpenAI chat fallback failed (${response.status})`,
            detail: raw.slice(0, 500),
            modelOutput: {},
          };
        }

        const parsed = safeJsonParse(raw, {});
        const content = String(parsed?.choices?.[0]?.message?.content || "").trim();
        const modelOutput = safeJsonParse(content, {});
        return {
          ok: true,
          reason: null,
          detail: null,
          modelOutput,
        };
      } catch (error) {
        return {
          ok: false,
          reason: error?.name === "AbortError" ? "OpenAI chat fallback timed out" : "OpenAI chat fallback error",
          detail: String(error?.message || ""),
          modelOutput: {},
        };
      }
    }

    let attempt = await requestResponses(openAiWebSearchEnabled);
    let webSearchUsed = openAiWebSearchEnabled && attempt.citations.length > 0;

    // Some accounts/models return structured output in an unexpected shape when web search is enabled.
    if ((!attempt.ok || !attempt.modelOutput || !Object.keys(attempt.modelOutput).length) && openAiWebSearchEnabled) {
      attempt = await requestResponses(false);
      webSearchUsed = false;
    }

    if (!attempt.ok) {
      return {
        fallback: true,
        data: fallbackAiCoaching(payload),
        reason: attempt.reason,
        detail: attempt.detail,
        webSearchUsed: false,
      };
    }

    let normalized = normalizeModelOutput(attempt.modelOutput, attempt.citations);
    normalized.topImprovementAreas = normalized.topImprovementAreas.length
      ? normalized.topImprovementAreas
      : asArray(deterministicFindings?.topImprovementAreas).slice(0, 4);
    normalized.winConditions = normalized.winConditions.length
      ? normalized.winConditions
      : asArray(deterministicFindings?.winConditions).slice(0, 4);
    normalized.fiveGamePlan = normalized.fiveGamePlan.length
      ? normalized.fiveGamePlan
      : asArray(deterministicFindings?.fiveGamePlan).slice(0, 5);
    normalized.championBuilds = normalized.championBuilds.length
      ? normalized.championBuilds
      : asArray(deterministicFindings?.championBuilds).slice(0, 8);

    if (!normalized.summary && !normalized.teamPlan.length) {
      const chatAttempt = await requestChatCompletions();
      if (chatAttempt.ok && chatAttempt.modelOutput && Object.keys(chatAttempt.modelOutput).length) {
        normalized = normalizeModelOutput(chatAttempt.modelOutput, []);
      }
    }

    if (!normalized.summary && !normalized.teamPlan.length) {
      return {
        fallback: true,
        data: fallbackAiCoaching(payload),
        reason: `Empty model response (output: ${attempt.outputSummary})`,
        webSearchUsed: false,
      };
    }
    return {
      fallback: false,
      data: normalized,
      reason: null,
      webSearchUsed,
    };
  } catch (error) {
    return {
      fallback: true,
      data: fallbackAiCoaching(payload),
      reason: error?.name === "AbortError" ? "OpenAI request timed out" : "OpenAI request error",
      webSearchUsed: false,
    };
  }
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
    let rankContext = null;
    try {
      rankContext = await buildRankContextCached({
        routingRegion,
        platformRegion,
      });
    } catch {
      rankContext = {
        region: routingRegion,
        platform: platformRegion,
        snapshotAt: new Date().toISOString(),
        queuePopulation: null,
        ladderMeta: {
          topTraits: [],
          topChampions: [],
          sampledTopPlayers: 0,
        },
      };
    }
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
        playerSync: {
          a: playerA.syncDiagnostics,
          b: playerB.syncDiagnostics,
        },
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
      rankContext,
      analysisV2,
      playbook,
      highlights,
      ...(debugTftPayload
        ? {
            debug: {
              syncDiagnostics: {
                playerA: playerA.syncDiagnostics,
                playerB: playerB.syncDiagnostics,
              },
              sharedMatchQuality: {
                sharedMatchCount: sharedIds.length,
                sameTeamGames: analysis?.kpis?.sameTeamGames ?? 0,
                sameTeamRate: analysis?.kpis?.sameTeamRate ?? null,
              },
            },
          }
        : {}),
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

app.get("/api/tft/companion-manifest", async (req, res) => {
  try {
    await ensureCompanionManifestLoaded();
    const itemIds = String(req.query.itemIds || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const contentIds = String(req.query.contentIds || "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    const byItemId = {};
    const byContentId = {};
    for (const itemId of itemIds) {
      if (companionManifestCache.byItemId[itemId]) {
        byItemId[itemId] = companionManifestCache.byItemId[itemId];
      }
    }
    for (const contentId of contentIds) {
      if (companionManifestCache.byContentId[contentId]) {
        byContentId[contentId] = companionManifestCache.byContentId[contentId];
      }
    }

    return res.json({
      loadedAt: companionManifestCache.loadedAt,
      byItemId,
      byContentId,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Failed to load companion manifest.",
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

app.post("/api/coach/llm-brief", async (req, res) => {
  try {
    const input = req.body && typeof req.body === "object" ? req.body : {};
    const matches = asArray(input?.matches).slice(0, 60);
    const payload = {
      filter: {
        timelineDays: Number(input?.filter?.timelineDays || 30),
        set: String(input?.filter?.set || "all"),
        patch: String(input?.filter?.patch || "all"),
      },
      players: {
        a: String(input?.players?.a || "Player A"),
        b: String(input?.players?.b || "Player B"),
        rankA: String(input?.players?.rankA || "Unranked"),
        rankB: String(input?.players?.rankB || "Unranked"),
      },
      objective: String(input?.objective || "Climb rank in TFT Double Up as a duo."),
      metrics: {
        duoRisk: Number(input?.metrics?.duoRisk || 0),
        decisionGrade: Number(input?.metrics?.decisionGrade || 0),
        top2Rate: Number(input?.metrics?.top2Rate || 0),
        winRate: Number(input?.metrics?.winRate || 0),
        avgPlacement: Number(input?.metrics?.avgPlacement || 0),
        momentum: Number(input?.metrics?.momentum || 0),
        rescueRate: Number(input?.metrics?.rescueRate || 0),
        clutchIndex: Number(input?.metrics?.clutchIndex || 0),
        eventSample: Number(input?.metrics?.eventSample || 0),
      },
      coachingIntel: input?.coachingIntel && typeof input.coachingIntel === "object" ? input.coachingIntel : {},
      scorecard: input?.scorecard && typeof input.scorecard === "object" ? input.scorecard : {},
      metaSnapshot: input?.metaSnapshot && typeof input.metaSnapshot === "object" ? input.metaSnapshot : {},
      matches: matches.map((match) => ({
        id: String(match?.id || ""),
        gameDatetime: Number(match?.gameDatetime || 0),
        patch: String(match?.patch || ""),
        setNumber: match?.setNumber ?? null,
        sameTeam: Boolean(match?.sameTeam),
        playerA: {
          placement: Number(match?.playerA?.placement || 0),
          level: Number(match?.playerA?.level || 0),
          damage: Number(match?.playerA?.totalDamageToPlayers || 0),
          goldLeft: Number(match?.playerA?.goldLeft || 0),
          traits: safeTopTraits(match?.playerA, 4),
          coreUnits: safeCoreUnits(match?.playerA, 8),
        },
        playerB: {
          placement: Number(match?.playerB?.placement || 0),
          level: Number(match?.playerB?.level || 0),
          damage: Number(match?.playerB?.totalDamageToPlayers || 0),
          goldLeft: Number(match?.playerB?.goldLeft || 0),
          traits: safeTopTraits(match?.playerB, 4),
          coreUnits: safeCoreUnits(match?.playerB, 8),
        },
      })),
    };

    const deterministicFindings = buildDeterministicCoachFindings(payload);
    const ai = await fetchOpenAiCoaching(payload, deterministicFindings);
    return res.json({
      ok: true,
      fallback: ai.fallback,
      reason: ai.reason || null,
      model: openAiModel,
      webSearchUsed: Boolean(ai.webSearchUsed),
      generatedAt: Date.now(),
      deterministicFindings,
      brief: ai.data,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to generate AI coaching brief.",
    });
  }
});

app.use((_req, res) => {
  return res.status(404).json({ error: "Not found." });
});

app.listen(port, () => {
  console.log(`brianz backend listening on http://localhost:${port}`);
});
