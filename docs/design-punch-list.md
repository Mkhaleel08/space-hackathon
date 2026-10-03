# Design punch list (mobile, pre-demo)

Reviewed live production at 390x844 (iPhone 14) in light and dark mode with a headless browser on Oct 3, ~04:20. All tap targets measured 44px or taller, no console errors on any page, both role toggles work. The problems are hierarchy and polish, not bugs, with one exception: the home page is unusable in dark mode. Items are ordered by what a judge sees in a 2-minute phone demo. Top 5 are marked DO FIRST. Vineeth owns every file listed.

1. **DO FIRST: Home page "Scan a part" button is invisible in dark mode**
   What's wrong: `bg-black` button on the `#0a0a0a` dark background, and the tagline is `text-neutral-600` with no dark variant (measured as unreadable gray on black). If the judge's phone is in dark mode the first screen of the demo is a title and nothing else (see `10-home-dark.png`).
   Fix: button `bg-black text-white dark:bg-white dark:text-black`, tagline `text-neutral-600 dark:text-neutral-300`. Same classes the scan page already uses.
   File: `src/app/page.tsx`

2. **DO FIRST: "Next step" is below the fold and quieter than the summary**
   What's wrong: the Next step box starts at y=665 on an 844px viewport, so with Safari chrome it is off-screen on first paint. Above it the summary is 20px (`text-xl`) and 7 lines long while the Next step body is 16px, so the thing that should shout is the quietest text on the card.
   Fix: move the Next step `<section>` directly under the `<header>`, before "What this part remembers". Make it the one strong block: `rounded-2xl border-2 border-amber-400 bg-amber-100 p-5 dark:border-amber-500 dark:bg-amber-950`, eyebrow `text-xs font-bold uppercase tracking-wider`, body `text-xl font-semibold leading-snug`. Drop the summary to `text-base leading-relaxed text-neutral-700 dark:text-neutral-300`.
   File: `src/components/component-card.tsx`

3. **DO FIRST: No status at a glance in the card header**
   What's wrong: the header is name, location, asset, hours. Nothing says ok/watch/alert until you scroll to the readings pills, and the amber "watch" pill uses the same amber as the Next step box so the two compete instead of one pointing at the other.
   Fix: derive `const worst = card.readings.some(r => r.status === "alert") ? "alert" : card.readings.some(r => r.status === "watch") ? "watch" : "ok"` and render a pill next to the h1: `inline-flex min-h-8 items-center rounded-full px-3 text-sm font-bold uppercase` using the existing `statusStyle[worst]`. Label it with a word a judge can read: "Watch closely" / "Needs attention" / "Running normal". Also color the asset block's `border-l-4` with the same status (`border-amber-400` etc.) so the header reads as a status card.
   File: `src/components/component-card.tsx`

4. **DO FIRST: Saving a note gives no visible payoff**
   What's wrong: the form sits at y=2266, the history list at y=1085. After "Save note" the only feedback is a 14px green line under the button; the new event appears 1,200px up where nobody is looking. The demo's whole promise is "add a note, it shows up".
   Fix: in `noteSaved`, after `setResult`, call `document.getElementById("events-heading")?.scrollIntoView({ behavior: "smooth", block: "start" })` and give the first timeline `<li>` a highlight when `event.id` matches the just-saved note (`bg-amber-50 dark:bg-amber-950/40 -mx-3 px-3 rounded-xl`). Keep the green status line, make it `text-base font-medium`.
   File: `src/components/component-card-loader.tsx` (scroll + highlight flag), `src/components/component-card.tsx` (render highlight)

5. **DO FIRST: Body font is Arial, not Geist**
   What's wrong: `layout.tsx` loads Geist and `@theme inline` maps `--font-sans` to it, but `body { font-family: Arial, Helvetica, sans-serif }` in globals.css overrides it. The whole app renders in Arial, which is the single biggest "default template" tell.
   Fix: change the body rule to `font-family: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;` (or delete the line and add `font-sans` to `<body>` in layout). One-line change, every screen improves.
   File: `src/app/globals.css`

6. **Loading state is a bare gray sentence for 2-3 seconds**
   What's wrong: the card API takes 2.0-2.7s (LLM call). During that time the page is the back link, the toggle, and "Loading this part's history…" in gray on white (see `05-hydpump-loading-light.png`). Every scan in the demo starts with this.
   Fix: replace the `<p role="status">` with a skeleton that matches the card shape: three `animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800` blocks (h-8 w-2/3 for the title, h-24 for the summary, h-28 rounded-2xl bg-amber-100/60 for the Next step box) plus the status sentence kept for screen readers (`sr-only`). Takes 15 minutes and makes the wait feel intentional.
   File: `src/components/component-card-loader.tsx`

