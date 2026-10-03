# UI components (owner: frontend)

Camera, QR scanning (`html5-qrcode`), the component card, role toggle, note
input, checklist. Pages go in `src/app/`, hooks in `src/hooks/`.
`dashboard/` holds the operator dashboard (overview, activity feed).

Everything must work on a real phone over HTTPS (the Vercel URL). Camera
access does not work on `http://localhost` from a phone; use the preview
deploy or `next dev --experimental-https`.
