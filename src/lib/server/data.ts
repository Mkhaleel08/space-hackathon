import type { Asset, Component, MachineEvent } from "@/lib/types";
import { hasSupabase, supabase } from "./supabase";
import seedAssets from "../../../data/seed/assets.json";
import seedComponents from "../../../data/seed/components.json";
import seedEvents from "../../../data/seed/events.json";

// Reads and writes go to Supabase. If the keys are not set yet, fall back to
// the seed JSON (plus an in-memory list for new notes) so the routes work
// during local development. In-memory notes are lost on restart.

const RECENT_EVENTS = 10;
const localEvents: MachineEvent[] = [];

export async function getComponent(id: string): Promise<Component | null> {
  if (!hasSupabase()) {
    return (seedComponents as Component[]).find((c) => c.id === id) ?? null;
  }
  const { data, error } = await supabase()
    .from("components")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Component | null;
}

export async function getAsset(id: string): Promise<Asset | null> {
  if (!hasSupabase()) {
    return (seedAssets as Asset[]).find((a) => a.id === id) ?? null;
  }
  const { data, error } = await supabase()
    .from("assets")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Asset | null;
}

export async function getRecentEvents(
  componentId: string,
): Promise<MachineEvent[]> {
  if (!hasSupabase()) {
    const seeded = (seedEvents as Omit<MachineEvent, "id">[]).map((e, i) => ({
      id: `seed-${i}`,
      ...e,
    })) as MachineEvent[];
    return [...localEvents, ...seeded]
      .filter((e) => e.component_id === componentId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, RECENT_EVENTS);
  }
  const { data, error } = await supabase()
    .from("events")
    .select("*")
    .eq("component_id", componentId)
    .order("created_at", { ascending: false })
    .limit(RECENT_EVENTS);
  if (error) throw error;
  return (data ?? []) as MachineEvent[];
}

export async function insertEvent(
  event: Omit<MachineEvent, "id" | "created_at">,
): Promise<MachineEvent> {
  if (!hasSupabase()) {
    const row: MachineEvent = {
      id: `local-${Date.now()}`,
      created_at: new Date().toISOString(),
      ...event,
    };
    localEvents.unshift(row);
    return row;
  }
  const { data, error } = await supabase()
    .from("events")
    .insert(event)
    .select("*")
    .single();
  if (error) throw error;
  return data as MachineEvent;
}

export async function listComponents(): Promise<Component[]> {
  if (!hasSupabase()) return seedComponents as Component[];
  const { data, error } = await supabase()
    .from("components")
    .select("*")
    .order("id");
  if (error) throw error;
  return (data ?? []) as Component[];
}

// --- Card text cache -------------------------------------------------------
// Memory first (fast, per server instance), then the `card_cache` table so
// the wording is stable across Vercel instances and cold starts. If the table
// is missing or errors, the card still works; it just regenerates.

type CardText = { summary: string; next_step: string };
const cardTextMemory = new Map<string, CardText>();

export async function getCachedCardText(key: string): Promise<CardText | null> {
  const hit = cardTextMemory.get(key);
  if (hit) return hit;
  if (!hasSupabase()) return null;
  const { data, error } = await supabase()
    .from("card_cache")
    .select("summary, next_step")
    .eq("key", key)
    .maybeSingle();
  if (error) {
    console.error("[card_cache] read:", error.message);
    return null;
  }
  if (!data) return null;
  cardTextMemory.set(key, data as CardText);
  return data as CardText;
}

export async function saveCardText(key: string, text: CardText): Promise<void> {
  cardTextMemory.set(key, text);
  if (!hasSupabase()) return;
  // ignoreDuplicates: if two requests race, the first writer wins and both
  // later read the same row.
  const { error } = await supabase()
    .from("card_cache")
    .upsert({ key, ...text }, { onConflict: "key", ignoreDuplicates: true });
  if (error) console.error("[card_cache] write:", error.message);
}

// --- Dashboard reads ---------------------------------------------------------

const DASHBOARD_EVENTS = 200;

export async function listAssets(): Promise<Asset[]> {
  if (!hasSupabase()) return seedAssets as Asset[];
  const { data, error } = await supabase().from("assets").select("*").order("id");
  if (error) throw error;
  return (data ?? []) as Asset[];
}

/** Newest first, across every part. */
export async function listEvents(limit = DASHBOARD_EVENTS): Promise<MachineEvent[]> {
  if (!hasSupabase()) {
    const seeded = (seedEvents as Omit<MachineEvent, "id">[]).map((e, i) => ({ id: `seed-${i}`, ...e })) as MachineEvent[];
    return [...localEvents, ...seeded]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  }
  const { data, error } = await supabase()
    .from("events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as MachineEvent[];
}

/** Removes one event and returns it, or null if no such row. Nothing cascades. */
export async function deleteEvent(id: string): Promise<MachineEvent | null> {
  if (!hasSupabase()) {
    const i = localEvents.findIndex((e) => e.id === id);
    if (i === -1) return null;
    return localEvents.splice(i, 1)[0];
  }
  const { data, error } = await supabase()
    .from("events")
    .delete()
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return (data as MachineEvent | null) ?? null;
}
