---
name: Machine Memory
description: A field tool that reads like a service manual page. Rules, not cards; one yellow action per page.
colors:
  background: "#ffffff"
  background-dark: "#000000"
  foreground: "#000000"
  foreground-dark: "#ededed"
  muted: "#5a5a5a"
  muted-dark: "#a1a1a1"
  line: "#eaeaea"
  line-dark: "#262626"
  surface: "#f6f6f6"
  surface-dark: "#141414"
  accent: "#ffcd11"
  accent-ink: "#000000"
  accent-hover: "#f0bf0a"
  accent-active: "#e3b400"
  ok: "#1f7a3d"
  ok-dark: "#5dc27a"
  watch: "#9a5b00"
  watch-dark: "#d98b2b"
  alert: "#b42318"
  alert-dark: "#f97066"
typography:
  page-title:
    fontFamily: "Barlow Semi Condensed, Barlow, ui-sans-serif, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  part-name:
    fontFamily: "Barlow Semi Condensed, Barlow, ui-sans-serif, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  next-step:
    fontFamily: "Barlow Semi Condensed, Barlow, ui-sans-serif, sans-serif"
    fontSize: "1.625rem"
    fontWeight: 600
    lineHeight: 1.2
  next-step-wide:
    fontFamily: "Barlow Semi Condensed, Barlow, ui-sans-serif, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
  memory-line:
    fontFamily: "Barlow Semi Condensed, Barlow, ui-sans-serif, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 500
    lineHeight: 1.375
  home-title:
    fontFamily: "Barlow Semi Condensed, Barlow, ui-sans-serif, sans-serif"
    fontSize: "2.75rem"
    fontWeight: 600
    lineHeight: 1
  home-title-wide:
    fontFamily: "Barlow Semi Condensed, Barlow, ui-sans-serif, sans-serif"
    fontSize: "3.25rem"
    fontWeight: 600
    lineHeight: 1
  section-heading:
    fontFamily: "Barlow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "Barlow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  meta:
    fontFamily: "Barlow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  reading-value:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "1rem"
    fontWeight: 500
    fontVariation: "tabular-nums"
rounded:
  ctl: "4px"
  segment: "2px"
  dot: "9999px"
spacing:
  inline: "8px"
  stack: "12px"
  row: "16px"
  gutter: "24px"
  section-top: "32px"
  section-gap: "48px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.ctl}"
    padding: "0 20px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-primary-active:
    backgroundColor: "{colors.accent-active}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.ctl}"
    padding: "0 20px"
    height: "48px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.ctl}"
    padding: "0 20px"
    height: "48px"
  button-danger:
    backgroundColor: "{colors.alert}"
    textColor: "#ffffff"
    rounded: "{rounded.ctl}"
    padding: "0 20px"
    height: "48px"
  button-small:
    padding: "0 14px"
    height: "40px"
  field:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.ctl}"
    padding: "0 12px"
    height: "48px"
  filter-chip-on:
    backgroundColor: "{colors.foreground}"
    textColor: "{colors.background}"
    rounded: "{rounded.ctl}"
    padding: "0 12px"
    height: "40px"
---

# Design System: Machine Memory

Tokens live in `src/app/globals.css`; control classes in `src/components/ui.ts`; icons in `src/components/icons.tsx`; the status mark in `src/components/status-mark.tsx`. Use those; do not restyle by hand.

## Overview

**Creative North Star: "The Service Manual Page"**

One neutral ground, 1px rules to divide it, one yellow thing to press. Content is set in Barlow, the DIN-derived face of signage and machine nameplates, with the semi-condensed cut on the part name and the next step; the hierarchy is carried by size and weight, not by boxes, tints or shadows. Ink is black, not a tinted near-black. Every screen is a column of ruled sections; status is a coloured dot and a word, never a fill. Both colour schemes come free from `prefers-color-scheme`; nothing is hard-coded except Cat yellow.

**Key Characteristics:** hairline rules, not cards; yellow once per page; dot + word status; 4px corners; 44px+ tap targets; drawn 20-grid stroke icons; flat everywhere except the camera.

## Colors

Neutrals do the work; yellow is a signal, status hues are text only. Every token flips automatically in dark mode (the `-dark` keys above).

### Primary
- **Cat Yellow** (`accent`, ink `accent-ink`): primary button fill, active role-toggle segment, the pulsing "Listening" dot, the "Just saved" flag, the small square before "Next step", text selection. Hover/active darken one step (`accent-hover`, `accent-active`).

