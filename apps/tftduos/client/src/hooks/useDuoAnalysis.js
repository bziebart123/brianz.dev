import { useEffect, useMemo, useRef, useState } from "react";
import {
  DISPLAY_NAME_A,
  DISPLAY_NAME_B,
  HARD_CODED_QUERY,
} from "../config/constants";
import {
  asArray,
  comparePatchVersionsDesc,
  patchFromVersion,
  prettyName,
  summarizeFromMatches,
  teamPlacementFromMatch,
  toEpochMs,
} from "../utils/tft";
import { buildCoachingIntel } from "../utils/coachingIntel";

const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");
const EMPTY_MATCHES = [];
const EMPTY_ICON_MANIFEST = { traits: {}, augments: {} };
const EMPTY_COMPANION_MANIFEST = { byItemId: {}, byContentId: {} };

function apiUrl(path) {
  if (!API_BASE_URL) return path;
  return `${API_BASE_URL}${path}`;
}

function compactMatchForAi(match) {
  const aTraits = asArray(match?.playerA?.traits)
    .slice(0, 8)
    .map((trait) => ({
      name: trait?.name || null,
      style: Number(trait?.style || 0),
      numUnits: Number(trait?.numUnits || 0),
    }));
  const bTraits = asArray(match?.playerB?.traits)
    .slice(0, 8)
    .map((trait) => ({
      name: trait?.name || null,
      style: Number(trait?.style || 0),
      numUnits: Number(trait?.numUnits || 0),
    }));

  const aUnits = asArray(match?.playerA?.units)
    .slice(0, 10)
    .map((unit) => ({
      characterId: unit?.characterId || null,
      tier: Number(unit?.tier || 0),
      rarity: Number(unit?.rarity || 0),
      itemNames: asArray(unit?.itemNames || unit?.items).slice(0, 3),
    }));
  const bUnits = asArray(match?.playerB?.units)
    .slice(0, 10)
    .map((unit) => ({
      characterId: unit?.characterId || null,
      tier: Number(unit?.tier || 0),
      rarity: Number(unit?.rarity || 0),
      itemNames: asArray(unit?.itemNames || unit?.items).slice(0, 3),
    }));

  return {
    id: String(match?.id || ""),
    gameDatetime: Number(match?.gameDatetime || 0),
    patch: String(match?.patch || ""),
    setNumber: match?.setNumber ?? null,
    sameTeam: Boolean(match?.sameTeam),
    playerA: {
      placement: Number(match?.playerA?.placement || 0),
      level: Number(match?.playerA?.level || 0),
      totalDamageToPlayers: Number(match?.playerA?.totalDamageToPlayers || 0),
      goldLeft: Number(match?.playerA?.goldLeft || 0),
      traits: aTraits,
      units: aUnits,
    },
    playerB: {
      placement: Number(match?.playerB?.placement || 0),
      level: Number(match?.playerB?.level || 0),
      totalDamageToPlayers: Number(match?.playerB?.totalDamageToPlayers || 0),
      goldLeft: Number(match?.playerB?.goldLeft || 0),
      traits: bTraits,
      units: bUnits,
    },
  };
}

