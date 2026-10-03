# Server-only code (owner: backend)

Never imported from client components. Holds the service-role Supabase client
and LLM calls, so keys stay on the server.

- `supabase.ts` — `createClient` with `SUPABASE_SERVICE_ROLE_KEY`
- `llm.ts` — `writeCard(events, role)` and `structureNote(text, role)`
