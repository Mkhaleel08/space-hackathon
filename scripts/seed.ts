/**
 * Reset the database to the known demo state.
 *
 *   npm run seed
 *
 * Reads data/seed/*.json, wipes the tables, inserts fresh rows. Tags come
 * from src/lib/markers.ts.
 * Run this before every demo. Requires SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Asset, Component, MachineEvent } from "../src/lib/types.ts";
import { TAG_TO_COMPONENT } from "../src/lib/markers.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

function load<T>(name: string): T[] {
  return JSON.parse(readFileSync(`data/seed/${name}.json`, "utf8"));
}

const assets = load<Asset>("assets");
const components = load<Component>("components");
const events = load<Omit<MachineEvent, "id">>("events");

// Delete children first. events, tags -> components -> assets.
for (const table of ["events", "tags", "components", "assets"]) {
  const key = table === "tags" ? "tag_id" : "id";
  const { error } = await db.from(table).delete().not(key, "is", null);
  if (error && !(table === "tags" && (error.code === "42P01" || error.code === "PGRST205"))) throw new Error(`wipe ${table}: ${error.message}`);
}

async function insert(table: string, rows: object[]) {
  const { error } = await db.from(table).insert(rows);
  if (error) throw new Error(`insert ${table}: ${error.message}`);
  console.log(`${table}: ${rows.length} rows`);
}

// Parents first. assets -> components -> events.
await insert("assets", assets);
await insert("components", components);
await insert("events", events);
const tags = Object.entries(TAG_TO_COMPONENT)
  .map(([tag_id, component_id]) => ({ tag_id: Number(tag_id), component_id }))
  .filter((t) => components.some((c) => c.id === t.component_id));
const tagResult = await db.from("tags").insert(tags);
if (tagResult.error && (tagResult.error.code === "42P01" || tagResult.error.code === "PGRST205")) console.log("tags: table missing, run supabase/schema.sql (live view falls back to src/lib/markers.ts)");
else if (tagResult.error) throw new Error(`insert tags: ${tagResult.error.message}`);
else console.log(`tags: ${tags.length} rows`);

console.log("Seeded. Demo state is clean.");
