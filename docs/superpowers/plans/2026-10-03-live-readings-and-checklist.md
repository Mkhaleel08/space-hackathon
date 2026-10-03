# Live Readings and Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Readings move to a table that the chat and notes can change, every note snapshots the readings, and the card carries an LLM-written inspection checklist the tech checks off and files as one inspection.

**Architecture:** One JSON extractor in the LLM module reads measurements out of free text against the part's current readings. The notes route and the chat route both call it before doing their existing work. The card prompt grows a `checklist` array cached next to summary and next step. No new endpoints; the checklist finish posts a normal note.

**Tech Stack:** Next.js 16 App Router, Supabase Postgres via `@supabase/supabase-js`, Anthropic or OpenAI over fetch, React client components.

**Spec:** `docs/superpowers/specs/2026-10-03-live-readings-and-checklist-design.md`

## Global Constraints

- No tests unless asked (project rule). Verify with `npx tsc --noEmit`, `npm run lint`, curl, and a phone.
- Never write a real key into any file. Keys live in `.env.local` only.
- Mobile first: tap targets at least 44 px, no hover-only interactions.
- The chat response stays `text/plain` streamed chunks. Side data rides in headers only.
- Readings never gain or lose labels through the app. Values and statuses only.
- Each PR leaves `main` demo-able. Merge order A, B, C. C is dropped if it slips past 4:15 PM.
- Branch: `mehran/live-readings` for A; `mehran/chat-readings` for B; `mehran/checklist` for C, each from `origin/main` after the previous merge.

## Review Focus

1. A question that contains a number ("what if the pad were at 2 mm?") must not change a reading. Pinned in Task 2 by the extractor prompt and a curl check with a hypothetical.
2. The readings table missing or empty for a part must fall back to the static map and never 500. Pinned in Task 1 by running without the table applied.
3. A note that mentions no measurement must still save and still carry the snapshot. Pinned in Task 3 curl check.
4. Chat header missing or malformed must not break the streamed answer. Pinned in Task 5 by guarding the JSON parse.
5. Finishing the checklist with nothing checked must be impossible; the button stays disabled. Pinned in Task 8.

---

## PR A: readings table, extractor, note updates and snapshots

### Task 1: Readings table with static fallback

**Files:**
- Modify: `supabase/schema.sql` (append after the `tags` table)
- Modify: `src/lib/server/readings.ts`
- Modify: `scripts/seed.ts`
- Modify: `src/lib/server/card.ts:38`, `src/lib/server/dashboard.ts:19`, `src/app/api/components/[id]/chat/route.ts:62` (await the now-async `readingsFor`)

**Interfaces:**
- Produces: `readingsFor(id: string): Promise<Reading[]>`, `updateReadings(id: string, updates: ReadingUpdate[]): Promise<Reading[]>`, `SEED_READINGS: Record<string, Reading[]>`, `type ReadingUpdate = { label: string; value: string; status: Reading["status"] }`.

- [ ] **Step 1: Schema.** Append to `supabase/schema.sql` before the RLS block:

```sql
-- Live readings per part. Seeded from src/lib/server/readings.ts by
-- `npm run seed`; changed by the part assistant and by notes. The app falls
-- back to the static map when this table is missing.
create table if not exists readings (
  component_id text not null references components(id) on delete cascade,
  position integer not null,
  label text not null,
  value text not null,
  status text not null check (status in ('ok', 'watch', 'alert')),
  updated_at timestamptz not null default now(),
  primary key (component_id, label)
);
alter table readings enable row level security;

-- Readings as they stood when a note was saved. Null on seeded rows.
alter table events add column if not exists readings jsonb;

-- Inspection checklist written with the card. Null on rows cached before Oct 3.
alter table card_cache add column if not exists checklist jsonb;
```

Also add `alter table readings enable row level security;` to the RLS list at the bottom if that list is where the others live (keep one copy).

- [ ] **Step 2: Rewrite `readings.ts`.** Rename the constant to `SEED_READINGS` and export it. Add:

