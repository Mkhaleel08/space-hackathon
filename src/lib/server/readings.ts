import type { Reading } from "@/lib/types";

// Simulated sensor readings, hardcoded per component for the demo. Keep them
// consistent with data/seed/events.json: the card prompt reads both.
const READINGS: Record<string, Reading[]> = {
  "hyd-pump": [
    { label: "Pressure", value: "3,090 psi", status: "ok" },
    { label: "Oil temp", value: "168 °F", status: "watch" },
    { label: "Case drain flow", value: "1.9 gpm", status: "ok" },
  ],
  "boom-cyl": [
    { label: "Rod seal", value: "Dry", status: "ok" },
    { label: "Drift (10 min)", value: "5 mm", status: "ok" },
    { label: "Pin wear", value: "Within spec", status: "ok" },
  ],
  "engine-air": [
    { label: "Restriction", value: "12 in H₂O", status: "ok" },
    { label: "Hours since change", value: "230 of 250 h", status: "watch" },
    { label: "Pre-cleaner", value: "Clear", status: "ok" },
  ],
  "track-left": [
    { label: "Track sag", value: "32 mm", status: "ok" },
    { label: "Final drive oil", value: "Full", status: "ok" },
    { label: "Roller temp", value: "141 °F", status: "ok" },
  ],
};

export function readingsFor(componentId: string): Reading[] {
  return READINGS[componentId] ?? [];
}