7. **Dead space between the role toggle and the card title**
   What's wrong: toggle bottom is at y=150, the "OPERATOR VIEW" eyebrow starts at y=222. That 72px gap comes from `main gap-6` + the always-rendered `min-h-6` aria-live div + the eyebrow's own margin. The eyebrow also repeats what the toggle already shows.
   Fix: render the aria-live div only when `refreshing || refreshError` (or make it `min-h-0`), and delete the "{role} view" eyebrow `<p>`. The toggle is the role label.
   File: `src/components/component-card-loader.tsx` (div), `src/components/component-card.tsx` (eyebrow)

8. **Timeline dates read like database output**
   What's wrong: "Sep 28, 2026, 7:05 AM UTC" on every entry. The time-of-day and "UTC" are noise for a 5-item history; the date alone tells the story (and the operator cares about hours-since, not minutes).
   Fix: `dateFormat` becomes `{ month: "short", day: "numeric", year: "numeric" }` with no timeZone/hour/minute, drop the ` UTC` suffix, keep the full ISO on `dateTime=`. Put the date on the same line as the type label (`flex justify-between`) so each entry is two lines shorter.
   File: `src/components/component-card.tsx`

9. **Timeline type labels are tiny, gray and identical for faults and routine checks**
   What's wrong: `text-xs uppercase text-neutral-600` for "FAULT · OPERATOR" and "INSPECTION · TECHNICIAN" alike. A judge scanning the history can't tell the oil leak from the daily walkaround; the bullet dots are all `bg-neutral-500`.
   Fix: a small `typeStyle: Record<EventType, string>` map: fault `text-red-700 before:bg-red-500 dark:text-red-300`, repair `text-green-700 before:bg-green-500 dark:text-green-300`, inspection `text-neutral-600 before:bg-neutral-400`, note `text-sky-700 before:bg-sky-500 dark:text-sky-300`. Bump the label to `text-sm font-semibold` and drop uppercase; render the role as a lighter suffix.
   File: `src/components/component-card.tsx`

10. **Readings pills are cramped at 109px wide and values don't pop**
    What's wrong: `grid-cols-3` on a 342px column gives 109px pills; "Case drain flow" wraps to two lines, and the value is `font-mono text-sm`, smaller than the label. The status word ("OK") is repeated as 12px bold text under every value.
    Fix: value `text-lg font-semibold tabular-nums` (keep `font-mono` if you want, it is Geist Mono once item 5 lands), label `text-xs text-current/70 leading-tight`, status word only when not "ok" (ok pills already read as green). If three still feel tight use `grid-cols-2` with the first reading `col-span-2`.
    File: `src/components/component-card.tsx`

11. **Dictate is the demo moment but looks like a secondary button**
    What's wrong: voice is the "wow" in the note flow, yet "Dictate note" is an outlined pill with no icon, followed by a permanent "Review dictated text before saving." helper that takes a line even before anyone taps. The textarea is 182px tall so Save is pushed another screen down.
    Fix: give Dictate a mic glyph and make it the visually primary action of the form when the textarea is empty (`bg-black text-white dark:bg-white dark:text-black`), with Save turning primary once `text.trim()` is non-empty. Show the helper only while `listening`. Textarea `rows={4} min-h-28`. Rename the section heading to "Add a note" to match the demo script.
    File: `src/components/note-form.tsx`

12. **Everything is neutral gray with black pills: default-template look**
    What's wrong: no accent color anywhere except the amber alert box; buttons, borders, toggles and timeline are all `neutral-*`. It reads as the Next.js starter with content pasted in.
    Fix: pick one industrial accent and use it in exactly three places: `:root { --accent: #d97706 }` (amber-600, matches the Next step box) in globals.css, the home h1 word "Memory" (`text-amber-600`), and the active role toggle (`bg-amber-600 text-white` instead of black). Do not touch anything else; three touches is enough to feel designed.
    File: `src/app/globals.css`, `src/app/page.tsx`, `src/components/role-card.tsx`

13. **"Simulated for this demo" sits at heading level**
    What's wrong: the disclaimer is right-aligned beside the "Readings" h2 in 14px, so it is the second thing you read in that section and it undercuts the live-readings story on camera.
    Fix: move it below the pills as `text-xs text-neutral-500 mt-2` ("Readings simulated for this demo"). Keep it; just stop giving it headline placement.
    File: `src/components/component-card.tsx`

