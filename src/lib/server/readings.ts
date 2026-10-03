import type { Reading } from "@/lib/types";

// Simulated sensor readings, hardcoded per component for the demo.
const READINGS: Record<string, Reading[]> = {
  "hyd-pump": [
    { label: "Pressure", value: "4,850 psi", status: "ok" },
    { label: "Oil temp", value: "168 °F", status: "watch" },
    { label: "Case drain flow", value: "1.9 gpm", status: "ok" },
  ],
  "boom-cyl": [
    { label: "Rod seal", value: "Light weep", status: "watch" },
    { label: "Drift (10 min)", value: "12 mm", status: "ok" },
    { label: "Pin wear", value: "Within spec", status: "ok" },
  ],
  "engine-air": [
    { label: "Restriction", value: "18 in H₂O", status: "watch" },
    { label: "Hours since change", value: "410 h", status: "ok" },
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
