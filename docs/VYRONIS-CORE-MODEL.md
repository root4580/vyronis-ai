# Vyronis Core Model

Centralized strategy doctrine for **Vyronis AI**. Evaluates trades using **Vyronis strategy scoring** (0–100) before execution and feeds **Vyronis journal intelligence** post-trade.

> **Note:** `lib/vyronis-core/` is the live intelligence orchestrator (Phase 5+). `lib/strategy/vyronis-core.ts` is the **Vyronis Core Model** doctrine engine for setup evaluation.

## Modules

| Module | Purpose |
|--------|---------|
| `types/strategy.ts` | Input/output types |
| `types/vyronis-branding.ts` | Product naming constants |
| `lib/strategy/vyronis-core.ts` | Doctrine rules (HTF, AOI, CHoCH/BOS, session, RR, news, emotion) |
| `lib/scoring/trade-score.ts` | Vyronis strategy scoring weights & grade mapping |
| `lib/psychology/emotion-filter.ts` | Emotion stability gate |

## Vyronis strategy scoring (weights)

| Component | Points |
|-----------|--------|
| HTF alignment (W/D/H4) | 25 |
| AOI quality | 20 |
| Structure shift (CHoCH/BOS + liquidity) | 15 |
| Confirmation candle (engulfing) | 10 |
| Session timing | 10 |
| RR quality | 10 |
| Emotional discipline | 10 |

**Grades:** A+ (90–100) · A (80–89) · B (70–79) · Skip (&lt;70 or hard block)

## Hard rules

- HTF alignment missing → **Skip**
- Unstable emotion (not calm/confident) → **Skip**
- Revenge / impulsive → heavy score penalty + skip

## Usage

```ts
import { evaluateVyronisCore } from "@/lib/strategy/vyronis-core"

const evaluation = evaluateVyronisCore(tradeInput)
```

## Verify

```bash
npx tsx scripts/verify-vyronis-core.ts
```

## Related

- [Strategy Brain](./STRATEGY-BRAIN.md) — UI workflow & legacy A+ scoring
- [Journal Intelligence](./JOURNAL-INTELLIGENCE.md) — Vyronis journal intelligence workflow
