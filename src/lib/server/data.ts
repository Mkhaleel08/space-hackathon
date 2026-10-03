import type { Asset, Component, MachineEvent } from "@/lib/types";
import { hasSupabase, supabase } from "./supabase";
import seedAssets from "../../../data/seed/assets.json";
import seedComponents from "../../../data/seed/components.json";
import seedEvents from "../../../data/seed/events.json";

// Reads go to Supabase. If the keys are not set yet, fall back to the seed
// JSON so the routes return real-shaped data during local development.

const RECENT_EVENTS = 10;

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
    return (seedEvents as Omit<MachineEvent, "id">[])
      .filter((e) => e.component_id === componentId)
      .map((e, i) => ({ id: `seed-${i}`, ...e }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, RECENT_EVENTS) as MachineEvent[];
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

export async function listComponents(): Promise<Component[]> {
  if (!hasSupabase()) return seedComponents as Component[];
  const { data, error } = await supabase()
    .from("components")
    .select("*")
    .order("id");
  if (error) throw error;
  return (data ?? []) as Component[];
}
