# Machine Memory

> A first-week technician can inspect a machine like a 20-year veteran, because the machine remembers.

Hack to the Future, Krasan prompt + Caterpillar track. Phone web app: point the
camera at an AprilTag on a component, get a card with that part's history, live
readings, and next step. Leave a spoken note, and the next person who points at
it sees it. The write-back loop is the demo.

Full plan: [`docs/game-plan.md`](docs/game-plan.md). Locked decisions:
[`docs/decisions.md`](docs/decisions.md). Frontend/backend seam:
[`docs/api-contract.md`](docs/api-contract.md). New teammate? Paste your role's prompt from
[`docs/teammate-prompts.md`](docs/teammate-prompts.md) into Claude Code.

## Stack

Next.js 16 (App Router) on Vercel · Supabase Postgres · AprilTag markers via
`js-aruco2` · Anthropic API · browser
speech recognition with typed fallback.

## Who owns what

| Person | Role | Folders |
|---|---|---|
| Vineeth | frontend | `src/app/` pages, `src/components/`, `src/hooks/` |
| Neeraj | backend | `src/app/api/`, `src/lib/server/`, `supabase/` |
| Mehran | product | `data/seed/`, `scripts/`, `docs/`, `public/tags/`, Devpost, pitch, phone testing, frontend overflow |

**Shared, announce before editing:** `src/lib/types.ts`, `docs/api-contract.md`, `package.json`.

## Workflow

- `main` is always demo-able. If it's broken, fixing it is everyone's top priority.
- Short branches named `yourname/feature`. Merge small and often. Pull before you push.
- Stay in your folders. If you need something in someone else's, ask them in chat first.
- No API keys in the repo, ever. `.env.local` is gitignored. If a key leaks, rotate it.
- Feature freeze Saturday 5:00 AM. Nothing new after that.

### Deploys go through Mehran

Vercel is on the Hobby plan, which only lets one person on the team and only
builds commits authored by that person. So:

- **Previews:** push your branch, then ping Mehran in chat. Mehran checks it
  out and runs `vercel`, and sends back the preview URL.
- **Production:** open a PR. Mehran merges it with **"Create a merge commit"**
  (not squash), which redeploys `https://space-hackathon-ten.vercel.app`.
- Your own pushes to `main` will not redeploy, so don't push to `main` directly.

## Run it

```bash
npm install
cp .env.example .env.local   # fill in Supabase + LLM keys
npm run dev                  # http://localhost:3000
```

Camera access needs HTTPS on a phone, so test on a Vercel preview URL (ask
Mehran, see below) or on production rather than localhost.

Database: the schema is already applied and seeded on the shared Supabase
project. Get the three Supabase values for `.env.local` from Mehran. Need to
reset it? `npm run seed` wipes and reloads the demo data (needs the service
role key). **Run `npm run seed` before every demo.**

## Labels

Print `/tags/print.html` (AprilTags, matte paper) and tape one on each part.
AprilTags are the only labels; the live view at `/ar` reads them.

## Milestones

1. Camera opens on a real phone from the deployed URL
2. Pointing at a tag shows a hardcoded card
3. Card pulls real rows from Supabase
4. Write-back: add a note, point again, see it appear
5. Role toggle changes the card wording
6. Checklist crosses itself off (cut if behind)
