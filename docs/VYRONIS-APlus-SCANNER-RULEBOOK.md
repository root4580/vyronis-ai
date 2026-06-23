# Vyronis A+ Scanner — Rulebook v1.2 (FROZEN)

**EA name:** `Vyronis_APlus_Scanner`  
**Mode:** Alert only — no auto execution  
**Vyronis surface:** `/scanner`  
**Frozen:** 2026-05-31  
**Coding spec:** [VYRONIS-APlus-SCANNER-V1-SPEC.md](./VYRONIS-APlus-SCANNER-V1-SPEC.md)

---

## Precision Flow pipeline (mandatory order)

```
Session → Daily+H4 aligned → Liquidity sweep → H4 FVG → M15 CHoCH → Engulf/rejection → R:R ≥ 1:2 → Score → Output
```

**BOS** = score bonus only. **CHoCH** and **engulf/rejection** are mandatory gates.

---

## Alert & publish policy

| Classification | Score | MT5 popup | Vyronis |
|----------------|-------|-----------|---------|
| **A+ Sniper** | 90 – 100 | **Yes** | `active` signal |
| **A Strong** | 80 – 89 | **No** | `watchlist` only |
| **B Watchlist** | 70 – 79 | **No** | `watchlist` only |
| **Skip** | &lt; 70 or gate fail | **No** | **Ignored** |

---

## Cooldown

After an alert fires on a pair, **do not alert the same setup again** until a **new liquidity sweep** occurs (different sweep level or source).

---

## MT5 alert text (required fields)

```
PAIR: {symbol}
DIRECTION: {BUY|SELL}
GRADE: {A+ Sniper}
SCORE: {0-100}
DAILY BIAS: {Bullish|Bearish}
H4 BIAS: {Bullish|Bearish}
ZONE: {FVG}
SWEEP: {PDH|PDL|EQH|EQL}
CHOCH: {Confirmed|None}
CONFIRMATION: {type}
RR: 1:{ratio}
SESSION: {London|New York}
```

---

## MT5 chart dashboard (required per pair)

| Field | Description |
|-------|-------------|
| Pair | Symbol |
| Bias | Daily / H4 |
| Session Status | Active session or Off |
| Current Scanner State | IDLE, BIAS_OK, SWEPT, IN_FVG, CHOCH, CONFIRMED, etc. |
| Last Scan Time | GMT timestamp |
| Current Grade | A+ Sniper / A Strong / B Watchlist / Skip |

---

## Vyronis display fields (always show when signal exists)

Pair, Direction, Grade, Daily Bias, H4 Bias, Zone Type, Confirmation Type, R:R, Session.

---

## Scope

| Item | Value |
|------|-------|
| Symbols | EURUSD, AUDUSD, GBPCAD, GBPNZD, CHFJPY, USDCHF |
| Sessions | London 07–10 GMT, NY 13–16 GMT |
| Zone V1 | H4 FVG only |
| Dedupe | One alert per setup; cooldown until new sweep |

---

*Rulebook v1.2 — frozen. Amendments require version bump.*
