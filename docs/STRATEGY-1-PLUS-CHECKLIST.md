# Strategy 1 + Pre-Trade Checklist

**Base:** FXAlexG pro-trend top-down (Weekly → Daily → 4H → AOI → structure confirmation)  
**Stolen from Strategy 2:** liquidity sweep, displacement, retest entry, kill zone, ONE A+ only  
**Journal:** Every step maps to Vyronis trade fields — Vyronis AI scores on submit.

---

## Before you click Buy/Sell (live account)

Only take trades graded **A+** on this checklist. Log **B** setups in demo or skip entirely.

---

## The 10 steps

| # | Check | Strategy source | Vyronis journal field |
|---|--------|-----------------|------------------------|
| 1 | **HTF aligned** — W/D/H4 match direction (BUY = bullish, SELL = bearish) | Strategy 1 | `weekly_bias`, `daily_bias`, `h4_bias`, `direction` |
| 2 | **Kill zone** — London, NY, or overlap (not random hours) | Strategy 2 | `session` |
| 3 | **AOI marked** — supply, demand, S/R, EMA, breakout retest | Strategy 1 | `aoi_type` |
| 4 | **Liquidity swept** — equal highs/lows or swing taken first | Strategy 2 | `aoi_type` → **Liquidity sweep** (or confirm manually) |
| 5 | **Displacement** — strong impulse after sweep, not slow drift | Strategy 2 | `confirmation_type` → **CHoCH** or **BOS** |
| 6 | **Confirmation** — CHoCH, BOS, engulfing, pin bar, break & retest | Strategy 1 + 2 | `confirmation_type`, `confirmation_signal` |
| 7 | **Retest entry** — not first touch; entry quality **Perfect** | Strategy 2 | `entry_quality`, `confirmation_type` → Break & retest |
| 8 | **R:R** — min **1:2** (floor); aim **1:3** on A+ | S1 floor / S2 target | `entry_price`, `stop_loss`, `take_profit` |
| 9 | **Emotion** — **Calm** or **Confident** only | Both | `emotion` |
| 10 | **Rules** — plan followed, no moved stop / oversize | Both | `rule_followed`, `mistake_tags` |

---

## Grading (pre-submit)

| Grade | Rule |
|-------|------|
| **A+** | 8+ steps pass, no hard fail, entry Perfect, R:R ≥ 1:2 |
| **B** | 6+ pass, at most 1 fail — **do not trade live** |
| **Skip** | HTF missing, no confirmation, Revenge/Impulsive, R:R &lt; 1:2, or &lt;6 pass |

**Hard skip (always):** Revenge, Impulsive, HTF conflict, confirmation = None, impulsive entry quality.

---

## ONE A+ rule (from Strategy 2)

> If you cannot label it A+ using this checklist, you are not allowed to trade it live.

Journal every trade in Vyronis — the Core Model will score and store grade, reasons, and warnings.

---

## Quick reference by market

| Market | Session | Extra focus |
|--------|---------|-------------|
| XAUUSD | London open | Steps 4–5 mandatory (sweep + displacement) |
| EURUSD | 4H / Daily | Step 1 HTF alignment is the edge |
| GBPUSD | London | Steps 2 + 4–5 |

---

## In the app

**Plan setup** — HTF, A+ gate, Vyronis fields, emotion before entry. Saves as planned (BE · $0) with Vyronis score. Edit later to log WIN/LOSS.

**Log result** — Fast path: pair, outcome, P&L, emotion after, mistakes, notes. Optional “Setup details” accordion for Vyronis scoring.

**Edit trade** — Full form for updates.

Switch modes with **Plan setup | Log result** tabs at the top of Add Trade (FAB opens **Log result** by default).