```ts
import { hasSupabase, supabase } from "./supabase";

export type ReadingUpdate = { label: string; value: string; status: Reading["status"] };

// Without Supabase, updates live here until the server restarts.
const localReadings = new Map<string, Reading[]>();

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

/** Apply value/status changes to existing labels and return the full list after. */
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
  const rows = next.map((r, position) => ({ component_id: componentId, position, label: r.label, value: r.value, status: r.status, updated_at: new Date().toISOString() }));
  const { error } = await supabase().from("readings").upsert(rows, { onConflict: "component_id,label" });
  if (error) console.error("[readings] write:", error.message);
  return next;
}
```

- [ ] **Step 3: Await the three callers.** `card.ts`: `const readings = await readingsFor(componentId);`. `dashboard.ts`: build with `Promise.all(components.map(async (c) => [c.id, await readingsFor(c.id)] as const))` then `Object.fromEntries`. Chat route: `const readings = await readingsFor(id);` and pass it to `streamChat`.

- [ ] **Step 4: Seed.** In `scripts/seed.ts` import `SEED_READINGS` from `../src/lib/server/readings.ts` (this file imports `./supabase`, which imports `@supabase/supabase-js`, already a dependency, fine under node). Add `"readings"` to the wipe list before `"events"` with key `component_id`, ignoring the same missing-table codes as tags. After events:

```ts
const readingRows = Object.entries(SEED_READINGS).flatMap(([component_id, list]) =>
  list.map((r, position) => ({ component_id, position, ...r })),
).filter((r) => components.some((c) => c.id === r.component_id));
const readingResult = await db.from("readings").insert(readingRows);
if (readingResult.error && (readingResult.error.code === "42P01" || readingResult.error.code === "PGRST205")) console.log("readings: table missing, run supabase/schema.sql (app falls back to static readings)");
else if (readingResult.error) throw new Error(`insert readings: ${readingResult.error.message}`);
else console.log(`readings: ${readingRows.length} rows`);
```

- [ ] **Step 5: Verify.** `npx tsc --noEmit`. Start `npm run dev -- -p 3200`, `curl -s localhost:3200/api/components/car-brakes-lf/card?role=technician | jq .readings` returns the three brake readings before the table exists (fallback path, Review Focus 2). Then apply the schema SQL through the Supabase MCP, run `npm run seed`, curl again, same values.

- [ ] **Step 6: Commit.** `git add supabase/schema.sql src/lib/server scripts/seed.ts src/app/api && git commit -m "Readings move to a table with the static map as fallback"`.

### Task 2: The extractor

**Files:**
- Modify: `src/lib/server/llm.ts` (after `structureNote`)

**Interfaces:**
- Consumes: `ReadingUpdate` from `readings.ts`, `complete`, `parseJson`, `asData`, `DATA_RULE`.
- Produces: `extractReadingUpdates(text: string, readings: Reading[], component: Component): Promise<ReadingUpdate[]>`.

- [ ] **Step 1: Write it.**

```ts
/**
 * Reads measurements out of a note or a chat turn. Returns changes only for
 * labels that already exist on the part, and only when the person states a
 * value as measured now. Never throws; [] when unsure.
 */
export async function extractReadingUpdates(
  text: string,
  readings: Reading[],
  component: Component,
): Promise<ReadingUpdate[]> {
  if (readings.length === 0 || !/\d/.test(text) && !/\b(dry|wet|full|low|empty|clear|clogged|tripped|seated|loose|flat)\b/i.test(text)) return [];
  const system = [
    "You update the live readings of one part of a machine or vehicle from what a worker just said or wrote.",
    'Respond with JSON only: {"updates": [{"label": string, "value": string, "status": "ok" | "watch" | "alert"}]}.',
    "Only use labels that appear in <readings>. Never invent a label.",
    "Only record a value the worker states as measured or observed right now. A question, a hypothetical, a target, a spec limit, or a past value is not an update. When unsure, leave it out.",
    "Write value in the same style and unit as the existing value for that label.",
    "Choose status from the new value: ok when normal, watch when it is drifting toward a limit, alert when it is at or past one.",
    'When nothing applies respond {"updates": []}.',
    DATA_RULE,
  ].join(" ");
  const user = [
    `Part: ${component.name}, located ${component.location}.`,
    "<readings>",
    describeReadings(readings),
    "</readings>",
    "<note>",
    asData(text),
    "</note>",
  ].join("\n");
  const out = parseJson<{ updates?: unknown }>(await complete(system, user));
  if (!out || !Array.isArray(out.updates)) return [];
  const labels = new Set(readings.map((r) => r.label));
  const seen = new Set<string>();
  const result: ReadingUpdate[] = [];
  for (const u of out.updates as Array<Record<string, unknown>>) {
    if (!u || typeof u !== "object") continue;
    const label = typeof u.label === "string" ? u.label.trim() : "";
    const value = typeof u.value === "string" ? u.value.trim().slice(0, 40) : "";
    const status = u.status === "ok" || u.status === "watch" || u.status === "alert" ? u.status : null;
    if (!label || !value || !status || !labels.has(label) || seen.has(label)) continue;
    seen.add(label);
    result.push({ label, value, status });
  }
  return result;
}
```

