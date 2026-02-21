export const VIEW_TABS = [
  { id: "history", label: "History" },
  { id: "analysis", label: "Analysis" },
  { id: "coaching", label: "Coaching" },
];

export const TEXT_SCALE = 1.45;

function envValue(key, fallback) {
  const value = import.meta.env?.[key];
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

export const HARD_CODED_QUERY = {
  gameNameA: envValue("VITE_RIOT_GAME_NAME_A", "sebbenandsebben"),
  tagLineA: envValue("VITE_RIOT_TAG_LINE_A", "na1"),
  gameNameB: envValue("VITE_RIOT_GAME_NAME_B", "answer"),
  tagLineB: envValue("VITE_RIOT_TAG_LINE_B", "firm"),
  region: envValue("VITE_RIOT_ROUTING_REGION", "americas"),
  platform: envValue("VITE_RIOT_PLATFORM_REGION", "na1"),
};

export function toDisplayName(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export const DISPLAY_NAME_A = toDisplayName(HARD_CODED_QUERY.gameNameA);
export const DISPLAY_NAME_B = toDisplayName(HARD_CODED_QUERY.gameNameB);

