import type { Reading } from "@/lib/types";
import { hasSupabase, supabase } from "./supabase";
import seedReadings from "../../../data/seed/readings.json";

// Demo readings per component live in data/seed/readings.json: loaded into the
// `readings` table by `npm run seed` and used directly when the table is
// missing. Keep them consistent with data/seed/events.json: the card prompt
// reads both.
const SEED_READINGS = seedReadings as Record<string, Reading[]>;

export type ReadingUpdate = { label: string; value: string; status: Reading["status"] };

// Without Supabase, updates live here until the server restarts.
const localReadings = new Map<string, Reading[]>();

/** The part's live readings: the table first, the static map when it is missing or empty. */
export async function readingsFor(componentId: string): Promise<Reading[]> {
  const fallback = localReadings.get(componentId) ?? SEED_READINGS[componentId] ?? [];
  if (!hasSupabase()) return fallback;
  const { data, error } = await supabase()
    .from("readings")
    .select("label, value, status, position")
    .eq("component_id", componentId)
    .order("position", { ascending: true });
  if (error) {
    console.error("[readings] read:", error.message);
    return fallback;
  }
  if (!data || data.length === 0) return fallback;
  return data.map((r) => ({ label: r.label, value: r.value, status: r.status }));
}

/** Apply value and status changes to existing labels and return the full list after. */
export async function updateReadings(componentId: string, updates: ReadingUpdate[]): Promise<Reading[]> {
  const current = await readingsFor(componentId);
  const next = current.map((r) => {
    const u = updates.find((x) => x.label === r.label);
    return u ? { ...r, value: u.value, status: u.status } : r;
  });
  if (!hasSupabase()) {
    localReadings.set(componentId, next);
    return next;
  }
  const now = new Date().toISOString();
  const rows = next.map((r, position) => ({ component_id: componentId, position, label: r.label, value: r.value, status: r.status, updated_at: now }));
  const { error } = await supabase().from("readings").upsert(rows, { onConflict: "component_id,label" });
  if (error) console.error("[readings] write:", error.message);
  return next;
}