Add the `ReadingUpdate` import from `./readings`. The cheap keyword gate at the top skips the LLM call for ordinary questions, so most chat turns pay nothing.

- [ ] **Step 2: Verify.** `npx tsc --noEmit`. Real behavior is checked through the notes route in Task 3.

- [ ] **Step 3: Commit.** `git commit -am "Extractor reads measurements out of free text against the part's readings"`.

### Task 3: Notes update readings and snapshot them

**Files:**
- Modify: `src/lib/types.ts` (`MachineEvent.readings`)
- Modify: `src/lib/server/notes.ts`
- Modify: `src/lib/server/data.ts:68` (`insertEvent` type already accepts the new field once the type changes; the no-Supabase branch is fine)
- Modify: `docs/api-contract.md` (notes section)

**Interfaces:**
- Produces: `MachineEvent.readings?: Reading[] | null`.

- [ ] **Step 1: Type.** In `types.ts` add to `MachineEvent`:

```ts
  readings?: Reading[] | null; // snapshot when the note was saved; absent on seeded rows
```

Move the `Reading` interface above `MachineEvent` so it is declared first (not required by TS, but reads better).

- [ ] **Step 2: `addNote`.**

```ts
import { extractReadingUpdates, structureNote } from "./llm";
import { readingsFor, updateReadings } from "./readings";

export async function addNote(componentId: string, body: NewNoteRequest): Promise<MachineEvent | null> {
  const component = await getComponent(componentId);
  if (!component) return null;
  const current = await readingsFor(componentId);
  const [{ type, summary }, updates] = await Promise.all([
    structureNote(body.text, body.author_role, component),
    extractReadingUpdates(body.text, current, component),
  ]);
  const readings = updates.length > 0 ? await updateReadings(componentId, updates) : current;
  return insertEvent({
    component_id: componentId,
    type,
    summary,
    detail: body.text,
    author_role: body.author_role,
    readings: readings.length > 0 ? readings : null,
  });
}
```

- [ ] **Step 3: Contract.** In `docs/api-contract.md` under the notes route add: "The note text is also read for measurements against the part's current readings; a stated value ('inner pad is at 3.5 mm') updates that reading. The returned event carries `readings`, the full list as it stood after the save."

- [ ] **Step 4: Verify.** With dev running and the schema applied:

```bash
curl -s -X POST localhost:3200/api/components/car-brakes-lf/notes -H 'content-type: application/json' -d '{"text":"Measured the inner pad through the spokes, it is down to 3.5 mm","author_role":"technician"}' | jq .event.readings
```

Inner pad shows `3.5 mm`. Then a note without a number ("Heard the squeal again on the first cold stop") returns the unchanged snapshot (Review Focus 3). Then `curl .../card?role=technician | jq .readings` shows 3.5 mm and the summary mentions it. Run `npm run seed` after to restore.

- [ ] **Step 5: Commit.** `git commit -am "Notes update readings they mention and keep a snapshot on the event"`.

### Task 4: Show the snapshot and ship PR A

**Files:**
- Modify: `src/components/component-card.tsx:166-176` (under the event detail)
- Modify: `src/components/ar-view.tsx:1497-1505` (memory panel event rows)
- Modify: `docs/decisions.md` (addendum)

- [ ] **Step 1: Full card.** After the `event.detail` block inside the `<li>`:

```tsx
{event.readings && event.readings.length > 0 && (
  <p className="mt-2 text-xs text-muted">
    <span className="font-semibold">Readings when saved:</span>{" "}
    {event.readings.map((r) => `${r.label} ${r.value}`).join(" · ")}
  </p>
)}
```

- [ ] **Step 2: Live view.** Inside the memory panel's `<li>` after the summary `<p>`:

