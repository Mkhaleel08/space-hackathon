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

export const LEVEL_PILL: Record<Level, string> = {
  ok: "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200",
  watch: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  alert: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  none: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
};

export const LEVEL_DOT: Record<Level, string> = {
  ok: "bg-green-600 dark:bg-green-400",
  watch: "bg-amber-500 dark:bg-amber-400",
  alert: "bg-red-600 dark:bg-red-400",
  none: "border-2 border-neutral-400 bg-transparent dark:border-neutral-500",
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
