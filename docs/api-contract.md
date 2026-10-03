# API contract

The seam between frontend and backend. Types live in `src/lib/types.ts`.
Frontend can mock these shapes immediately; backend fills them in.

## `GET /api/components/[id]/card?role=operator|technician`

Returns a `ComponentCard`. The LLM writes `summary` and `next_step` from the
component's event history, worded for the role:

- **operator**: plain language, what to watch for, when to call someone
- **technician**: specifics, part names, last repair, what to check first

`readings` are simulated and can be hardcoded per component for the demo.

Errors: `404` if the component id is unknown (bad QR scan).

## `POST /api/components/[id]/notes`

Body: `NewNoteRequest` (`{ text, author_role }`).

The LLM turns the raw spoken/typed text into a structured `MachineEvent`
(picks `type`, writes a one-line `summary`, keeps the raw text in `detail`),
inserts it, and returns `NewNoteResponse`.

This is the write-back loop. The next `GET .../card` for this component must
reflect the new event. That is the demo moment.

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
