# Prompts for your Claude Code session

Clone the repo, `cd` into it, run `claude`, and paste the prompt for your role.
`CLAUDE.md` in the repo root loads automatically and carries the team rules;
these prompts add your specific context and first tasks.

Before pasting: `npm install`, then `cp .env.example .env.local` and fill in
the Supabase keys (ask in chat for them). Never commit `.env.local`.

---

## Neeraj (backend)

```
I'm Neeraj, the backend owner on a 3-person overnight hackathon team. Read
README.md, docs/game-plan.md, docs/decisions.md and docs/api-contract.md
before doing anything. The shared type contract is src/lib/types.ts; don't
change it without telling me so I can clear it with the frontend.

I own src/app/api/, src/lib/server/, and supabase/. Don't edit files outside
those folders unless I say so.

Stack: Next.js 16 App Router (read node_modules/next/dist/docs/ for the
current API, it differs from your training data), Supabase via
@supabase/supabase-js with the service-role key server-side only, and an LLM
API (provider in .env.local).

My milestones, in order:
1. src/lib/server/supabase.ts: service-role client from env vars.
2. GET /api/components/[id]/card?role=operator|technician returning a
   ComponentCard. Start with a hardcoded summary/next_step so the frontend
   can integrate, then wire the LLM to write them from the event history,
   worded differently per role.
3. POST /api/components/[id]/notes: take raw note text, have the LLM turn it
   into a structured MachineEvent (pick type, write summary, keep raw text in
   detail), insert it, return it. The next GET card must reflect it. This is
   the demo moment.
4. GET /api/components listing all components (for the checklist, second tier).

Keep route handlers thin, put logic in src/lib/server/. No tests unless I ask.
Feature freeze is Saturday 5:00 AM. Work on a branch named neeraj/<feature>,
small commits, merge to main often. main must always build.

Start with milestone 1 and 2 (hardcoded version). Tell me when the card
route returns something so I can ping the frontend.
```

---

## Vineeth (frontend)

```
I'm Vineeth, the frontend owner on a 3-person overnight hackathon team. Read
README.md, docs/game-plan.md, docs/decisions.md and docs/api-contract.md
before doing anything. The shared type contract is src/lib/types.ts; don't
change it without telling me so I can clear it with the backend.

I own src/app/ pages (not src/app/api/), src/components/, and src/hooks/.
Don't edit files outside those folders unless I say so.

Stack: Next.js 16 App Router (read node_modules/next/dist/docs/ for the
current API, it differs from your training data), Tailwind v4, html5-qrcode
for scanning. Everything runs on a phone over HTTPS from the Vercel preview
URL; camera access won't work from localhost on a phone. Mobile-first, big
tap targets, no hover-only UI.

My milestones, in order:
1. /scan opens the rear camera on a real phone from the deployed URL.
2. Scanning a QR code (payload is a component id like "hyd-pump") shows a
   card. Until the backend route exists, render from fixture JSON in
   src/components/__fixtures__/ shaped like ComponentCard.
3. Swap the fixture for fetch('/api/components/[id]/card?role=...') once
   backend says it's live.
4. Note input: speech recognition where the browser supports it (test on
   iPhone Safari early, fall back to a text field), POST to
   /api/components/[id]/notes, then rescan and show the updated card.
5. Role toggle (operator / technician) that changes which card is fetched.
6. Inspection checklist that crosses off components as they're scanned.
   Second tier, cut if we're behind.

No tests unless I ask. Feature freeze is Saturday 5:00 AM. Work on a branch
named vineeth/<feature>, small commits, merge to main often. main must
always build.

Start with milestone 1. Push to a branch so I get a Vercel preview URL to
test the camera on my phone.
```

---

## Shared rules both prompts assume

- `main` is always demo-able.
- Branches: `yourname/feature`. Pull before push.
- No API keys in the repo. `.env.local` only.
- Scope is locked in `docs/decisions.md`. If Claude suggests a feature not in
  the milestone list, say no.
