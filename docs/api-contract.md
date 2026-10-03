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

## `GET /api/components`

Lists all components for the one asset. Used by the checklist (second tier).

## Mocking before the backend exists

Frontend: until the routes land, put fixture JSON under
`src/components/__fixtures__/` matching `ComponentCard` and import it directly.
Swap to `fetch` once backend says the route is live.
