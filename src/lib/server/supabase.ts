import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service-role client. Server-only: never import this from a client component.
// Created lazily so `next build` does not need the env vars.
let client: SupabaseClient | null = null;

export function hasSupabase(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function supabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}
