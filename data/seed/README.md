# Seed data (owner: product)

The fake machine history the whole demo runs on. One machine, 3 to 4
components, 15 to 20 events spread across them. Realistic, and stated plainly
as simulated in the pitch.

Three files, shapes defined in `src/lib/types.ts`:

- `assets.json` — one row
- `components.json` — 3 to 4 rows. `id` is what goes in the QR code.
- `events.json` — 15 to 20 rows, no `id` field (the DB assigns it). Spread
  `created_at` over the last 6 to 18 months. Make the scenario component (the
  hydraulic leak) have the richest history so its card tells a story.

Load it with `npm run seed`. Run that before every demo so the live demo
starts from a clean state.
