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
- `card.ts` — `buildCard(id, role)` assembles a `ComponentCard`. LLM wording is cached by a hash of the history (memory + `card_cache` table), so it only changes when a note is added.
- `notes.ts` — `addNote(id, body)` structures and inserts a `MachineEvent`.
- `readings.ts` — simulated readings per component.
- `dashboard.ts` — `getDashboard()` assembles `DashboardData` for `/dashboard`.
- `tags.ts` — AprilTag assignment: `tagsOrFallback()`, `assignTag(id)`, `addComponent(body)`.
- `operator.ts` — `operatorGate(request)`: the shared `OPERATOR_PIN` check for deletes and new parts.

## Card prompt rules (llm.ts, card.ts)

- The model sees the last 40 events and the simulated readings; the API still
  returns the newest 10 events.
- Field text (notes, event summaries) is wrapped in `<history>` / `<note>` tags
  and declared data, so a note cannot give the model instructions.
- LLM calls time out after 12 s; the card then uses placeholder text and a note
  is filed as type `note` with its own text as the summary.
- `summary` and `next_step` are cut to the last full sentence under 280 chars.
- Changing the prompt or `readings.ts` regenerates wording. Bump
  `PROMPT_VERSION` in `card.ts` when the prompt changes.
