# API contract

The seam between frontend and backend. Types live in `src/lib/types.ts`.
Frontend can mock these shapes immediately; backend fills them in.

## `GET /api/components/[id]/card?role=operator|technician`

Returns a `ComponentCard`. The LLM writes `summary` and `next_step` from the
component's event history, worded for the role:

- **operator**: plain language, what to watch for, when to call someone
- **technician**: specifics, part names, last repair, what to check first

`readings` come from the `readings` table (seeded from `data/seed/readings.json`,
used directly when the table is missing) and change through notes and the chat.

Errors: `404` if the component id is unknown (bad QR scan).

## `POST /api/components/[id]/notes`

Body: `NewNoteRequest` (`{ text, author_role }`).

The LLM turns the raw spoken/typed text into a structured `MachineEvent`
(picks `type`, writes a one-line `summary`, keeps the raw text in `detail`),
inserts it, and returns `NewNoteResponse`.

The note text is also read for measurements against the part's current
readings: a stated value ("inner pad is at 3.5 mm") updates that reading.
The returned `event.readings` is the full list as it stood after the save,
and the card shows it under the event.

This is the write-back loop. The next `GET .../card` for this component must
reflect the new event and the new readings. That is the demo moment.

## `POST /api/components/[id]/chat`

Body: `ChatRequest` from `src/lib/chat.ts` (`{ messages, author_role }`, the
whole thread so far, oldest first, ending with the new user turn; at most 24
messages of 2000 characters).

The part assistant behind the mic button in the live view. The LLM answers
from the same history and readings the card uses, worded for the role, and
the response streams back as `text/plain` chunks (no JSON, no SSE framing):
read the body as it arrives and append. Nothing is stored; the client keeps
the thread.

Errors: `400` bad body, `404` unknown component, `503` when no LLM key is
set, `502` when the provider fails before the first byte.

## `GET /api/dashboard`

Returns `DashboardData`: all assets, components, the newest 200 events across
every part, simulated readings keyed by component id, and the operator-role
`next_step` per component (served from the card cache when warm). Used by the
operator dashboard at `/dashboard`. Never cached.

## `DELETE /api/events/[id]`

Header: `x-operator-pin` must equal the server's `OPERATOR_PIN` env var.
Removes that one event and returns `DeleteEventResponse` (`{ deleted }`).
Nothing else is touched; the card cache is keyed by history hash, so the next
card read for that part regenerates its summary and next step.

Errors: `503` when `OPERATOR_PIN` is not set (fails closed), `401` on a wrong
PIN, `404` for an unknown event id.

## `GET /api/components`

Lists all components across assets.

## `POST /api/components`

Header: `x-operator-pin`. Body: `NewComponentRequest` (`{ asset_id, name,
location }`). Creates the part (id is a slug of the name, de-duplicated),
assigns the next free AprilTag 36h11 id, and returns `NewComponentResponse`
(`{ component, tag }`). `404` unknown asset, `503` when the `tags` table is
missing or no PIN is configured.

## `GET /api/tags`

Returns `TagAssignment[]`: every AprilTag id bound to a component. The live
view loads this on start and falls back to `src/lib/markers.ts` if it fails.
Header `x-tags-source: table | fallback` says which one served it.

## `POST /api/tags`

Header: `x-operator-pin`. Body: `NewTagRequest` (`{ component_id }`). Binds the
smallest free 36h11 id to a part that has none. `409` if it already has one.

## `GET /labels?component=<id>`

Not an API, a print page: every tagged part's label, or one part's.

## Mocking before the backend exists

Frontend: until the routes land, put fixture JSON under
`src/components/__fixtures__/` matching `ComponentCard` and import it directly.
Swap to `fetch` once backend says the route is live.
