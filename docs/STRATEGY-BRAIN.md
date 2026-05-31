# Strategy Brain (Vyronis AI)

Structured decision engine for the **Top-Down AOI** discretionary forex strategy (aligned with `lib/strategy/vyronis-strategy-playbook.ts`). Uses workflow scoring in-app; canonical doctrine lives in the **Vyronis Core Model** (`lib/strategy/vyronis-core.ts` — see [`VYRONIS-CORE-MODEL.md`](./VYRONIS-CORE-MODEL.md)). No MT5 automation — intelligence and workflow only.

## Setup

1. Run `supabase/026-strategy-brain-foundation.sql` in Supabase SQL Editor.
2. Open `/strategy-brain` in the app.

## Sections

| # | Module | Location |
|---|--------|----------|
| 1 | Market bias (W/D/H4) | `lib/strategy-brain/market-bias-engine.ts` |
| 2 | Sunday pair planning | `strategy_brain_weekly_plans`, `strategy_brain_pair_plans` |
| 3 | AOI cards & status | `components/strategy-brain/aoi-pair-card.tsx` |
| 4 | Confirmation checklist | `lib/strategy-brain/confirmation-engine.ts` |
| 5 | A+ scoring (100 pts) | `lib/strategy-brain/aplus-scoring-engine.ts` |
| 6 | Borderline → SKIP (≥2) | `lib/strategy-brain/borderline-engine.ts` |
| 7 | Emotion gate | `lib/strategy-brain/emotion-engine.ts` |
| 8 | Trade memory | `lib/strategy-brain/trade-memory-engine.ts` |
| 9 | Post-trade review | `strategy_brain_post_reviews` |
| 10 | UI | `components/strategy-brain/*`, glass terminal styling |

## Scoring (max 100)

- Weekly / Daily / H4 aligned: 10 each  
- AOI reached: 15  
- Momentum: 10 · EMA: 5 · Invalidation: 10 · RR: 10  
- Emotion stable: 10 · No news: 10  

Grades: **A+** 90–100 · **B** 75–89 · **C** 60–74 · **D** &lt;60

## API

- `GET /api/strategy-brain/dashboard`
- `PUT /api/strategy-brain/bias`
- `GET|PUT /api/strategy-brain/weekly-plan`
- `PATCH /api/strategy-brain/pair-plans/status`
- `POST /api/strategy-brain/evaluate`
- `POST /api/strategy-brain/emotion-check`
- `POST /api/strategy-brain/post-review`

## Verify

```bash
npx tsx scripts/verify-strategy-brain.ts
```

## Strategy PDF

Upload your PDF to the repo or link it in Strategy Playbook notes when available — doctrine is currently encoded in `vyronis-strategy-playbook.ts` and this engine.
