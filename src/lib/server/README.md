# Server-only code (owner: backend)

Never imported from client components. Holds the service-role Supabase client
and LLM calls, so keys stay on the server.

- `supabase.ts` — lazy service-role client from `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- `data.ts` — reads/writes for assets, components, events. Falls back to
  `data/seed/*.json` plus an in-memory list when Supabase keys are not set.
- `llm.ts` — `writeCard(component, asset, events, role)` and
  `structureNote(text, role, component)`. Uses Anthropic if `ANTHROPIC_API_KEY`
  is set, else OpenAI if `OPENAI_API_KEY` is set, else returns a fallback.
  Override the model with `LLM_MODEL`.
- `card.ts` — `buildCard(id, role)` assembles a `ComponentCard`.
- `notes.ts` — `addNote(id, body)` structures and inserts a `MachineEvent`.
- `readings.ts` — simulated readings per component.