```tsx
{e.readings && e.readings.length > 0 && (
  <p className="mt-0.5 text-[11px] text-white/55">{e.readings.map((r) => `${r.label} ${r.value}`).join(" · ")}</p>
)}
```

- [ ] **Step 3: Decisions addendum.** Append to `docs/decisions.md`:

```
## Addendum, Oct 3 1:30 PM (Mehran)

Readings become **live**: they move from a hardcoded map to a `readings`
table, and the part assistant or a saved note can change a value by stating
it ("inner pad is at 3.5 mm"). Every note keeps a snapshot of the readings
when it was saved. The **inspection checklist** from the cut list comes back
as an LLM-written per-part list on the card, checked off on the phone and
filed as one inspection note. Three PRs; checklist last and dropped if it
slips past 4:15 PM. Reseed before the demo restores the readings.
```

- [ ] **Step 4: Verify.** `npx tsc --noEmit && npm run lint`. On the phone preview: save a note with a measurement from the live view, watch the memory panel show the snapshot line and the head panel show the new value after the refetch.

- [ ] **Step 5: Ship.** Commit, push, open PR "Live readings: table, note updates, snapshots", merge with a merge commit, deploy, run `npm run seed`.

---

## PR B: the chat changes readings

### Task 5: Chat route applies updates and reports them in a header

**Files:**
- Modify: `src/app/api/components/[id]/chat/route.ts:62-72`
- Modify: `src/lib/server/llm.ts` (`streamChat` system prompt, one line)
- Modify: `src/lib/chat.ts` (shared shape for the header payload)
- Modify: `docs/api-contract.md` (chat section)

**Interfaces:**
- Produces in `chat.ts`: `type ReadingChange = { label: string; from: string; to: string; status: Reading["status"] }`, `type ReadingsUpdated = { changes: ReadingChange[]; readings: Reading[] }`, `READINGS_HEADER = "x-readings-updated"`. `ChatMessage.changes?: ReadingChange[]` (client only; the server ignores it).

- [ ] **Step 1: Shapes in `chat.ts`.** Add the three exports above plus the optional field on `ChatMessage` with the comment "set by the client when the server reported reading changes for this turn; never sent back".

- [ ] **Step 2: Route.** Replace the readings line with:

```ts
const current = await readingsFor(id);
const lastUser = messages[messages.length - 1].content;
const updates = await extractReadingUpdates(lastUser, current, component);
let readings = current;
let updated: ReadingsUpdated | null = null;
if (updates.length > 0) {
  readings = await updateReadings(id, updates);
  updated = {
    changes: updates.map((u) => ({ label: u.label, from: current.find((r) => r.label === u.label)?.value ?? "", to: u.value, status: u.status })),
    readings,
  };
}
const stream = await streamChat(component, asset, history, readings, author_role, messages, updated !== null);
```

and add the header when `updated` is set: `headers[READINGS_HEADER] = JSON.stringify(updated)`. Header values must be a single line; `JSON.stringify` guarantees that. Keep values ASCII-safe by stripping non-Latin-1 characters: `.replace(/[^\x20-\xff]/g, "?")` is enough since labels and values use plain units (`°` and `₂` are Latin-1 or already present in the static map; `₂` is not, so apply the replace).

- [ ] **Step 3: Prompt.** `streamChat` gains a trailing boolean param `recorded = false`. When true, append to the system lines: "The measurement in the latest message has already been recorded on the card; confirm it in a few words, then answer what it means."

- [ ] **Step 4: Contract.** Under the chat route: "When the latest user turn states a measurement, the server records it before answering and sets `x-readings-updated` to JSON `{ changes: [{ label, from, to, status }], readings: Reading[] }`. Absent when nothing changed. The body is unchanged."

- [ ] **Step 5: Verify.** `curl -si -X POST localhost:3200/api/components/car-brakes-lf/chat -H 'content-type: application/json' -d '{"messages":[{"role":"user","content":"Inner pad is reading 3 millimeters now"}],"author_role":"technician"}' | head -20` shows the header. Repeat with "what if the inner pad were at 2 mm?" and confirm no header (Review Focus 1). Reseed.

- [ ] **Step 6: Commit.** `git commit -am "Chat records a stated measurement before answering and reports it in a header"`.

### Task 6: Live view patches the card and the thread shows a chip

