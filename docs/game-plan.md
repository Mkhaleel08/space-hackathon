# Hack to the Future: Game Plan

**Tracks:** Krasan general prompt + Caterpillar Cat Track
**Team:** 3 people
**Real build deadline:** Saturday 9:00 AM (feature-complete)
**Submission deadline:** Saturday 5:15 PM CDT, hard. Aim to submit by 4:45 PM.

---

## 1. The idea, sharpened

**One-line pitch:** A first-week technician can inspect a machine like a 20-year veteran, because the machine remembers.

**Target user (pick one, don't broaden):** A new technician or small-contractor operator doing an inspection or first diagnosis.

**Barrier:** Informational. The knowledge of what's normal for this machine, what failed before, and what the last person did lives in a veteran's head or in siloed systems.

**What we build:** A phone web app. Point the camera at a component, and a card shows that part's history, live readings, and next step. When the tech finishes, they leave a spoken note that gets saved to the machine's memory, and the next person sees it.

### Three fixes to the original concept

1. **Narrow the user.** The original named three audiences. The Krasan prompt wants one clearly defined audience and one specific obstacle.
2. **Build the memory, not just the viewer.** The Cat prompt is about the memory layer. AR is only one optional interface. The write-back loop (note saved, next scan shows it, recommendation changes) proves persistent memory, self-improvement, and human plus agent collaboration in about 20 seconds of demo.
3. **Skip true AR.** Precise 3D overlay is too risky for this timeline. Use a phone camera, QR codes on components, and pinned cards. The HackMIT winner (Ebby) won on context and memory, not AR rendering.

### Scope (do not expand)

- One machine
- One scenario (example: hydraulic leak found during a daily walkaround)
- 3 to 4 component hotspots
- Two role views: operator and technician
- The write-back loop
- Inspection checklist that crosses itself off (second tier, cut if behind)
- Synthetic but realistic data, stated plainly as simulated in the pitch

### How it maps to the Cat prompt

| Cat requirement | Our feature |
|---|---|
| Persistent machine memory | Per-component event timeline in the database |
| Personalized intelligence | Operator vs. technician card wording |
| Self-improving systems | Write-back notes change future recommendations |
| Human + agent collaboration | LLM turns spoken notes into structured events and summarizes history |
| Novel interfaces | Camera-based, point-at-the-part cards plus voice |

---

## 2. Setup

### Repo and workflow

- [ ] One person creates a single public repo and adds the other two as collaborators
- [ ] Add `.env.local` to `.gitignore` before the first commit. No API keys in the repo, ever.
- [ ] `main` is always demo-able
- [ ] Short branches (`name/feature`), merge small and often, pull before you push
- [ ] Split ownership by folder to avoid merge conflicts

### Stack

- **Next.js on Vercel.** Every push to `main` auto-deploys. Free HTTPS, which phone browsers require for camera access. API routes keep keys on the server.
- **Supabase (hosted Postgres)** for the machine memory. Tables: `assets`, `components`, `events` (type: fault, repair, inspection, note; plus timestamp and author role).
- **QR codes** for part recognition, using a library like `html5-qrcode`. Each code maps to a component ID.
- **LLM API** for two jobs: summarize a component's history into a role-specific card, and turn a spoken note into a structured event. Ask about OpenAI credits.
- **Voice notes.** Browser speech recognition works in Chrome but is flaky on iPhone Safari. Test on the demo phone early. Fallback: record audio and send it to a transcription API.

### Outside the code

- [ ] Shared Google Doc: locked decisions, interview notes and quotes, tradeoffs, metrics, Devpost answers
- [ ] Devpost draft started, all teammates added, CAT track box checked
- [ ] Seed script that resets the database to a known demo state
- [ ] Prop: large printed photo or diagram of a Cat machine with QR codes taped on components. Swap in a scale model if someone can get one in the morning.

---

## 3. Roles

| Person | Owns |
|---|---|
| **A, frontend** | Camera, QR scanning, cards, checklist, role toggle |
| **B, backend** | Supabase schema, API routes, LLM calls, voice note to structured event |
| **C, product** | Scenario and seed data, prop, research outreach, Devpost and pitch, testing on the demo phone, frontend overflow |

---

## 4. Overnight schedule (Friday 9 PM to Saturday 9 AM)

| Time | Goal | Details |
|---|---|---|
| 9:00 to 9:30 | Lock decisions | One user, one machine, one scenario, the stack. Written at the top of the shared doc. No reopening after 9:30. |
| 9:30 to 11:00 | Skeleton | A: camera open on a real phone via the Vercel URL, then QR scan to a hardcoded card. B: tables and API routes. C: fake machine history (15 to 20 events across 4 components) and research outreach sent. |
| 11:00 to 1:00 | Real data | Cards pull from Supabase. LLM writes a short card per component, worded differently for operator vs. technician. |
| 1:00 to 3:00 | Write-back loop | Speak or type a note, it's saved as an event, rescan, card and recommendation change. This is the key demo moment. |
| 3:00 to 5:00 | Second tier | Self-crossing inspection checklist, visual polish. Cut whatever isn't working by 5:00. |
| **5:00** | **Feature freeze** | Nothing new after this. |
| 5:00 to 7:00 | Hardening | Bug fixes, seed reset script, run the full demo five times on the demo phone. |
| 7:00 to 9:00 | Insurance | Rough backup video of the working demo, Devpost answers drafted, pitch outlined. |

**Sleep:** Stagger one 90-minute nap each during the 5:00 to 9:00 block. The live pitch could be as late as 7 PM Saturday, and the pitch is a judging criterion.

### Build milestones in order

- [ ] 1. Camera opens on a real phone from the deployed URL
- [ ] 2. Scanning a QR code shows a hardcoded card
- [ ] 3. Card pulls real rows from Supabase
- [ ] 4. Write-back: add a note, rescan, see it appear
- [ ] 5. Role toggle changes the card wording
- [ ] 6. Checklist crosses itself off

---

## 5. Research (required deliverable)

**Tonight:**
- [ ] Text anyone who has worked on equipment (ag, construction management, facilities, family)
- [ ] Post a short question on forums where mechanics and operators hang out, so replies are waiting in the morning

**Saturday:**
- [ ] 9:00 to 10:00 sponsor and judge 1:1s
- [ ] Caterpillar reps at the 1:15 talk and the 3:00 to 5:00 tables

**Questions to ask:**
- How does a new tech actually learn a specific machine?
- Where does service history live today, and who can see it?
- What gets missed on inspections, and why?
- What does a veteran know about a machine that isn't written down anywhere?

Three short conversations with real quotes is enough.

---

## 6. Tradeoffs and metrics (required deliverable)

**Tradeoffs to present:**
- Phone vs. headset: phone is what crews already carry
- QR markers vs. markerless recognition: reliability over wow factor
- Simulated vs. real telematics: no data access in a weekend, schema is built to accept real feeds

**Success metrics:**
- Inspection time
- Missed-step rate
- First-time fix rate
- Share of repairs that leave a note behind

---

## 7. Saturday schedule

| Time | What |
|---|---|
| 9:00 to 10:00 | 1:1 slots for research quotes |
| 10:00 to 10:45 | Brunch + Littlebird demo (event point) |
| 11:00 to 11:50 | Krasan workshop (event point) |
| 11:50 to 12:25 | Krasan workshop 2: 1:1 building and judging (event point) |
| 12:25 to 1:10 | Colosseum talk + lunch (event point) |
| 1:15 to 2:15 | Life at Caterpillar talk (event point, also research) |
| 2:15 to 3:00 | CAT Track 45 min sprint. Ask an organizer what this involves. |
| 3:00 to 4:00 | Final video recorded, Devpost writeup finished |
| 4:00 to 4:45 | Submit. Buffer for upload problems. |
| 5:15 | Hard deadline |
| 5:15 to 6:15 | Judging in parallel rooms |
| 7:00 to 7:40 | Closing ceremony, top 5 live pitches |

---

## 8. Submission checklist

- [ ] Each of the 3 team members has at least 3 event check-ins (code is given at the end of each event, form closes 5 minutes after)
- [ ] Devpost submission, written using their questions:
  - [ ] What did you build and how does it address the prompt? (target user, pain points, solution)
  - [ ] How did you build it? (tools, issues, how you overcame them)
  - [ ] How can you implement this further?
  - [ ] How does your project relate back to the Caterpillar prompt?
- [ ] Caterpillar Track selected on Devpost
- [ ] CAT track opt-in form filled out
- [ ] 2-minute demo video attached
- [ ] Seed script run so the live demo starts from a clean state
- [ ] Demo phone charged, backup video on a laptop