export default function useDuoAnalysis() {
  const [activeTab, setActiveTab] = useState("history");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);
  const [rateLimitMessage, setRateLimitMessage] = useState("");
  const [retryQuery, setRetryQuery] = useState("");
  const [payload, setPayload] = useState(null);
  const [enableWildCorrelations, setEnableWildCorrelations] = useState(() => {
    try {
      const raw = localStorage.getItem("tftduos-enable-wild-correlations");
      return raw === "1";
    } catch {
      return false;
    }
  });

  const [timelineDays, setTimelineDays] = useState("30");
  const [setFilter, setSetFilter] = useState("all");
  const [patchFilter, setPatchFilter] = useState("__current");
  const [currentPatch, setCurrentPatch] = useState("");
  const [didAutoSelectFilters, setDidAutoSelectFilters] = useState(false);

  const [coachMatchId, setCoachMatchId] = useState("");
  const [planAt32, setPlanAt32] = useState("");
  const [executedPlan, setExecutedPlan] = useState("");
  const [tagPanicRoll, setTagPanicRoll] = useState(false);
  const [tagMissedGift, setTagMissedGift] = useState(false);
  const [tagBothRoll, setTagBothRoll] = useState(false);
  const [quickStage, setQuickStage] = useState("4.1");
  const [quickActor, setQuickActor] = useState("A");
  const [coachSaving, setCoachSaving] = useState(false);
  const [coachMessage, setCoachMessage] = useState("");
  const [aiCoaching, setAiCoaching] = useState(null);
  const [aiCoachingLoading, setAiCoachingLoading] = useState(false);
  const [aiCoachingError, setAiCoachingError] = useState("");
  const [iconManifest, setIconManifest] = useState(EMPTY_ICON_MANIFEST);
  const [companionManifest, setCompanionManifest] = useState(EMPTY_COMPANION_MANIFEST);
  const hasAutoLoadedRef = useRef(false);
  const aiRequestKeyRef = useRef("");

  useEffect(() => {
    let active = true;
    async function loadCurrentPatch() {
      try {
        const response = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
        const versions = await response.json();
        const patch = patchFromVersion(Array.isArray(versions) ? versions[0] : "");
        if (active && patch) setCurrentPatch(patch);
      } catch {
        if (active) setCurrentPatch("");
      }
    }
    loadCurrentPatch();
    return () => {
      active = false;
    };
  }, []);

  const matches = useMemo(() => {
    const next = asArray(payload?.matches);
    return next.length ? next : EMPTY_MATCHES;
  }, [payload?.matches]);
  const duoId = payload?.duoId || "";

  const availableSets = useMemo(() => {
    const setValues = [...new Set(matches.map((m) => m.setNumber).filter((x) => x !== null))];
    return setValues.sort((a, b) => b - a);
  }, [matches]);

  useEffect(() => {
    const companions = matches.flatMap((match) => [match?.playerA?.companion, match?.playerB?.companion]).filter(Boolean);
    if (!companions.length) {
      setCompanionManifest((current) => {
        if (Object.keys(current.byItemId || {}).length || Object.keys(current.byContentId || {}).length) {
          return EMPTY_COMPANION_MANIFEST;
        }
        return current;
      });
      return;
    }

    const itemIds = [...new Set(companions.map((entry) => String(entry?.itemId ?? entry?.item_ID ?? "").trim()).filter(Boolean))];
    const contentIds = [
      ...new Set(companions.map((entry) => String(entry?.contentId ?? entry?.content_ID ?? "").trim().toLowerCase()).filter(Boolean)),
    ];
    if (!itemIds.length && !contentIds.length) {
      setCompanionManifest((current) => {
        if (Object.keys(current.byItemId || {}).length || Object.keys(current.byContentId || {}).length) {
          return EMPTY_COMPANION_MANIFEST;
        }
        return current;
      });
      return;
    }

    let active = true;
    async function loadCompanionManifest() {
      try {
        const params = new URLSearchParams();
        if (itemIds.length) params.set("itemIds", itemIds.join(","));
        if (contentIds.length) params.set("contentIds", contentIds.join(","));
        const response = await fetch(apiUrl(`/api/tft/companion-manifest?${params.toString()}`));
        const data = await response.json();
        if (!response.ok || !active) return;
        setCompanionManifest({
          byItemId: data?.byItemId || {},
          byContentId: data?.byContentId || {},
        });
      } catch {
        if (active) setCompanionManifest(EMPTY_COMPANION_MANIFEST);
      }
    }

    loadCompanionManifest();
    return () => {
      active = false;
    };
  }, [matches]);

  const availablePatches = useMemo(() => {
    const patchValues = [...new Set(matches.map((m) => m.patch).filter(Boolean))];
    return patchValues.sort(comparePatchVersionsDesc);
  }, [matches]);

  useEffect(() => {
    setDidAutoSelectFilters(false);
  }, [payload]);

  useEffect(() => {
    if (!matches.length || didAutoSelectFilters) return;

    const timelineCandidates = ["30", "7", "90", "0"];
    const now = Date.now();
    let nextTimeline = "0";

    for (const candidate of timelineCandidates) {
      const days = Number(candidate);
      const cutoff = days > 0 ? now - days * 24 * 60 * 60 * 1000 : null;
      const hasData = matches.some((m) => toEpochMs(m.gameDatetime) >= (cutoff || 0));
      if (hasData) {
        nextTimeline = candidate;
        break;
      }
    }

    const timelineCutoff = Number(nextTimeline) > 0 ? now - Number(nextTimeline) * 24 * 60 * 60 * 1000 : null;
    const timelineMatches = timelineCutoff
      ? matches.filter((m) => toEpochMs(m.gameDatetime) >= timelineCutoff)
      : matches;

    const setValues = [...new Set(timelineMatches.map((m) => m.setNumber).filter((x) => x !== null))].sort((a, b) => b - a);
    const nextSet = setValues.length ? String(setValues[0]) : "all";

    const setScoped = nextSet === "all" ? timelineMatches : timelineMatches.filter((m) => String(m.setNumber) === nextSet);
    const setPatches = [...new Set(setScoped.map((m) => m.patch).filter(Boolean))].sort(comparePatchVersionsDesc);

    let nextPatch = "all";
    if (setPatches.length) {
      nextPatch = currentPatch && setPatches.includes(currentPatch) ? "__current" : setPatches[0];
    }

    setTimelineDays(nextTimeline);
    setSetFilter(nextSet);
    setPatchFilter(nextPatch);
    setDidAutoSelectFilters(true);
  }, [matches, currentPatch, didAutoSelectFilters]);

  const filteredMatches = useMemo(() => {
    const now = Date.now();
    const days = Number(timelineDays);
    const cutoff = Number.isFinite(days) && days > 0 ? now - days * 24 * 60 * 60 * 1000 : null;

    return matches.filter((match) => {
      if (cutoff && toEpochMs(match.gameDatetime) < cutoff) return false;
      if (setFilter !== "all" && String(match.setNumber) !== String(setFilter)) return false;
      if (patchFilter === "__current" && currentPatch) {
        if (match.patch !== currentPatch) return false;
      } else if (patchFilter !== "all" && patchFilter !== "__current") {
        if (match.patch !== patchFilter) return false;
      }
      return true;
    });
  }, [matches, timelineDays, setFilter, patchFilter, currentPatch]);

  const computed = useMemo(() => summarizeFromMatches(filteredMatches), [filteredMatches]);
  const kpis = computed.kpis;
  const hasFilteredMatches = filteredMatches.length > 0;
  const latestMatchForBanner = useMemo(() => {
    return [...matches].sort((a, b) => toEpochMs(b.gameDatetime) - toEpochMs(a.gameDatetime))[0] || null;
  }, [matches]);
  const recentTeamPlacements = useMemo(() => {
    return [...filteredMatches]
      .sort((a, b) => toEpochMs(b.gameDatetime) - toEpochMs(a.gameDatetime))
      .slice(0, 8)
      .map((m) => teamPlacementFromMatch(m));
  }, [filteredMatches]);
  const placementTrend = useMemo(() => {
    return [...filteredMatches]
      .sort((a, b) => toEpochMs(a.gameDatetime) - toEpochMs(b.gameDatetime))
      .map((m) => teamPlacementFromMatch(m));
  }, [filteredMatches]);
  const top2Rate = useMemo(() => {
    if (!placementTrend.length) return 0;
    const top2 = placementTrend.filter((value) => Number(value || 9) <= 2).length;
    return (top2 / placementTrend.length) * 100;
  }, [placementTrend]);
  const winRate = useMemo(() => {
    if (!placementTrend.length) return 0;
    const wins = placementTrend.filter((value) => Number(value || 9) <= 1).length;
    return (wins / placementTrend.length) * 100;
  }, [placementTrend]);
  const avgPlacement = useMemo(() => {
    if (!placementTrend.length) return 0;
    return placementTrend.reduce((sum, value) => sum + Number(value || 0), 0) / placementTrend.length;
  }, [placementTrend]);
  const momentum = useMemo(() => {
    if (!placementTrend.length) return 0;
    const recent = placementTrend.slice(-8);
    const prior = placementTrend.slice(-16, -8);
    if (!recent.length || !prior.length) return 0;
    const recentAvg = recent.reduce((sum, value) => sum + Number(value || 0), 0) / recent.length;
    const priorAvg = prior.reduce((sum, value) => sum + Number(value || 0), 0) / prior.length;
    return priorAvg - recentAvg;
  }, [placementTrend]);

  const coachingInsights = useMemo(() => {
    const summary = {
      a: {
        lowGoldLosses: 0,
        lowDamageLosses: 0,
        itemCounts: {},
      },
      b: {
        lowGoldLosses: 0,
        lowDamageLosses: 0,
        itemCounts: {},
      },
    };

    filteredMatches.forEach((match) => {
      const players = [
        { key: "a", data: match.playerA },
        { key: "b", data: match.playerB },
      ];

      players.forEach(({ key, data }) => {
        if (!data) return;
        const placement = Number(data.placement || 8);
        const goldLeft = Number(data.goldLeft ?? 0);
        const damage = Number(data.totalDamageToPlayers ?? 0);
        if (placement > 4 && goldLeft <= 5) summary[key].lowGoldLosses += 1;
        if (placement > 4 && damage < 40) summary[key].lowDamageLosses += 1;

        asArray(data.units).forEach((unit) => {
          const names = asArray(unit.itemNames || unit.items).filter(Boolean);
          names.forEach((itemName) => {
            summary[key].itemCounts[itemName] = (summary[key].itemCounts[itemName] || 0) + 1;
          });
        });
      });
    });

    const topItemsA = Object.entries(summary.a.itemCounts)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6);
    const topItemsB = Object.entries(summary.b.itemCounts)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6);

    const blame = [];
    if (summary.a.lowGoldLosses > summary.b.lowGoldLosses + 1) {
      blame.push(`${DISPLAY_NAME_A}: frequent low-gold losses. Consider fewer panic roll-downs.`);
    }
    if (summary.b.lowGoldLosses > summary.a.lowGoldLosses + 1) {
      blame.push(`${DISPLAY_NAME_B}: frequent low-gold losses. Preserve econ one stage longer.`);
    }
    if (summary.a.lowDamageLosses > summary.b.lowDamageLosses + 1) {
      blame.push(`${DISPLAY_NAME_A}: low damage in losses. Push stronger carry itemization earlier.`);
    }
    if (summary.b.lowDamageLosses > summary.a.lowDamageLosses + 1) {
      blame.push(`${DISPLAY_NAME_B}: low damage in losses. Shift priority to stable backline carries.`);
    }
    if (!blame.length) {
      blame.push("No clear single-player blame signal; most losses look team-level.");
    }

    return {
      summary,
      topItemsA,
      topItemsB,
      blame,
    };
  }, [filteredMatches]);

  const scorecard = payload?.analysisV2 || null;
  const playbook = payload?.playbook || null;
  const highlights = asArray(payload?.highlights?.highlights);
  const decisionGrade = Number(scorecard?.decisionQuality?.grade || 0);
  const decisionLeaks = asArray(scorecard?.decisionQuality?.biggestLeaks).slice(0, 4);
  const coachingBranches = asArray(scorecard?.coachingReplay?.ifThenExamples).slice(0, 4);
  const giftMetrics = scorecard?.giftEfficiency?.metrics || {};
  const rescueRate = Number(scorecard?.rescueIndex?.rescueRate || 0);
  const clutchIndex = Number(scorecard?.rescueIndex?.clutchIndex || 0);
  const openerCards = asArray(playbook?.topOpeners).slice(0, 3);
  const staggerSuggestions = asArray(scorecard?.econCoordination?.staggerSuggestions).slice(0, 3);
  const coachingIntel = useMemo(
    () =>
      buildCoachingIntel({
        filteredMatches,
        scorecard,
        computed,
        kpis,
      }),
    [filteredMatches, scorecard, computed, kpis]
  );

  const leakCount = Number(scorecard?.decisionQuality?.leakCount || decisionLeaks.length || 0);
  const lowGoldLossA = Number(coachingInsights?.summary?.a?.lowGoldLosses || 0);
  const lowGoldLossB = Number(coachingInsights?.summary?.b?.lowGoldLosses || 0);
  const lowDamageLossA = Number(coachingInsights?.summary?.a?.lowDamageLosses || 0);
  const lowDamageLossB = Number(coachingInsights?.summary?.b?.lowDamageLosses || 0);
  const totalPressureA = lowGoldLossA + lowDamageLossA;
  const totalPressureB = lowGoldLossB + lowDamageLossB;
  const duoRisk = Math.max(0, Math.min(100, Math.round((leakCount * 12) + (totalPressureA + totalPressureB) * 8)));

  const suggestionCards = [
    ...decisionLeaks.map((item, idx) => ({
      id: `leak-${idx}-${item?.leak || "unknown"}`,
      title: item?.leak || "Leak detected",
      why: item?.whyItMatters || "Weak execution pattern detected in current sample.",
      fix: item?.doInstead || "Play lower variance lines and pre-assign roles.",
      icon: "warning-sign",
    })),
    ...coachingInsights.blame.map((item, idx) => ({
      id: `blame-${idx}`,
      title: `Blame Signal ${idx + 1}`,
      why: item,
      fix: "Review the stage where this pattern appears and assign one owner.",
      icon: "issue",
    })),
  ].slice(0, 6);

  useEffect(() => {
    try {
      localStorage.setItem("tftduos-enable-wild-correlations", enableWildCorrelations ? "1" : "0");
    } catch {
      // ignore storage write failures
    }
  }, [enableWildCorrelations]);

  useEffect(() => {
    if (!enableWildCorrelations && activeTab === "wild") {
      setActiveTab("history");
    }
  }, [enableWildCorrelations, activeTab]);

  useEffect(() => {
    if (!filteredMatches.length) {
      setCoachMatchId("");
      return;
    }
    setCoachMatchId((prev) => {
      if (prev && filteredMatches.some((m) => m.id === prev)) return prev;
      return filteredMatches[0].id;
    });
  }, [filteredMatches]);

  useEffect(() => {
    const sets = [...new Set(matches.map((match) => String(match.setNumber || "")).filter(Boolean))];
    if (!sets.length) {
      setIconManifest((current) => {
        if (Object.keys(current.traits || {}).length || Object.keys(current.augments || {}).length) {
          return EMPTY_ICON_MANIFEST;
        }
        return current;
      });
      return;
    }

    let active = true;
    async function loadIconManifest() {
      try {
        const response = await fetch(apiUrl(`/api/tft/icon-manifest?sets=${encodeURIComponent(sets.join(","))}`));
        const data = await response.json();
        if (!response.ok || !active) return;

        const merged = { traits: {}, augments: {} };
        Object.values(data?.sets || {}).forEach((setEntry) => {
          Object.assign(merged.traits, setEntry?.traits || {});
          Object.assign(merged.augments, setEntry?.augments || {});
        });
        setIconManifest(merged);
      } catch {
        if (active) setIconManifest(EMPTY_ICON_MANIFEST);
      }
    }

    loadIconManifest();
    return () => {
      active = false;
    };
  }, [matches]);

  async function runDuoAnalysis(queryString, isAutoRetry = false) {
    setLoading(true);
    if (!isAutoRetry) {
      setError("");
      setRateLimitSeconds(0);
      setRateLimitMessage("");
      setRetryQuery("");
    }

    try {
      const response = await fetch(apiUrl(`/api/tft/duo-history?${queryString}`));
      const data = await response.json();

      if (!response.ok) {
        const retryAfterSeconds = Number(data?.retryAfterSeconds || 0);
        if (response.status === 429 && retryAfterSeconds > 0) {
          setRateLimitSeconds(retryAfterSeconds);
          setRateLimitMessage(data.error || "Riot rate limit hit.");
          setRetryQuery(queryString);
          setError("");
          return;
        }
        throw new Error(data.error || "Failed to load duo analysis.");
      }

      setRetryQuery("");
      setRateLimitSeconds(0);
      setRateLimitMessage("");
      setPayload(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  function buildQueryString() {
    const params = new URLSearchParams({
      gameNameA: HARD_CODED_QUERY.gameNameA,
      tagLineA: HARD_CODED_QUERY.tagLineA,
      gameNameB: HARD_CODED_QUERY.gameNameB,
      tagLineB: HARD_CODED_QUERY.tagLineB,
      region: HARD_CODED_QUERY.region,
      platform: HARD_CODED_QUERY.platform,
      count: "40",
      maxHistory: "200",
      deltaHours: "24",
    });
    return params.toString();
  }

  async function loadDuoAnalysis() {
    await runDuoAnalysis(buildQueryString());
  }

  useEffect(() => {
    if (hasAutoLoadedRef.current) return;
    hasAutoLoadedRef.current = true;
    loadDuoAnalysis();
  }, []);

  useEffect(() => {
    if (rateLimitSeconds <= 0) return undefined;
    const timer = setTimeout(() => setRateLimitSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [rateLimitSeconds]);

  useEffect(() => {
    if (!retryQuery || rateLimitSeconds > 0 || loading) return;
    runDuoAnalysis(retryQuery, true);
  }, [retryQuery, rateLimitSeconds, loading]);

  async function loadAiCoaching(force = false) {
    if (!payload || !filteredMatches.length) return;
    const compactMatches = [...filteredMatches]
      .sort((left, right) => toEpochMs(right?.gameDatetime) - toEpochMs(left?.gameDatetime))
      .slice(0, 32)
      .map(compactMatchForAi);

    const requestBody = {
      filter: {
        timelineDays: Number(timelineDays || 30),
        set: setFilter,
        patch: patchFilter === "__current" && currentPatch ? currentPatch : patchFilter,
      },
      players: {
        a: DISPLAY_NAME_A,
        b: DISPLAY_NAME_B,
        rankA: String(payload?.players?.a?.rank || "Unranked"),
        rankB: String(payload?.players?.b?.rank || "Unranked"),
      },
      objective: "Climb rank in TFT Double Up as a duo.",
      metrics: {
        duoRisk,
        decisionGrade,
        top2Rate,
        winRate,
        avgPlacement,
        momentum,
        rescueRate,
        clutchIndex,
        eventSample: Number(scorecard?.sampleSize?.eventCount || 0),
      },
      scorecard,
      coachingIntel,
      metaSnapshot: {
        lobbyTraits: asArray(computed?.metaTraits).slice(0, 8),
        lobbyUnits: asArray(computed?.metaUnits).slice(0, 10),
        playerAItems: asArray(coachingInsights?.topItemsA).slice(0, 8),
        playerBItems: asArray(coachingInsights?.topItemsB).slice(0, 8),
        suggestions: asArray(computed?.suggestions).slice(0, 4),
      },
      matches: compactMatches,
    };
    const requestKey = JSON.stringify({
      filter: requestBody.filter,
      metrics: requestBody.metrics,
      matches: requestBody.matches.map((m) => m.id),
    });
    if (!force && aiRequestKeyRef.current === requestKey) return;
    aiRequestKeyRef.current = requestKey;

    setAiCoachingLoading(true);
    setAiCoachingError("");
    try {
      const response = await fetch(apiUrl("/api/coach/llm-brief"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to generate AI coaching.");
      }
      setAiCoaching(data);
    } catch (requestError) {
      const fallbackMessage = "AI coach network request failed. Try Refresh AI or a smaller timeline window.";
      setAiCoachingError(String(requestError?.message || fallbackMessage));
    } finally {
      setAiCoachingLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab !== "coaching") return;
    if (!payload || !filteredMatches.length) return;
    const timer = setTimeout(() => {
      loadAiCoaching(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [
    activeTab,
    payload,
    filteredMatches,
    timelineDays,
    setFilter,
    patchFilter,
    currentPatch,
    duoRisk,
    decisionGrade,
    top2Rate,
    winRate,
    avgPlacement,
    momentum,
    rescueRate,
    clutchIndex,
    scorecard,
    coachingIntel,
  ]);

  async function submitJournal() {
    if (!duoId) return;
    setCoachSaving(true);
    setCoachMessage("");
    try {
      const tags = [];
      if (tagPanicRoll) tags.push("panic_roll");
      if (tagMissedGift) tags.push("missed_gift");
      if (tagBothRoll) tags.push("both_roll_same_stage");

      const response = await fetch(apiUrl("/api/duo/journal"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duoId,
          matchId: coachMatchId || null,
          planAt32,
          executed: executedPlan,
          tags,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save journal.");

      setCoachMessage("Journal saved.");
      await runDuoAnalysis(buildQueryString(), true);
    } catch (submitError) {
      setCoachMessage(submitError.message);
    } finally {
      setCoachSaving(false);
    }
  }

  async function submitQuickEvent(type) {
    if (!duoId) return;
    setCoachSaving(true);
    setCoachMessage("");
    try {
      const payloadByType = {
        gift_sent: { giftType: "item", partnerState: "bleeding", outcome: "became_carry" },
        rescue_arrival: { teammateAtRisk: true, roundOutcomeBefore: "loss_likely", roundOutcomeAfter: "won" },
        roll_down: { goldBefore: 52, goldAfter: 18, reason: "stabilize" },
      };

      const [stageMajorRaw, stageMinorRaw] = quickStage.split(".");
      const stageMajor = Number(stageMajorRaw);
      const stageMinor = Number(stageMinorRaw);

      const response = await fetch(apiUrl("/api/duo/events/batch"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duoId,
          matchId: coachMatchId || null,
          events: [
            {
              type,
              stageMajor: Number.isFinite(stageMajor) ? stageMajor : 3,
              stageMinor: Number.isFinite(stageMinor) ? stageMinor : 2,
              actorSlot: quickActor,
              payload: payloadByType[type] || {},
            },
          ],
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save event.");

      setCoachMessage(`Logged ${type}.`);
      await runDuoAnalysis(buildQueryString(), true);
    } catch (submitError) {
      setCoachMessage(submitError.message);
    } finally {
      setCoachSaving(false);
    }
  }

  const displayedError =
    rateLimitSeconds > 0
      ? `${rateLimitMessage || "Riot rate limit hit."} Auto retry in ${rateLimitSeconds}s.`
      : error;

  return {
    activeTab,
    setActiveTab,
    payload,
    timelineDays,
    setTimelineDays,
    setFilter,
    setSetFilter,
    patchFilter,
    setPatchFilter,
    currentPatch,
    availableSets,
    availablePatches,
    matches,
    filteredMatches,
    loading,
    loadDuoAnalysis,
    displayedError,
    latestMatchForBanner,
    kpis,
    recentTeamPlacements,
    hasFilteredMatches,
    iconManifest,
    companionManifest,
    computed,
    duoRisk,
    decisionGrade,
    leakCount,
    rescueRate,
    clutchIndex,
    placementTrend,
    coachingIntel,
    enableWildCorrelations,
    setEnableWildCorrelations,
    totalPressureA,
    totalPressureB,
    lowGoldLossA,
    lowGoldLossB,
    lowDamageLossA,
    lowDamageLossB,
    suggestionCards,
    scorecard,
    coachingBranches,
    giftMetrics,
    staggerSuggestions,
    openerCards,
    coachingInsights,
    highlights,
    coachMatchId,
    setCoachMatchId,
    planAt32,
    setPlanAt32,
    executedPlan,
    setExecutedPlan,
    tagPanicRoll,
    setTagPanicRoll,
    tagMissedGift,
    setTagMissedGift,
    tagBothRoll,
    setTagBothRoll,
    submitJournal,
    duoId,
    coachSaving,
    quickStage,
    setQuickStage,
    quickActor,
    setQuickActor,
    submitQuickEvent,
    coachMessage,
    aiCoaching,
    aiCoachingLoading,
    aiCoachingError,
    loadAiCoaching,
  };
}
