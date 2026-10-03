@AGENTS.md

# Team rules for AI assistants

Three people, one night, one repo. Read `README.md` for ownership and
`docs/api-contract.md` for the frontend/backend seam before writing code.

- Stay in the folders your human owns (see the table in `README.md`). Do not
  edit another person's folder without being told they agreed.
- `src/lib/types.ts` is the shared contract. Propose changes, don't silently
  make them.
- Never write a real key into any file. Only `.env.local`, which is gitignored.
- Scope is locked in `docs/decisions.md`. Don't add features that aren't in
  the milestone list. If asked to, point at the cut list.
- Everything must work on a phone over HTTPS. Mobile-first layouts, big tap
  targets, no hover-only interactions.
- Keep it simple. This is a 12-hour build, not a product. No abstractions for
  one call site, no tests unless the human asks.
