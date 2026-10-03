/**
 * AprilTag (36h11 family) id -> component id. Printed labels carry only the
 * tag; the lookup lives here so labels never need reprinting when data moves.
 * Ids 0-9 are the Cat 320, 10-19 the demo car. Keep in sync with
 * data/seed/components.json and public/tags/print.html.
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
