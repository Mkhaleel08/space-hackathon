# Machine Memory interface

The current direction is a practical field workspace: graphite ink, cool neutral ground, white or charcoal working panels, and Caterpillar yellow for primary actions. Geist remains the product font. The homepage explains the scan → history → note loop; the dashboard prioritizes condition and separates overview, activity, and AprilTags.

## Source of truth

- `src/app/globals.css`: light/dark color tokens and focus/reduced-motion defaults.
- `src/components/ui.ts`: shared buttons, fields, and text utilities.
- `src/components/workspace.module.css`: navigation, responsive layouts, workspace panels, homepage, and part records.
- `src/components/site-header.tsx`: shared navigation, brand mark, and skip link.
- `src/components/icons.tsx` and `status-mark.tsx`: icons and accessible condition labels.

## Palette and hierarchy

Light mode uses `#f7f8fa` ground, `#ffffff` panels, `#192125` text, `#626d73` secondary text, and `#e0e5e8` borders. Dark mode uses `#12181c`, `#1a2227`, `#edf1f3`, `#a5b0b7`, and `#303b42` respectively. Both follow the operating system through `prefers-color-scheme`.

Yellow `#ffcd11` identifies the primary action. A quiet yellow recommendation strip makes the next step immediately visible on part records. Green, amber, and red communicate reading status through words and marks; matching left borders connect the condition to the asset. Missing telemetry always says “No readings.”

Page headings are 28–36px. The home heading is 42–68px. Recommendations are 20px semibold, body copy is 16px, and supporting metadata is quieter. Use tabular numerals for values. Controls have 8px corners; working panels have 10–12px corners. Borders provide most separation. Avoid decorative gradients, invented metrics, and nested panels.

## Layout and behavior

- Shared header links to Dashboard, Scan a part, and Live view. On phones, icons retain accessible names.
- Homepage: primary live-view launch, two task destinations, and an explanatory field illustration. On phones the destinations precede the illustration.
- Dashboard: Overview, Activity, and AprilTags are explicit section controls. Four condition totals are filters, not decoration. Search matches part names, locations, IDs, and associated note content. Activity uses its own search/asset scope; condition filtering applies to assets only.
- Overview shows five recent events; View all opens the full paginated activity list. Tags have their own section instead of sitting below a long history.
- Part records: identity → next action → summary/readings → history/notes. History and the form share a row on desktop and stack on mobile. Saving focuses and scrolls to history and highlights the confirmed new event.
- Scanning distinguishes QR scanning from AprilTag live view. Camera permission is handled by the existing scanner; UI changes do not change detection or voice capture.
- Preserve visible keyboard focus, explicit form labels, readable dark mode, reduced motion, loading/error states, and draft protection. Primary actions are at least 48px high. Avoid hover-only interactions.

The immersive camera view keeps its own black/video ground, translucent panels, zoom controls, and spatial tracking. Printable AprilTags remain black on white with their required quiet border.