14. **Unknown-part page shows the role toggle and a half-width button**
    What's wrong: `/components/nope` renders the Operator/Technician toggle above "Unknown part" (there is nothing to view as either role) and "Scan again" is `w-fit`, while every other primary button on the card pages is full width.
    Fix: in `role-card.tsx` hide the toggle group when the loader reports missing/error (lift a `cardState` callback, or simply render the toggle inside the loader's ready branch). Make "Scan again" `flex w-full justify-center`.
    File: `src/components/role-card.tsx`, `src/components/component-card-loader.tsx`

Skip for the demo: scan page is fine in both modes (camera box, status text and the four part rows all read well, see `02-scan-light.png` / `11-scan-dark.png`); the home page in light mode is fine; the note form's dark mode is fine.

## Screenshots

All at 390x844, 2x. Paths:

- `/private/tmp/claude-501/-Users-mehran-Documents-space-hackathon/e4f66ff6-4b51-4e61-b582-94052c89cfe9/scratchpad/design-review/01-home-light.png`
- `/private/tmp/claude-501/-Users-mehran-Documents-space-hackathon/e4f66ff6-4b51-4e61-b582-94052c89cfe9/scratchpad/design-review/10-home-dark.png` (item 1)
- `/private/tmp/claude-501/-Users-mehran-Documents-space-hackathon/e4f66ff6-4b51-4e61-b582-94052c89cfe9/scratchpad/design-review/02-scan-light.png`
- `/private/tmp/claude-501/-Users-mehran-Documents-space-hackathon/e4f66ff6-4b51-4e61-b582-94052c89cfe9/scratchpad/design-review/11-scan-dark.png`
- `/private/tmp/claude-501/-Users-mehran-Documents-space-hackathon/e4f66ff6-4b51-4e61-b582-94052c89cfe9/scratchpad/design-review/03-hydpump-operator-viewport-light.png` (item 2, first paint)
- `/private/tmp/claude-501/-Users-mehran-Documents-space-hackathon/e4f66ff6-4b51-4e61-b582-94052c89cfe9/scratchpad/design-review/03-hydpump-operator-full-light.png`
- `/private/tmp/claude-501/-Users-mehran-Documents-space-hackathon/e4f66ff6-4b51-4e61-b582-94052c89cfe9/scratchpad/design-review/04-hydpump-technician-viewport-light.png`
- `/private/tmp/claude-501/-Users-mehran-Documents-space-hackathon/e4f66ff6-4b51-4e61-b582-94052c89cfe9/scratchpad/design-review/04-hydpump-technician-full-light.png`
- `/private/tmp/claude-501/-Users-mehran-Documents-space-hackathon/e4f66ff6-4b51-4e61-b582-94052c89cfe9/scratchpad/design-review/05-hydpump-loading-light.png` (item 6)
- `/private/tmp/claude-501/-Users-mehran-Documents-space-hackathon/e4f66ff6-4b51-4e61-b582-94052c89cfe9/scratchpad/design-review/06-hydpump-viewport-dark.png`
- `/private/tmp/claude-501/-Users-mehran-Documents-space-hackathon/e4f66ff6-4b51-4e61-b582-94052c89cfe9/scratchpad/design-review/06-hydpump-full-dark.png`
- `/private/tmp/claude-501/-Users-mehran-Documents-space-hackathon/e4f66ff6-4b51-4e61-b582-94052c89cfe9/scratchpad/design-review/07-noteform-light.png` (item 11)
- `/private/tmp/claude-501/-Users-mehran-Documents-space-hackathon/e4f66ff6-4b51-4e61-b582-94052c89cfe9/scratchpad/design-review/07-noteform-dark.png`
- `/private/tmp/claude-501/-Users-mehran-Documents-space-hackathon/e4f66ff6-4b51-4e61-b582-94052c89cfe9/scratchpad/design-review/08-trackleft-viewport-light.png`
- `/private/tmp/claude-501/-Users-mehran-Documents-space-hackathon/e4f66ff6-4b51-4e61-b582-94052c89cfe9/scratchpad/design-review/08-trackleft-full-light.png`
- `/private/tmp/claude-501/-Users-mehran-Documents-space-hackathon/e4f66ff6-4b51-4e61-b582-94052c89cfe9/scratchpad/design-review/09-unknown-part-light.png` (item 14)
