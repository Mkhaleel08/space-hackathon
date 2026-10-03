-- Machine memory schema. Run in the Supabase SQL editor.
-- Owner: backend. Keep in sync with src/lib/types.ts.

create extension if not exists "pgcrypto";

create table if not exists assets (
  id text primary key,
  name text not null,
  model text not null,
  hours integer not null default 0
);

create table if not exists components (
  id text primary key,            -- also the QR code payload
  asset_id text not null references assets(id) on delete cascade,
  name text not null,
  location text not null
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  component_id text not null references components(id) on delete cascade,
  type text not null check (type in ('fault', 'repair', 'inspection', 'note')),
  summary text not null,
  detail text,
  author_role text not null check (author_role in ('operator', 'technician')),
  created_at timestamptz not null default now()
);

create index if not exists events_component_created_idx
  on events (component_id, created_at desc);

-- Demo app, single team, server-side service role key. RLS stays off for the
-- hackathon. Turn it on before anything real touches this.

-- Cached LLM card wording. Key is "<component_id>:<role>:<hash of history>",
-- so the same history always shows the same text and a new note produces a
-- new row. No foreign keys on purpose: `npm run seed` must not clear it.
-- To force fresh wording: truncate card_cache;
create table if not exists card_cache (
  key text primary key,
  summary text not null,
  next_step text not null,
  created_at timestamptz not null default now()
);
