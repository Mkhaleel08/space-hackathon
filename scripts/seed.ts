/**
 * Reset the database to the known demo state.
 *
 *   npm run seed
 *
 * Reads data/seed/*.json, wipes the three tables, inserts fresh rows.
 * Run this before every demo. Requires SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Asset, Component, MachineEvent } from "../src/lib/types.ts";

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

// Delete children first. events -> components -> assets.
for (const table of ["events", "components", "assets"]) {
  const { error } = await db.from(table).delete().not("id", "is", null);
  if (error) throw new Error(`wipe ${table}: ${error.message}`);
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

console.log("Seeded. Demo state is clean.");