### Neutral
- **Ground** (`background`) and **Ink** (`foreground`): page and text. Ink is also the focus ring, the secondary button border, and the filled state of filter chips.
- **Muted** (`muted`): meta text, labels, inactive toggle text, placeholder.
- **Line** (`line`): every 1px rule, control border, and the hairline grid between readings (`gap-px` on a `bg-line` grid).
- **Surface** (`surface`): hover wash on ghost/secondary buttons and expandable rows, idle camera well, skeleton bars, the one bordered notice box on the dashboard.

### Status
- **Ok / Watch / Alert** (`ok`, `watch`, `alert`): text colour for dot + word marks and inline reading labels; `alert` also colours error text, the invalid field border, and the danger button. "No readings" uses `muted` with an outlined dot.

**The One Yellow Rule.** A page has one yellow control: the thing the visitor came to do. A second action is `btnSecondary` (ink border), everything else is `btnGhost`. State switches (filter chips) invert to ink, not yellow.
**The Dot Not Fill Rule.** Status never tints a background, border or row. It is `StatusMark` (8px dot + word) or a 6px dot + short word at 12px inside readings.

## Typography

**Font:** Barlow 400/500/600 (Google, `--font-barlow`, the `font-sans` default). **Display:** Barlow Semi Condensed 500/600 (`--font-barlow-display`, class `font-display`) on the home title, page titles (`h1`), the part name, the next step, the home memory line, and the live view's part name and next step. **Mono:** Geist Mono for measured values only (reading values), always `tabular-nums`. Ids, tag numbers and dates are set in Barlow.

### Hierarchy (as used)
- **Part name** (display 600, 36px/1.05, tight): the h1 of a part card only.
- **Page title** (`h1`, display 600, 30px/1.1, tight): every other screen. Home title is 44px, 52px from `sm`.
- **Next step** (display 600, 26px/1.2, 30px from `sm`, max 30ch): the single recommendation and the largest text on the card.
- **Memory line** (display 500, 22px): the newest note quoted on the home screen.
- **Dialog / asset heading** (600, 20px, tight).
- **Section heading** (`h2`, 600, 16px): "Readings", "Recent history", "Add a note". Same size as body; weight does the work.
- **Body** (400, 16px, relaxed when a paragraph, max 65ch). Row summaries are 500.
- **Meta** (`meta`, 400, 14px, muted): dates, locations, helper copy, labels in `dl` grids.
- **Small** (12px): reading status words (600) and secondary timestamps in dashboard rows.

**The Weight Not Size Rule.** Adjacent levels differ by weight or colour before they differ by size; no uppercase, no letter-spaced labels, no eyebrows above headings.

## Layout

Single column, centred, `px-6` gutters (dashboard `px-5 sm:px-8`), `py-6 sm:py-10`. Containers: `max-w-lg` (home, scan), `max-w-2xl` (part card), `max-w-6xl` (dashboard, which splits 3fr/2fr at `lg`), `max-w-4xl` (labels). Sections stack with `gap-12` (48px); each starts with `section` (`border-t border-line pt-8`). Heading to first content is `mt-3`; helper copy under a heading is `mt-1`/`mt-1.5`. Lists are `border-t` with `border-b` rows at `py-4` (card) or `py-3.5`, `min-h-14` when tappable (dashboard). Button stacks use `gap-3`, inline groups `gap-2`. Key/value pairs are `grid-cols-[auto_1fr] gap-x-6 gap-y-1`. Readings are a hairline grid (`grid gap-px bg-line border-y`, cells `bg-background`). Tap targets: 48px controls, 56px page primaries, 44px links, 40px toolbar buttons.

## Motion

Feedback and continuity only; nothing moves until the person does something. Easing is `--ease-out` (`cubic-bezier(0.16, 1, 0.3, 1)`, class `ease-out-expo`); durations 100 ms (press), 150 to 200 ms (state and expand/collapse), 180 ms (dialog), 240 to 260 ms (the save payoff). `prefers-reduced-motion` collapses every duration to zero in `globals.css`; the `Reveal` grid still shows and hides content.

- **Expand/collapse:** `src/components/reveal.tsx`, a one-row grid whose track goes `0fr → 1fr` (`.reveal` in `globals.css`); children unmount after the exit. Used for dashboard part rows, activity items, the add-part form and the dashboard notice.
- **Buttons:** every `ui.ts` button scales to 0.985 for 100 ms on press.
- **Role toggle:** one yellow indicator translates between the two segments (200 ms).
- **Dialogs:** `dialog[open]` fades and scales from 0.98 (180 ms); backdrop fades (160 ms).
- **The save payoff:** the new history row runs `mm-grow` (240 ms) with the yellow "Just saved" tag; when the refreshed card arrives, the next step and summary run `mm-refresh` (a dip to 35% and back over 260 ms).

## Elevation & Depth