**Files:**
- Modify: `src/components/part-chat.tsx:116-160` (`send`), `:310-325` (message render), props
- Modify: `src/components/ar-view.tsx:1226-1237` (pass `onReadings`), add a `patchReadings` callback near line 552

- [ ] **Step 1: Prop.** `PartChat` gets `onReadings: (readings: Reading[]) => void`.

- [ ] **Step 2: Read the header in `send`.** After `setPhase("streaming")`:

```ts
let changes: ReadingChange[] | undefined;
const raw = res.headers.get(READINGS_HEADER);
if (raw) {
  try {
    const parsed = JSON.parse(raw) as ReadingsUpdated;
    if (Array.isArray(parsed.changes) && Array.isArray(parsed.readings)) {
      changes = parsed.changes;
      onReadings(parsed.readings);
    }
  } catch {
    /* answer still shows */
  }
}
const userTurn: ChatMessage = changes ? { role: "user", content: text, changes } : { role: "user", content: text };
const thread2 = [...messagesRef.current.slice(0, -1), userTurn];
```

Then use `thread2` in place of `thread` for the remaining `onMessages` calls in that function (Review Focus 4 is the try/catch).

- [ ] **Step 3: Chip.** In the message map, after `{m.content}` for user turns:

```tsx
{m.role === "user" && m.changes && m.changes.length > 0 && (
  <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Readings updated">
    {m.changes.map((c) => (
      <li key={c.label} className="rounded-full bg-black/85 px-2.5 py-1 font-mono text-[11px] font-semibold text-[#ffcd11] ring-1 ring-black/40">
        {c.label} {c.from} → {c.to} · {c.status}
      </li>
    ))}
  </ul>
)}
```

- [ ] **Step 4: Live view.** Add:

```ts
const patchReadings = useCallback((id: string, readings: Reading[]) => {
  const patch = (c: Card): Card => ({ ...c, readings });
  for (const r of ["operator", "technician"] as const) {
    const key = `${id}:${r}`;
    const cached = cacheRef.current.get(key);
    if (cached) cacheRef.current.set(key, patch(cached));
  }
  setCards((prev) => {
    const next = { ...prev };
    for (const r of ["operator", "technician"] as const) {
      const s = prev[`${id}:${r}`];
      if (s?.kind === "ready") next[`${id}:${r}`] = { kind: "ready", card: patch(s.card) };
    }
    return next;
  });
}, []);
```

Pass `onReadings={(readings) => patchReadings(chatId, readings)}` to `PartChat`. The summary and next step regenerate on the next card fetch; after the stream ends, refetch the open card for the current role the same way the voice-note save does (copy that eight-line fetch) so the wording catches up.

- [ ] **Step 5: Verify.** `npx tsc --noEmit && npm run lint`. Phone: open the brake, tap Ask, say "inner pad is at three millimeters", watch the chip appear, the head panel value change to 3 mm with watch or alert, and the answer confirm it. Reseed.

- [ ] **Step 6: Ship.** Commit, push, PR "Chat changes readings", merge, deploy, reseed.

---

## PR C: inspection checklist

### Task 7: Checklist written with the card and cached

**Files:**
- Modify: `src/lib/types.ts` (`ChecklistItem`, `ComponentCard.checklist`)
- Modify: `src/lib/server/llm.ts` (`writeCard` prompt and return)
- Modify: `src/lib/server/card.ts` (`PROMPT_VERSION = "v3"`, `cardText` return, placeholder)
- Modify: `src/lib/server/data.ts:104-137` (`CardText` gains `checklist: string[]`, select and upsert it)
- Modify: `docs/api-contract.md` (card section, one line)

**Interfaces:**
- Produces: `ChecklistItem = { id: string; text: string }`, `ComponentCard.checklist: ChecklistItem[]`.

- [ ] **Step 1: Types.** Add `ChecklistItem` and `checklist: ChecklistItem[]` to `ComponentCard` with the comment "LLM-written inspection steps for the role, 4 to 6, history first".

- [ ] **Step 2: Prompt.** In `writeCard` the JSON shape becomes `{"summary": string, "next_step": string, "checklist": string[]}` with the rule: "checklist is 4 to 6 short imperative steps under 80 characters each for this role's inspection of this part; steps that follow from the history come first, routine checks after." Parse: `const checklist = Array.isArray(out.checklist) ? out.checklist.filter((s) => typeof s === "string" && s.trim()).map((s) => clamp(s, 80)).slice(0, 6) : [];` and return it. `writeCard` return type gains `checklist: string[]`.

