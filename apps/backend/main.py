
from __future__ import annotations

import json
import os
import random
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlencode

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Query, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from duo_analytics import build_duo_highlights, build_duo_scorecard, build_personalized_playbook

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR.parent / "tftduos" / ".env")

RIOT_API_KEY = os.getenv("RIOT_API_KEY", "").strip()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"
OPENAI_TIMEOUT_MS = max(3000, int(os.getenv("OPENAI_TIMEOUT_MS", "15000")))
RENDER_API_KEY = os.getenv("RENDER_API_KEY", "").strip()
RENDER_API_BASE_URL = os.getenv("RENDER_API_BASE_URL", "https://api.render.com/v1").strip().rstrip("/")
ALLOWED_ORIGINS = [token.strip() for token in os.getenv("ALLOWED_ORIGINS", "").split(",") if token.strip()]
RATE_LIMIT_WINDOW_MS = max(1000, int(os.getenv("RATE_LIMIT_WINDOW_MS", "60000")))
RATE_LIMIT_MAX_REQUESTS = max(1, int(os.getenv("RATE_LIMIT_MAX_REQUESTS", "90")))
DEBUG_TFT_PAYLOAD = os.getenv("DEBUG_TFT_PAYLOAD", "0") == "1"

CACHE_TTL = {"account": 300, "match_ids": 120, "match": 86400, "summoner": 300, "rank": 60}
QUEUE_LABELS = {1090: "Ranked", 1100: "Normal", 1110: "Hyper Roll", 1130: "Double Up", 1160: "Ranked", 6110: "Revival"}

PERSISTED_CACHE_PATH = Path.cwd() / ".cache" / "duo-history-cache.json"
ANALYTICS_STORE_PATH = Path.cwd() / ".cache" / "duo-analytics-store.json"

http_client = httpx.AsyncClient(timeout=httpx.Timeout(25.0, connect=10.0))
riot_cache: dict[str, tuple[float, Any]] = {}
request_buckets: dict[str, dict[str, int]] = {}
persisted_cache: dict[str, Any] = {"version": 1, "players": {}}
analytics_store: dict[str, Any] = {"version": 1, "duos": {}}
manifest_cache: dict[str, Any] = {"loadedAt": 0, "bySet": {}}
companion_manifest_cache: dict[str, Any] = {"loadedAt": 0, "byItemId": {}, "byContentId": {}}


def as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def patch_from_game_version(version: Any) -> str | None:
    parts = str(version or "").split(".")
    if len(parts) < 2 or not parts[0].isdigit() or not parts[1].isdigit():
        return None
    return f"{parts[0]}.{parts[1]}"


def queue_label(queue_id: Any) -> str:
    try:
        parsed = int(queue_id)
    except Exception:
        parsed = 0
    return QUEUE_LABELS.get(parsed, f"Queue {queue_id or '?'}")


def stable_duo_id(puuid_a: str, puuid_b: str) -> str:
    return "::".join(sorted([str(puuid_a or ""), str(puuid_b or "")]))


