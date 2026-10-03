import type { Reading } from "@/lib/types";

/** A part's condition from its worst reading; "none" means no telemetry at all. */
export type Level = Reading["status"] | "none";

/** Lower sorts first. Unknown data ranks above healthy on purpose. */
export const LEVEL_RANK: Record<Level, number> = { alert: 0, watch: 1, none: 2, ok: 3 };

export const LEVEL_LABEL: Record<Level, string> = {
  alert: "Needs attention",
  watch: "Watch closely",
  ok: "Running normal",
  none: "No readings",
};

/** Text colour for a status mark. Never a fill: colour is a signal, not a surface. */
export const LEVEL_TONE: Record<Level, string> = {
  ok: "text-ok",
  watch: "text-watch",
  alert: "text-alert",
  none: "text-muted",
};

export function worstOf(readings: Reading[] | undefined): Level {
  if (!readings?.length) return "none";
  if (readings.some((r) => r.status === "alert")) return "alert";
  if (readings.some((r) => r.status === "watch")) return "watch";
  return "ok";
}

/** Worst across parts that have readings; "none" only when no part reports. */
export function worstLevel(levels: Level[]): Level {
  const known = levels.filter((l) => l !== "none");
  if (!known.length) return "none";
  return known.reduce((worst, l) => (LEVEL_RANK[l] < LEVEL_RANK[worst] ? l : worst));
}

/** The reading that set the level, for a one-line headline. */
export function headlineReading(readings: Reading[] | undefined): Reading | null {
  if (!readings?.length) return null;
  const level = worstOf(readings);
  return readings.find((r) => r.status === level) ?? readings[0];
}
