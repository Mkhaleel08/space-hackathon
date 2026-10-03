# Locked decisions

Written at the 9:00 PM lock. **No reopening after 9:30 PM.** If you want to
change one of these, the answer is no until after submission.

| Decision | Choice |
|---|---|
| Target user | New technician / small-contractor operator doing an inspection or first diagnosis |
| Machine | Cat 320 GC excavator, unit #4471, 6,240 hours (`data/seed/assets.json`) |
| Scenario | Hydraulic leak at the main pump. Seal was replaced in June; an operator walkaround on Sept 28 spotted a film coming back. The tank breather flagged in May was never checked. The card should lead the tech there. |
| Components (3 to 4) | `hyd-pump` main hydraulic pump (the story), `boom-cyl` boom cylinder, `engine-air` engine air filter, `track-left` left track and final drive |
| Roles | operator, technician |
| LLM provider | Neeraj picks tonight based on credits. `src/lib/server/llm.ts` supports both; Anthropic wins if both keys are set. Key goes in `.env.local` and Mehran adds it to Vercel. |
| Voice input | Browser speech recognition first; fall back to typed input, not a transcription API, if Safari fights us |
| AR | No. Phone camera + QR codes + pinned cards. |

## Cut list (in order, if behind schedule)

1. Inspection checklist
2. Visual polish
3. Voice (fall back to typed notes)

## Tradeoffs to present

- Phone vs. headset: phone is what crews already carry
- QR markers vs. markerless recognition: reliability over wow factor
- Simulated vs. real telematics: no data access in a weekend; schema accepts real feeds

## Addendum, Oct 2 11:45 PM (Mehran)

Live view (`/ar`) added on top of the QR flow: the camera stays open and the
part's card pins itself to the detected code with a leader line. It is still
QR-anchored. No markerless recognition, no WebXR. The AR row above stands as
written; this is the "pinned cards" half of it, done over live video instead
of on a separate page. (The plain scanner at `/scan` was removed Oct 3 3 PM;
see the addendum below.)

## Addendum, Oct 3 1:40 AM (Mehran, agreed with the team)

Live view markers switch from QR codes to **AprilTags (36h11)**. Same live view,
same plane math; the detector reads tags at steep angles and small sizes where
QR failed, and a tag carries only a number, so the lookup is in
`src/lib/markers.ts`. The camera opens on page load and every panel is a tap
target that expands in place, so there are no buttons off the camera view.
QR labels still work through a fallback decoder. Still no markerless
recognition, no hand gestures, no WebXR. Print tags on matte paper.

## Addendum, Oct 3 5:00 AM (Mehran, agreed with the team)

Scope reopened for one thing after the freeze: an **operator dashboard** at
`/dashboard`, built on the existing data and style, in three PRs so `main`
stays demo-able after each. (1) Overview of every asset and part with status
from the worst reading, next step, and a recent-activity feed. (2) Delete a
worker note, gated by a shared `OPERATOR_PIN` env var checked on the server,
because the app has no accounts; this is the honest gap, not a login system.
(3) AprilTag manager: add a part, get the next free 36h11 id, print the label;
the tag map moves to a `tags` table with `src/lib/markers.ts` as fallback.
Still no AR beyond the pinned live view, no markerless recognition.

## Addendum, Oct 3 10:40 AM (Mehran)

The live demo car is a **BMW M3**, seeded as asset `bmw-m3` with five parts a
judge can see from outside or with the hood open: left front brake (the story:
uneven inner-pad wear traced to dry caliper guide pins in 2025, and the cold
squeal is back), left front tire, engine oil, engine air filter, 12V battery.
AprilTags 10-14, page 1 of `/tags/print.html`. The Cat 320 stays in the data
for the pitch and video but is not the live demo.

## Addendum, Oct 3 12:45 PM (Mehran)

One last feature: a **part assistant** in the live view. A yellow mic button
sits beside the open card; tapping it opens a chat drawer (side drawer in
landscape, bottom sheet in portrait) where the tech asks about possible
fixes, what to change, and concerns with the part. Voice in, streamed text
out, read aloud when the question was spoken. It is grounded in the same
history and readings as the card through `POST /api/components/[id]/chat`.
Nothing is stored. Still no AR beyond the pinned live view.

## Addendum, Oct 3 3:00 PM (Mehran)

The separate QR scanner page (`/scan`) and its "Scan a part" nav entry are
gone. Live view is the only camera path. Printed QR labels still work: the
phone's native camera opens `/c/[id]`, which redirects to the part page.
Fallback links that pointed at `/scan` now go to the dashboard or live view.
