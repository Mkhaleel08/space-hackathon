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

-- Row level security: see the bottom of this file.

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

-- AprilTag 36h11 id -> component. Seeded from src/lib/markers.ts; the operator
-- dashboard assigns the next free id when a part is added. Cascades with the
-- component, and `npm run seed` reloads it.
create table if not exists tags (
  tag_id integer primary key check (tag_id between 0 and 586),
  component_id text not null unique references components(id) on delete cascade
);
insert into tags (tag_id, component_id) values
  (0, 'hyd-pump'), (1, 'boom-cyl'), (2, 'engine-air'), (3, 'track-left'),
  (10, 'car-brakes-lf'), (11, 'car-battery'), (12, 'car-air-filter'), (13, 'car-tire-lf')
on conflict do nothing;

-- Live readings per part. Seeded from src/lib/server/readings.ts by
-- `npm run seed`; changed by the part assistant and by notes that state a
-- measurement. The app falls back to the static map when this table is
-- missing or has no rows for a part.
create table if not exists readings (
  component_id text not null references components(id) on delete cascade,
  position integer not null,
  label text not null,
  value text not null,
  status text not null check (status in ('ok', 'watch', 'alert')),
  updated_at timestamptz not null default now(),
  primary key (component_id, label)
);

-- Readings as they stood when a note was saved. Null on seeded rows.
alter table events add column if not exists readings jsonb;

-- Inspection checklist written with the card. Null on rows cached before Oct 3.
alter table card_cache add column if not exists checklist jsonb;

-- Row level security. The app only talks to the database from the server with
-- the service role key, which bypasses RLS. Enabling RLS with no policies means
-- the public anon key can read and write nothing, so a leaked project URL is
-- harmless. Safe to re-run.
alter table assets enable row level security;
alter table components enable row level security;
alter table events enable row level security;
alter table card_cache enable row level security;
alter table tags enable row level security;
alter table readings enable row level security;