- [ ] **Step 3: Cache.** `CardText` becomes `{ summary: string; next_step: string; checklist: string[] }`. Select `summary, next_step, checklist` and map a null `checklist` to `[]`. Upsert the array as is (jsonb).

- [ ] **Step 4: `card.ts`.** Bump `PROMPT_VERSION` to `"v3"`. `buildCard` returns `checklist: text.checklist.map((t, i) => ({ id: String(i), text: t }))`. `placeholderText` returns three generic items: technician `["Check readings against spec", "Look for leaks, wear, or loose fasteners", "Log what you touched as a note"]`, operator `["Walk around and look for anything new", "Listen for new noises on start-up", "Tell maintenance about anything you noticed"]`.

- [ ] **Step 5: Verify.** `curl -s localhost:3200/api/components/car-brakes-lf/card?role=technician | jq .checklist` shows guide pins near the top.

- [ ] **Step 6: Commit.** `git commit -am "Card carries an LLM-written inspection checklist"`.

### Task 8: Checklist UI in both views, finish files a note

**Files:**
- Create: `src/components/checklist.tsx`
- Modify: `src/components/component-card.tsx` (under Next step; needs `id`, `role`, and a saved callback, so it is rendered from `component-card-loader.tsx` via a new `checklist` slot prop like `noteForm`)
- Modify: `src/components/component-card-loader.tsx` (pass `<Checklist ... onSaved={noteSaved} />`)
- Modify: `src/components/ar-view.tsx:1477-1486` (Next panel expanded body), with checked state and the save routine in the parent

**Interfaces:**
- Produces: `Checklist({ items, checked, onToggle, onFinish, saving, dark })`: a presentational list. `checked: Set<string>`; `onToggle(id)`; `onFinish()`; `dark` picks the glass styling for the live view.
- Produces: `checklistNoteText(items: ChecklistItem[], checked: Set<string>): string` in the same file:

```ts
export function checklistNoteText(items: ChecklistItem[], checked: Set<string>): string {
  const done = items.filter((i) => checked.has(i.id)).map((i) => i.text);
  const skipped = items.filter((i) => !checked.has(i.id)).map((i) => i.text);
  return `Inspection checklist completed. Checked: ${done.join("; ")}.${skipped.length ? ` Skipped: ${skipped.join("; ")}.` : ""}`;
}
```

- [ ] **Step 1: Component.** Rows are `<button type="button" role="checkbox" aria-checked>` at `min-h-12`, full width, a square mark on the left that fills yellow when checked, text struck through when checked. Below, a "Finish inspection" button, `disabled={checked.size === 0 || saving}` (Review Focus 5), text "Filing inspection…" while saving. `dark` swaps the light-page classes for `text-white` and `border-white/20` so it reads on the camera glass.

- [ ] **Step 2: Full card.** `component-card-loader.tsx` keeps `checked` in `useState(new Set<string>())`, resets it when `id` changes, and on finish posts `checklistNoteText(card.checklist, checked)` through the same fetch `NoteForm` uses (copy the body and status handling, no dialog), then calls `noteSaved(event)` and clears the set. `ComponentCard` renders the slot right after the Next step section.

- [ ] **Step 3: Live view.** `ar-view.tsx` keeps `checklist: Record<string, Set<string>>` keyed by part id. In the Next panel expanded body render `<Checklist dark items={card.checklist} ... />` with `onKeyDown`/`onClick` stop-propagation so taps do not collapse the panel. Finish reuses the existing voice-save path: set `voice` to `{ id, phase: "review", text: checklistNoteText(...) }` and call the save branch of `onVoice(id, "save")`, so the memory panel shows "Filed as inspection" and the card refetches with no new code path.

- [ ] **Step 4: Verify.** `npx tsc --noEmit && npm run lint`. Phone: expand Next step on the brake, tick two items, finish, see the inspection in the memory panel with the readings line. Full card: same flow at `/components/car-brakes-lf`. Reseed.

- [ ] **Step 5: Ship.** Commit, push, PR "Inspection checklist", merge, deploy, reseed. Update memory: readings reseed note.
