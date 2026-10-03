# API routes (owner: backend)

Route handlers only. Supabase and LLM code lives in `src/lib/server/` so
routes stay thin. Contract: `docs/api-contract.md`.

- `GET  /api/components` — all components
- `GET  /api/components/[id]/card?role=operator|technician` — `ComponentCard`, 404 on unknown id
- `POST /api/components/[id]/notes` — body `NewNoteRequest`, returns `NewNoteResponse` with 201;
  400 on empty text, 404 on unknown id

Errors are always JSON `{ error }`. The card, notes and list routes return 500
with that shape if the database fails. Notes are capped at 1,000 characters.
