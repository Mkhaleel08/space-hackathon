/**
 * AprilTag (36h11 family) id -> component id. Printed labels carry only the
 * tag. The live table is `tags` in Supabase (GET /api/tags); this static map
 * seeds it and is the fallback when the API is unreachable. Ids 0-9 are the
 * Cat 320, 10-19 the demo car.
 */
export const TAG_TO_COMPONENT: Record<number, string> = {
  0: "hyd-pump",
  1: "boom-cyl",
  2: "engine-air",
  3: "track-left",
  10: "car-brakes-lf",
  11: "car-battery",
  12: "car-air-filter",
  13: "car-tire-lf",
};

export const DICTIONARY = "APRILTAG_36h11";

export function componentForTag(id: number): string | null {
  return TAG_TO_COMPONENT[id] ?? null;
}

/** Smallest 36h11 id not in `used`, or null when the family is exhausted. */
export function nextFreeTag(used: Iterable<number>, familySize: number): number | null {
  const taken = new Set(used);
  for (let id = 0; id < familySize; id++) if (!taken.has(id)) return id;
  return null;
}
