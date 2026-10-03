# Machine Memory — product truth

**What it is.** A phone web app for people who work on heavy equipment. Point the camera at a part's printed tag and the part's memory pins itself to the label: what it has been through, a role-specific summary, and the one thing to do next. Say or type a note and the memory updates for the next person.

**Who uses it.** A first-week technician or small-contractor operator doing an inspection or first diagnosis, on a job site, usually outdoors, phone in a gloved or dirty hand. Secondary: a supervisor at a laptop checking the operator dashboard.

**The mechanism.** Persistent per-part event history in Postgres, written back from the field in plain speech, summarized by an LLM in the reader's own vocabulary (operator vs. technician). The demo moment is the write-back loop: save a note, the next card changes.

**Surfaces.** Home → Live view (camera, AprilTags) → Part card (status, next step, memory, readings, history, add a note) → Operator dashboard (every asset and part, recent activity, delete a note behind a shared PIN, AprilTag manager and label printing).

**Constraints.** Built in 12 hours by three people for a Caterpillar-track hackathon (Oct 2–3, 2026). Readings are simulated and say so. No accounts; a shared operator PIN gates deletes. Everything must work on a phone over HTTPS, mobile-first, 44px tap targets, no hover-only interactions. Scope is locked in `docs/decisions.md`.

**Brand commitments.** Mode: Operate. Restrained cool neutrals, readable working panels, and Cat yellow `#FFCD11` for the primary action and next-step emphasis. Status uses a colored mark and a word, with matching asset borders. Geist, clear mobile hierarchy, and accessible controls. The current look is recorded in `DESIGN.md`; the older `.impeccable` export predates this redesign.
