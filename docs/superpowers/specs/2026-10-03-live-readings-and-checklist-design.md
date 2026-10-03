# Live readings, note snapshots, and the inspection checklist

Written Oct 3, 1:30 PM. Approved by Mehran in chat. Three PRs, checklist
last and cut first if the clock runs out.

## Goal

A tech standing at the part can change its readings by talking to the part
assistant or by leaving a note, every note keeps the readings as they were
when it was saved, and the card carries an inspection checklist the tech
walks through and files as one inspection event.

## What exists

- Readings are a hardcoded map in `src/lib/server/readings.ts`, returned by
  `readingsFor(id)` and shown on the card, the live view and the dashboard.
- `POST /api/components/[id]/notes` runs one LLM call (`structureNote`) that
  picks an event type and a one-line summary, then inserts the event.
- `POST /api/components/[id]/chat` streams a plain-text answer grounded in the
  history and readings. Nothing is stored.
- The card wording is cached in `card_cache` by a key that hashes the history
  and the readings, so a changed reading regenerates the card on its own.

## Data

### `readings` table

```sql
create table if not exists readings (
  component_id text not null references components(id) on delete cascade,
  position integer not null,
  label text not null,
  value text not null,
  status text not null check (status in ('ok', 'watch', 'alert')),
  updated_at timestamptz not null default now(),
  primary key (component_id, label)
);
```

- Seeded by `scripts/seed.ts` from the static map (`SEED_READINGS` exported
  from `readings.ts`). Reseed restores the demo values.
- `readingsFor(id)` becomes async: table first, static map when the table is
  missing, errors, or has no rows for the part. Order by `position`.
- `updateReadings(id, updates)` upserts the changed rows and returns the full
  list after the change. Without Supabase it mutates an in-memory copy.
- Readings never gain or lose labels through the app. Only values and
  statuses change.

### `events.readings`

Nullable `jsonb` column. Holds `Reading[]` as they stood after the note was
saved. `MachineEvent` gets `readings?: Reading[] | null`. Seeded events have
none.

### `card_cache.checklist`

Nullable `jsonb` column holding `string[]`. `ComponentCard` gets
`checklist: ChecklistItem[]` where `ChecklistItem = { id: string; text: string }`
and `id` is the item's index as a string. `PROMPT_VERSION` bumps to `v3`.

## The extractor

`extractReadingUpdates(text, readings, component)` in `llm.ts`. One JSON call:

- Input: the part name, the current readings with labels, values and
  statuses, and the text inside a `<note>` data block.
- Output: `{"updates": [{"label": string, "value": string, "status": "ok" | "watch" | "alert"}]}`.
- Rules in the prompt: only labels that already exist; only values the person
  states as measured or observed now; never a question, a hypothetical, a
  target, or a past value; keep the unit style of the existing value; pick the
  status from the value and the other readings' context; empty list when
  nothing applies.
- Returns `[]` on no model, timeout, bad JSON, or unknown labels. Never throws.

Readings change only through this extractor, called from the notes route and
the chat route.

## Chat changes readings

1. The chat route runs the extractor on the last user turn before streaming.
2. Applied updates are written, then `streamChat` is called with the fresh
   readings. The system prompt gains one line: a measurement the user states
   has already been recorded on the card; confirm it in a few words and move
   on.
3. The response carries a header `x-readings-updated` with JSON
   `{ changes: { label, from, to, status }[], readings: Reading[] }`. Absent
   when nothing changed. Headers go out before the first chunk, so the
   plain-text stream stays as documented.
4. `PartChat` reads the header and calls `onReadings(readings)`. The live view
   patches the open card in state and in its cache for both roles. The thread
   shows a yellow chip under the user turn: "Inner pad 4.5 mm → 3.5 mm · watch".
5. Expected cost: one to two seconds before the first token.

## Notes log readings

1. `addNote` runs the extractor on the note text, applies updates, then
   inserts the event with `readings` set to the post-update list.
2. `NewNoteResponse` is unchanged in shape; `event.readings` is now filled.
3. The full card shows "Readings when saved" as a one-line list under an event
   that has them. The live-view memory panel shows the same line in smaller
   type when expanded.
4. The live view already refetches the card after a voice note, so changed
   readings and regenerated wording appear through the existing path.

## Checklist

1. `writeCard` returns `checklist: string[]` of 4 to 6 items alongside summary
   and next step, role-aware: the technician list names parts and
   measurements, the operator list is a walkaround. The prompt tells the model
   to put history-driven items first.
2. Cached with the card. Placeholder text when no model: three generic steps.
3. Checked state lives in client state per part, per session. No persistence.
4. Live view: inside the expanded Next step panel, a list of tap rows at least
   44 px tall, and a "Finish inspection" button enabled once any item is
   checked. Full card: the same list under Next step.
5. Finish posts a normal note through `POST .../notes` with text built on the
   client:

   ```
   Inspection checklist completed. Checked: <items>. Skipped: <items>.
   ```

   The structurer files it as an inspection, the extractor runs, the snapshot
   attaches. The checked state clears on success.

## Errors

- Readings table missing: everything falls back to the static map and updates
  are lost with a server log line. No user-facing error.
- Extractor fails: the note still saves, the chat still answers. No update,
  no chip.
- Chat header parse fails: the answer still shows, no patch.

## Out of scope

No endpoint to edit a reading by hand, no undo, no new labels, no persistence
of checked boxes, no checklist on the dashboard. The dashboard reads the same
`readingsFor`, so it shows changed values without further work.

## Ownership

Touches `src/app/api/`, `src/lib/server/`, `supabase/`, `scripts/`, and
`src/lib/types.ts`. Mehran reopened scope for this and tells Neeraj and
Vineeth. Addendum goes in `docs/decisions.md` with PR A.
