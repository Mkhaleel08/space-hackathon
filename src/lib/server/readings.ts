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
  // BMW M3, the car in the room for the live demo. Readings a car reports on
  // its own dash or that a tech measures through the wheel.
  "car-brakes-lf": [
    { label: "Inner pad", value: "4.5 mm", status: "watch" },
    { label: "Outer pad", value: "6 mm", status: "ok" },
    { label: "Wear sensor", value: "Not tripped", status: "ok" },
  ],
  "car-tire-lf": [
    { label: "Pressure", value: "35 psi", status: "ok" },
    { label: "Tread (inner)", value: "5/32 in", status: "ok" },
    { label: "Temp", value: "84 °F", status: "ok" },
  ],
  "car-engine-oil": [
    { label: "Level", value: "Mid range", status: "ok" },
    { label: "Oil temp", value: "212 °F", status: "ok" },
    { label: "Since change", value: "6,300 of 10,000 mi", status: "ok" },
  ],
  "car-air-filter": [
    { label: "Since change", value: "8,400 of 30,000 mi", status: "ok" },
    { label: "Lid clips", value: "4 of 4 seated", status: "ok" },
    { label: "Intake temp", value: "+9 °F over ambient", status: "ok" },
  ],
  "car-battery": [
    { label: "Resting voltage", value: "12.4 V", status: "watch" },
    { label: "Cranking amps", value: "520 of 800", status: "watch" },
    { label: "Age", value: "5 years", status: "watch" },
  ],
};

export function readingsFor(componentId: string): Reading[] {
  return READINGS[componentId] ?? [];
}