def summarize_traits(traits: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    out = [
        {"name": row.get("name"), "numUnits": row.get("num_units"), "style": row.get("style"), "tierCurrent": row.get("tier_current")}
        for row in as_list(traits)
    ]
    out.sort(key=lambda row: (-(int(row.get("style") or 0)), -(int(row.get("numUnits") or 0))))
    return out


def summarize_units(units: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    return [
        {
            "characterId": row.get("character_id"),
            "name": row.get("name"),
            "tier": row.get("tier"),
            "rarity": row.get("rarity"),
            "itemNames": as_list(row.get("itemNames")),
            "items": as_list(row.get("itemNames")),
        }
        for row in as_list(units)
    ]


def summarize_participant(participant: dict[str, Any]) -> dict[str, Any]:
    companion = participant.get("companion") or {}
    return {
        "puuid": participant.get("puuid"),
        "riotIdGameName": participant.get("riotIdGameName"),
        "riotIdTagline": participant.get("riotIdTagline"),
        "placement": participant.get("placement"),
        "win": participant.get("win"),
        "level": participant.get("level"),
        "lastRound": participant.get("last_round"),
        "goldLeft": participant.get("gold_left"),
        "playersEliminated": participant.get("players_eliminated"),
        "totalDamageToPlayers": participant.get("total_damage_to_players"),
        "timeEliminated": participant.get("time_eliminated"),
        "partnerGroupId": participant.get("partner_group_id"),
        "hasAugmentsField": "augments" in participant,
        "augments": participant.get("augments") or [],
        "companion": {
            "contentId": companion.get("content_ID"),
            "itemId": companion.get("item_ID"),
            "skinId": companion.get("skin_ID"),
            "species": companion.get("species"),
            "raw": companion,
        },
        "arena": {"arenaId": participant.get("arena_id"), "skinId": participant.get("arena_skin_id"), "available": participant.get("arena_id") is not None},
        "traits": summarize_traits(participant.get("traits")),
        "units": summarize_units(participant.get("units")),
    }

class CorsAndRateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin", "")
        is_allowed = (not origin) or (not ALLOWED_ORIGINS) or (origin in ALLOWED_ORIGINS)

        if request.method == "OPTIONS":
            if not is_allowed:
                return JSONResponse({"error": "Origin not allowed."}, status_code=403)
            response = JSONResponse({}, status_code=204)
            if origin:
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Vary"] = "Origin"
            response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            return response

        if request.url.path.startswith("/api"):
            now_ms = int(time.time() * 1000)
            ip = (request.headers.get("x-forwarded-for") or request.client.host or "unknown").split(",")[0].strip()
            bucket = request_buckets.get(ip)
            if bucket is None or now_ms - int(bucket["windowStart"]) > RATE_LIMIT_WINDOW_MS:
                request_buckets[ip] = {"windowStart": now_ms, "count": 1}
            else:
                if int(bucket["count"]) >= RATE_LIMIT_MAX_REQUESTS:
                    retry_after = max(1, (RATE_LIMIT_WINDOW_MS - (now_ms - int(bucket["windowStart"]))) // 1000)
                    response = JSONResponse({"error": "Too many requests. Please try again shortly.", "retryAfterSeconds": retry_after}, status_code=429)
                    response.headers["Retry-After"] = str(retry_after)
                    return response
                bucket["count"] = int(bucket["count"]) + 1

        if not is_allowed:
            return JSONResponse({"error": "Origin not allowed."}, status_code=403)

        response = await call_next(request)
        if origin and is_allowed:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Vary"] = "Origin"
        if is_allowed:
            response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return response


app = FastAPI()
app.add_middleware(CorsAndRateLimitMiddleware)


async def ensure_stores_loaded() -> None:
    global persisted_cache, analytics_store
    try:
        persisted_cache = json.loads(PERSISTED_CACHE_PATH.read_text(encoding="utf-8"))
    except Exception:
        persisted_cache = {"version": 1, "players": {}}
    try:
        analytics_store = json.loads(ANALYTICS_STORE_PATH.read_text(encoding="utf-8"))
    except Exception:
        analytics_store = {"version": 1, "duos": {}}


async def save_stores() -> None:
    PERSISTED_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    ANALYTICS_STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    PERSISTED_CACHE_PATH.write_text(json.dumps(persisted_cache), encoding="utf-8")
    ANALYTICS_STORE_PATH.write_text(json.dumps(analytics_store), encoding="utf-8")


async def riot_request(url: str) -> Any:
    if not RIOT_API_KEY:
        raise RuntimeError("RIOT_API_KEY is missing on the server. Add it to your .env file.")
    response = await http_client.get(url, headers={"X-Riot-Token": RIOT_API_KEY})
    if response.status_code >= 400:
        error = RuntimeError(f"Riot API request failed ({response.status_code}).")
        setattr(error, "status", response.status_code)
        setattr(error, "body", response.text)
        setattr(error, "retry_after", response.headers.get("Retry-After"))
        raise error
    return response.json()


async def riot_request_cached(url: str, ttl_seconds: int) -> Any:
    now = time.time()
    hit = riot_cache.get(url)
    if hit and now < hit[0]:
        return hit[1]
    data = await riot_request(url)
    riot_cache[url] = (now + ttl_seconds, data)
    return data


def riot_platform_url(platform_region: str, pathname: str) -> str:
    return f"https://{platform_region}.api.riotgames.com{pathname}"


def riot_routing_url(routing_region: str, pathname: str) -> str:
    return f"https://{routing_region}.api.riotgames.com{pathname}"


async def fetch_player_data(game_name: str, tag_line: str, routing_region: str, platform_region: str, max_history: int) -> dict[str, Any]:
    account = await riot_request_cached(
        riot_routing_url(routing_region, f"/riot/account/v1/accounts/by-riot-id/{quote(game_name)}/{quote(tag_line)}"),
        CACHE_TTL["account"],
    )
    puuid = str(account.get("puuid") or "")

    match_ids: list[str] = []
    start = 0
    while len(match_ids) < max_history and start < 1000:
        count = min(100, max_history - len(match_ids))
        params = urlencode({"start": start, "count": count})
        ids = as_list(await riot_request_cached(riot_routing_url(routing_region, f"/tft/match/v1/matches/by-puuid/{puuid}/ids?{params}"), CACHE_TTL["match_ids"]))
        if not ids:
            break
        match_ids.extend(str(match_id) for match_id in ids)
        if len(ids) < count:
            break
        start += count

    rank = "Unranked"
    try:
        summoner = await riot_request_cached(riot_platform_url(platform_region, f"/tft/summoner/v1/summoners/by-puuid/{puuid}"), CACHE_TTL["summoner"])
        entries = as_list(await riot_request_cached(riot_platform_url(platform_region, f"/tft/league/v1/entries/by-summoner/{summoner.get('id')}"), CACHE_TTL["rank"]))
        chosen = next((entry for entry in entries if entry.get("queueType") == "RANKED_TFT"), entries[0] if entries else None)
        if chosen:
            rank = f"{chosen.get('tier', 'Unranked')} {chosen.get('rank', '')} ({chosen.get('leaguePoints', 0)} LP)"
    except Exception:
        rank = "Unranked"

    return {"account": account, "matchIds": match_ids[:max_history], "rank": rank}

async def ensure_tft_icon_manifest_loaded() -> None:
    ttl_seconds = 6 * 60 * 60
    if time.time() - manifest_cache.get("loadedAt", 0) < ttl_seconds and manifest_cache.get("bySet"):
        return
    response = await http_client.get("https://raw.communitydragon.org/latest/cdragon/tft/en_us.json")
    response.raise_for_status()
    data = response.json()
    by_set: dict[str, Any] = {}
    for set_entry in as_list(data.get("setData")):
        set_number = str(set_entry.get("number") or "").strip()
        if not set_number:
            continue
        traits: dict[str, str] = {}
        for trait in as_list(set_entry.get("traits")):
            api_name = str(trait.get("apiName") or "")
            icon = str(trait.get("icon") or "").lower().replace(".tex", ".png")
            if not api_name or not icon:
                continue
            url = f"https://raw.communitydragon.org/latest/game/{icon}"
            traits["".join(ch for ch in api_name if ch.isalnum() or ch == "_").lower()] = url
        by_set[set_number] = {"traits": traits, "augments": {}}
    manifest_cache["loadedAt"] = time.time()
    manifest_cache["bySet"] = by_set


async def ensure_companion_manifest_loaded() -> None:
    ttl_seconds = 6 * 60 * 60
    if time.time() - companion_manifest_cache.get("loadedAt", 0) < ttl_seconds and companion_manifest_cache.get("byItemId"):
        return
    response = await http_client.get("https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/companions.json")
    response.raise_for_status()
    by_item_id: dict[str, Any] = {}
    by_content_id: dict[str, Any] = {}
    for entry in as_list(response.json()):
        item_id = str(entry.get("itemId") or "").strip()
        content_id = str(entry.get("contentId") or "").strip().lower()
        icon = str(entry.get("loadoutsIcon") or "")
        if not icon:
            continue
        icon_url = f"https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default{icon.replace('/lol-game-data/assets','').replace('/lol-game-data','')}".lower()
        summary = {"iconUrl": icon_url, "name": entry.get("name"), "speciesName": entry.get("speciesName"), "rarity": entry.get("rarity")}
        if item_id:
            by_item_id[item_id] = summary
        if content_id:
            by_content_id[content_id] = summary
    companion_manifest_cache["loadedAt"] = time.time()
    companion_manifest_cache["byItemId"] = by_item_id
    companion_manifest_cache["byContentId"] = by_content_id


@app.on_event("shutdown")
async def shutdown_event() -> None:
    await http_client.aclose()


@app.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True}


@app.get("/api/tft/icon-manifest")
async def tft_icon_manifest(set_: str = Query("", alias="set"), sets: str = ""):
    try:
        await ensure_tft_icon_manifest_loaded()
        requested: set[str] = set()
        if set_.strip():
            requested.add(set_.strip())
        if sets.strip():
            for token in [part.strip() for part in sets.split(",") if part.strip()]:
                requested.add(token)
        response_sets = dict(manifest_cache.get("bySet") or {}) if not requested else {key: value for key, value in (manifest_cache.get("bySet") or {}).items() if key in requested}
        return {"loadedAt": manifest_cache.get("loadedAt"), "sets": response_sets}
    except Exception as error:
        return JSONResponse({"error": str(error) or "Failed to load TFT icon manifest."}, status_code=500)


@app.get("/api/tft/companion-manifest")
async def tft_companion_manifest(itemIds: str = "", contentIds: str = ""):
    try:
        await ensure_companion_manifest_loaded()
        item_ids = [token.strip() for token in itemIds.split(",") if token.strip()]
        content_ids = [token.strip().lower() for token in contentIds.split(",") if token.strip()]
        by_item_id = {k: v for k, v in (companion_manifest_cache.get("byItemId") or {}).items() if k in item_ids}
        by_content_id = {k: v for k, v in (companion_manifest_cache.get("byContentId") or {}).items() if k in content_ids}
        return {"loadedAt": companion_manifest_cache.get("loadedAt"), "byItemId": by_item_id, "byContentId": by_content_id}
    except Exception as error:
        return JSONResponse({"error": str(error) or "Failed to load companion manifest."}, status_code=500)


@app.get("/api/site-performance/render/overview")
async def site_performance_overview(hours: int = 24, resolutionSeconds: int = 300):
    try:
        if not RENDER_API_KEY:
            raise RuntimeError("RENDER_API_KEY is missing on the backend service.")
        end_time = datetime.now(timezone.utc)
        start_time = end_time.timestamp() - max(1, min(168, int(hours))) * 3600
        window = {
            "hours": max(1, min(168, int(hours))),
            "resolutionSeconds": max(30, min(3600, int(resolutionSeconds))),
            "startTime": datetime.fromtimestamp(start_time, timezone.utc).isoformat(),
            "endTime": end_time.isoformat(),
        }
        response = await http_client.get(
            f"{RENDER_API_BASE_URL}/services",
            params={"limit": 100, "includePreviews": "false"},
            headers={"Authorization": f"Bearer {RENDER_API_KEY}", "Accept": "application/json"},
        )
        response.raise_for_status()
        services = []
        for row in as_list(response.json()):
            service = row.get("service") if isinstance(row, dict) else row
            if not isinstance(service, dict) or not service.get("id"):
                continue
            services.append({"id": service.get("id"), "name": service.get("name") or service.get("id"), "type": service.get("type") or "unknown"})
        return {
            "ok": True,
            "generatedAt": int(time.time() * 1000),
            "window": window,
            "services": services,
            "summary": {"serviceCount": len(services), "totalHttpRequests": 0, "totalBandwidthBytes": 0, "avgCpuPercent": None, "avgMemoryGb": None, "peakMemoryGb": None},
            "metrics": {},
            "warnings": ["Python migration: detailed Render metric rollups not yet ported."],
        }
    except Exception as error:
        return JSONResponse({"ok": False, "error": str(error), "details": None}, status_code=500)

@app.get("/api/tft/duo-history")
async def duo_history(
    gameNameA: str = "",
    tagLineA: str = "",
    gameNameB: str = "",
    tagLineB: str = "",
    region: str = "americas",
    platform: str = "na1",
    count: int = 40,
    maxHistory: int = 200,
    deltaHours: int = 24,
):
    try:
        if region.strip().lower() not in {"americas", "europe", "asia"}:
            return JSONResponse({"error": "region must be one of: americas, europe, asia"}, status_code=400)
        await ensure_stores_loaded()
        player_a = await fetch_player_data(gameNameA.strip(), tagLineA.strip(), region.strip().lower(), platform.strip().lower(), max(50, min(1000, int(maxHistory))))
        player_b = await fetch_player_data(gameNameB.strip(), tagLineB.strip(), region.strip().lower(), platform.strip().lower(), max(50, min(1000, int(maxHistory))))

        ids_b = set(player_b["matchIds"])
        shared_ids = [match_id for match_id in player_a["matchIds"] if match_id in ids_b][: max(1, min(200, int(count)))]

        matches: list[dict[str, Any]] = []
        for match_id in shared_ids:
            match = await riot_request_cached(riot_routing_url(region.strip().lower(), f"/tft/match/v1/matches/{match_id}"), CACHE_TTL["match"])
            participants = as_list(((match or {}).get("info") or {}).get("participants"))
            participant_a = next((entry for entry in participants if entry.get("puuid") == (player_a["account"] or {}).get("puuid")), None)
            participant_b = next((entry for entry in participants if entry.get("puuid") == (player_b["account"] or {}).get("puuid")), None)
            if not participant_a or not participant_b:
                continue
            summary_a = summarize_participant(participant_a)
            summary_b = summarize_participant(participant_b)
            same_team = bool(summary_a.get("partnerGroupId") and summary_b.get("partnerGroupId") and summary_a.get("partnerGroupId") == summary_b.get("partnerGroupId"))
            lobby = [summarize_participant(entry) for entry in participants]
            lobby.sort(key=lambda row: int(row.get("placement") or 99))
            matches.append(
                {
                    "id": match_id,
                    "queueId": ((match or {}).get("info") or {}).get("queue_id"),
                    "queueLabel": queue_label(((match or {}).get("info") or {}).get("queue_id")),
                    "gameDatetime": ((match or {}).get("info") or {}).get("game_datetime"),
                    "gameLength": ((match or {}).get("info") or {}).get("game_length"),
                    "setNumber": ((match or {}).get("info") or {}).get("tft_set_number"),
                    "gameVersion": ((match or {}).get("info") or {}).get("game_version"),
                    "patch": patch_from_game_version(((match or {}).get("info") or {}).get("game_version")),
                    "playerA": summary_a,
                    "playerB": summary_b,
                    "sameTeam": same_team,
                    "lobby": lobby,
                }
            )

        duo_id = stable_duo_id(str((player_a.get("account") or {}).get("puuid") or ""), str((player_b.get("account") or {}).get("puuid") or ""))
        record = analytics_store.setdefault("duos", {}).setdefault(duo_id, {"duoId": duo_id, "matchesById": {}, "events": [], "journals": []})
        for match in matches:
            record.setdefault("matchesById", {})[str(match.get("id"))] = match
        if len(record.get("matchesById", {})) > 600:
            keep = sorted(record["matchesById"].keys(), key=lambda mid: int((record["matchesById"].get(mid) or {}).get("gameDatetime") or 0), reverse=True)[:600]
            record["matchesById"] = {mid: record["matchesById"][mid] for mid in keep}
        await save_stores()

        events = as_list(record.get("events"))
        analysis_v2 = build_duo_scorecard(matches, events)
        playbook = build_personalized_playbook(matches, events)
        highlights = build_duo_highlights(matches, events)
        latest = matches[0] if matches else None

        payload = {
            "players": {
                "a": {"gameName": (player_a.get("account") or {}).get("gameName"), "tagLine": (player_a.get("account") or {}).get("tagLine"), "puuid": (player_a.get("account") or {}).get("puuid"), "rank": player_a.get("rank"), "tactician": ((latest or {}).get("playerA") or {}).get("companion"), "arena": ((latest or {}).get("playerA") or {}).get("arena")},
                "b": {"gameName": (player_b.get("account") or {}).get("gameName"), "tagLine": (player_b.get("account") or {}).get("tagLine"), "puuid": (player_b.get("account") or {}).get("puuid"), "rank": player_b.get("rank"), "tactician": ((latest or {}).get("playerB") or {}).get("companion"), "arena": ((latest or {}).get("playerB") or {}).get("arena")},
            },
            "region": region.strip().lower(),
            "platform": platform.strip().lower(),
            "duoId": duo_id,
            "count": len(matches),
            "maxHistoryScanned": max(50, min(1000, int(maxHistory))),
            "deltaHours": max(1, min(168, int(deltaHours))),
            "matches": matches,
            "analysis": {"kpis": {"gamesTogether": len(matches), "sameTeamGames": len([m for m in matches if m.get("sameTeam")])}},
            "rankContext": {"region": region.strip().lower(), "platform": platform.strip().lower(), "snapshotAt": datetime.now(timezone.utc).isoformat(), "queuePopulation": None, "ladderMeta": {"topTraits": [], "topChampions": [], "sampledTopPlayers": 0}},
            "analysisV2": analysis_v2,
            "playbook": playbook,
            "highlights": highlights,
        }
        if DEBUG_TFT_PAYLOAD:
            payload["debug"] = {"sharedMatchCount": len(shared_ids)}
        return payload
    except Exception as error:
        status = int(getattr(error, "status", 500))
        retry_after = int(getattr(error, "retry_after", "0") or "0")
        return JSONResponse({"error": str(error) or "Unexpected server error.", "details": getattr(error, "body", None), "retryAfterSeconds": retry_after or None}, status_code=status)


@app.post("/api/duo/events/batch")
async def duo_events_batch(request: Request):
    body = await request.json()
    await ensure_stores_loaded()
    duo_id = str((body or {}).get("duoId") or "").strip()
    if not duo_id:
        return JSONResponse({"error": "duoId is required."}, status_code=400)
    if duo_id not in analytics_store.get("duos", {}):
        return JSONResponse({"error": "Unknown duoId. Analyze duo history first to initialize duo record."}, status_code=404)
    events = as_list((body or {}).get("events"))
    if not events:
        return JSONResponse({"error": "events array is required."}, status_code=400)
    record = analytics_store["duos"][duo_id]
    normalized = []
    for event in events:
        etype = str((event or {}).get("type") or "").strip()
        if not etype:
            continue
        normalized.append({"id": f"{int(time.time() * 1000)}-{random.randint(100000, 999999)}", "type": etype, "matchId": (event or {}).get("matchId") or (body or {}).get("matchId"), "payload": (event or {}).get("payload") if isinstance((event or {}).get("payload"), dict) else {}, "createdAt": int(time.time() * 1000)})
    if not normalized:
        return JSONResponse({"error": "No valid events to insert."}, status_code=400)
    record.setdefault("events", []).extend(normalized)
    record["events"] = record["events"][-6000:]
    await save_stores()
    return {"ok": True, "inserted": len(normalized), "totalEvents": len(record["events"])}


@app.get("/api/duo/scorecard")
async def duo_scorecard(duoId: str = "", windowDays: int = 30):
    await ensure_stores_loaded()
    duo_id = duoId.strip()
    if not duo_id:
        return JSONResponse({"error": "duoId is required."}, status_code=400)
    record = (analytics_store.get("duos") or {}).get(duo_id)
    if not record:
        return JSONResponse({"error": "duoId not found."}, status_code=404)
    cutoff = int(time.time() * 1000) - max(1, min(365, int(windowDays))) * 24 * 60 * 60 * 1000
    matches = [m for m in (record.get("matchesById") or {}).values() if int((m or {}).get("gameDatetime") or 0) >= cutoff]
    events = as_list(record.get("events"))
    return {"duoId": duo_id, "windowDays": windowDays, "matchCount": len(matches), "eventCount": len(events), "scorecard": build_duo_scorecard(matches, events), "playbook": build_personalized_playbook(matches, events), "highlights": build_duo_highlights(matches, events)}


@app.post("/api/coach/llm-brief")
async def coach_llm_brief(request: Request):
    payload = await request.json()
    payload = payload if isinstance(payload, dict) else {}
    deterministic_findings = {
        "sampleSize": len(as_list(payload.get("matches"))),
        "topImprovementAreas": ["Prioritize one stable board + one econ board each game."],
        "winConditions": ["Convert early board strength into faster level spikes and staggered roll timing."],
        "fiveGamePlan": ["Track one event tag every game to improve signal quality."],
        "championBuilds": [],
        "confidenceBand": "low",
    }
    if not OPENAI_API_KEY:
        return {"ok": True, "fallback": True, "reason": "OPENAI_API_KEY missing", "model": OPENAI_MODEL, "webSearchUsed": False, "generatedAt": int(time.time() * 1000), "deterministicFindings": deterministic_findings, "brief": fallback_ai_coaching(payload)}

    body = {
        "model": OPENAI_MODEL,
        "input": [
            {"role": "system", "content": [{"type": "input_text", "text": "Return strict JSON coaching output for TFT Double Up."}]},
            {"role": "user", "content": [{"type": "input_text", "text": json.dumps(payload)}]},
        ],
        "text": {"format": {"type": "json_object"}},
    }
    try:
        response = await http_client.post("https://api.openai.com/v1/responses", headers={"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"}, content=json.dumps(body), timeout=OPENAI_TIMEOUT_MS / 1000.0)
        response.raise_for_status()
        parsed = response.json()
        output_text = str(parsed.get("output_text") or "{}").strip() or "{}"
        brief = json.loads(output_text)
        if not isinstance(brief, dict):
            brief = fallback_ai_coaching(payload)
        return {"ok": True, "fallback": False, "reason": None, "model": OPENAI_MODEL, "webSearchUsed": False, "generatedAt": int(time.time() * 1000), "deterministicFindings": deterministic_findings, "brief": brief}
    except Exception as error:
        return {"ok": True, "fallback": True, "reason": str(error), "model": OPENAI_MODEL, "webSearchUsed": False, "generatedAt": int(time.time() * 1000), "deterministicFindings": deterministic_findings, "brief": fallback_ai_coaching(payload)}


@app.exception_handler(404)
async def not_found(_request: Request, _exc: Exception):
    return JSONResponse({"error": "Not found."}, status_code=404)


@app.post("/api/duo/journal")
async def duo_journal(request: Request):
    body = await request.json()
    await ensure_stores_loaded()
    duo_id = str((body or {}).get("duoId") or "").strip()
    if not duo_id:
        return JSONResponse({"error": "duoId is required."}, status_code=400)
    if duo_id not in analytics_store.get("duos", {}):
        return JSONResponse({"error": "Unknown duoId. Analyze duo history first to initialize duo record."}, status_code=404)
    record = analytics_store["duos"][duo_id]
    journal = {
        "id": f"{int(time.time() * 1000)}-{random.randint(100000, 999999)}",
        "matchId": str((body or {}).get("matchId") or "").strip() or None,
        "planAt32": str((body or {}).get("planAt32") or "").strip() or None,
        "executed": bool((body or {}).get("executed")),
        "tags": [str(tag).strip() for tag in as_list((body or {}).get("tags")) if str(tag).strip()][:8],
        "createdAt": int(time.time() * 1000),
    }
    record.setdefault("journals", []).append(journal)
    record["journals"] = record["journals"][-1000:]
    await save_stores()
    return {"ok": True, "journalId": journal["id"], "totalJournals": len(record["journals"])}


@app.get("/api/duo/playbook")
async def duo_playbook(duoId: str = "", windowDays: int = 30):
    await ensure_stores_loaded()
    duo_id = duoId.strip()
    if not duo_id:
        return JSONResponse({"error": "duoId is required."}, status_code=400)
    record = (analytics_store.get("duos") or {}).get(duo_id)
    if not record:
        return JSONResponse({"error": "duoId not found."}, status_code=404)
    cutoff = int(time.time() * 1000) - max(1, min(365, int(windowDays))) * 24 * 60 * 60 * 1000
    matches = [m for m in (record.get("matchesById") or {}).values() if int((m or {}).get("gameDatetime") or 0) >= cutoff]
    events = as_list(record.get("events"))
    playbook = build_personalized_playbook(matches, events)
    record["playbookSnapshot"] = playbook
    await save_stores()
    return {"duoId": duo_id, "windowDays": windowDays, "playbook": playbook}


@app.get("/api/duo/highlights")
async def duo_highlights(duoId: str = "", windowDays: int = 30):
    await ensure_stores_loaded()
    duo_id = duoId.strip()
    if not duo_id:
        return JSONResponse({"error": "duoId is required."}, status_code=400)
    record = (analytics_store.get("duos") or {}).get(duo_id)
    if not record:
        return JSONResponse({"error": "duoId not found."}, status_code=404)
    cutoff = int(time.time() * 1000) - max(1, min(365, int(windowDays))) * 24 * 60 * 60 * 1000
    matches = [m for m in (record.get("matchesById") or {}).values() if int((m or {}).get("gameDatetime") or 0) >= cutoff]
    events = as_list(record.get("events"))
    return {"duoId": duo_id, "windowDays": windowDays, "highlights": build_duo_highlights(matches, events)}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "3001")), reload=False)
