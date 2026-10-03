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