Flat. No `box-shadow`, no gradients, no tonal cards. Depth is 1px `line` rules and the `surface` hover wash. Two exceptions only: the native `<dialog>` backdrop (`bg-black/60`) and the live camera view (below).

## Shapes

4px corners (`rounded-ctl`) on every control, field, chip, dialog and the camera well; 2px on segments inside a 4px toggle; circles only for status dots. The "Next step" and notice markers are square (8–10px, `bg-accent`). Borders are 1px `line`, upgraded to `foreground` for the secondary button and the focused field. Focus is a 2px ink outline, offset 2px, from `globals.css`.

## Components

- **Buttons** (`ui.ts`): `btnPrimary` yellow fill (one per page); `btnSecondary` ink border, surface hover; `btnGhost` line border, muted border + surface hover; `btnDanger` alert fill, white text, dialog-confirmed only; add `btnSmall` in toolbars and rows. Page primaries add `min-h-14 text-lg`. Disabled is `opacity-50`. Transitions are `transition-colors duration-150`.
- **Fields** (`field`, `fieldLabel`): 1px line border, ground fill, muted border on hover, ink border on focus, `border-alert` when invalid; label is 14px/500 stacked with `gap-1.5`. Errors are 14px `text-alert` with `role="alert"`.
- **Links**: `textLink` (underline in `line`, darkens on hover) for in-copy links; back links are 14px/500 muted with `ArrowLeft`; nav links the same without the arrow.
- **Role toggle**: 2-col grid in a 1px line border with `p-1`; active segment `bg-accent text-accent-ink`, inactive muted. Only accent toggle in the system.
- **Filter chips**: `rounded-ctl border` 40px; off = line border, on = ink fill with ground text; count in `tabular-nums opacity-60`.
- **Status mark**: `StatusMark` everywhere a level is shown; 12px variant inside reading cells.
- **Expandable row**: `border-b border-line`, `min-h-14 py-3.5`, surface hover, `ChevronDown` rotating 180° over 200ms; detail indents `pl-5`.
- **Dialog**: native `<dialog>`, `rounded-ctl border border-line bg-background p-6`, 20px title, stacked buttons (`gap-3`, primary first, ghost second), backdrop `bg-black/60`.
- **Icons**: `icons.tsx` only; 20-unit viewBox, 1.75 stroke, round caps, `currentColor`; 16px default, 20px inside large buttons.
- **Skeleton**: `surface` bars with `animate-pulse`, same layout as the loaded page.

### Live view exception (`ar-view.tsx`)
The camera screen is a fixed black ground with white text and glass overlays over video: top-bar chips `bg-black/50 backdrop-blur rounded-ctl`, white `rounded-full` action buttons, panels `rounded-2xl border-white/15 shadow-[0_8px_30px_rgba(0,0,0,0.45)]`. The role toggle still uses Cat yellow. This vocabulary stays inside `/ar`; do not import it to any page with a page background.

## Do's and Don'ts

### Do:
- **Do** compose from `ui.ts`, `StatusMark` and `icons.tsx`; new screens should add no new colour, radius or shadow.
- **Do** separate content with `border-t border-line` sections and `border-b` rows; let 48px gaps breathe.
- **Do** spend yellow once per page, on the primary action, and keep it on the role toggle, dictation state, "Just saved" and the "Next step" square.
- **Do** keep every tappable thing at least 44px tall and make every hover state also work without hover.
- **Do** use Geist Mono + `tabular-nums` for measured values (reading values) and `tabular-nums` alone for other aligned numbers (hours).
- **Do** write meta as a sentence or a two-slot line ("Note by the operator" left, the date right).
- **Do** animate what the person just did: `Reveal` for expand/collapse, the dialog's own enter, the saved row's `mm-grow`, the refreshed card's `mm-refresh`. Enter and exit ease out (`--ease-out`), under 300 ms.

### Don't:
- **Don't** put content in nested cards or rounded tinted boxes; the dashboard notice (`border border-line bg-surface`) is the only bordered box, and it is flat.
- **Don't** use status colour as a fill, pill, badge or coloured left border; dot + word only.
- **Don't** add shadows or gradients outside the dialog backdrop and the live camera overlays.
- **Don't** write eyebrows, kickers, uppercase or letter-spaced labels above headings.
- **Don't** use emoji, glyph fonts or icon packages; draw the icon in `icons.tsx`.
- **Don't** hard-code hex or Tailwind palette colours (`neutral-*`, `red-*`) on page UI; use the tokens so dark mode holds.
- **Don't** join meta with middle dots (`A · B · C`), set ids or labels in mono, or append an arrow to link or button text. Chevrons mark rows that expand, nothing else.
- **Don't** animate on page load, on hover, on scroll, or with stagger; no lifts, no shadows, no springs. Motion answers an action.
