# Vyronis A+ Scanner — V1 Coding Specification

**Status:** FROZEN — V1 implementation in progress  
**Rulebook:** [VYRONIS-APlus-SCANNER-RULEBOOK.md](./VYRONIS-APlus-SCANNER-RULEBOOK.md) v1.2  
**Frozen:** 2026-05-31

---

## 1. System overview

```
┌─────────────────────┐         HTTPS POST          ┌──────────────────────────┐
│  MT5 Terminal       │  ─────────────────────────► │  Vyronis HQ              │
│  Vyronis_APlus_     │   /api/webhooks/mt5/scanner │  scanner_signals table   │
│  Scanner.mq5        │   X-API-Key                 │  /scanner UI             │
│                     │                             │                          │
│  • Scan 6 pairs     │         ◄── read ──       │  Live Signals card       │
│  • Precision Flow   │                             │  Signal Details panel    │
│  • MT5 Alert A+ only│                             │                          │
└─────────────────────┘                             └──────────────────────────┘
```

| Layer | Responsibility |
|-------|----------------|
| **EA** | Market data, rule engine, scoring, dedupe, MT5 alerts |
| **Webhook API** | Auth, validate payload, dedupe, persist |
| **Supabase** | `scanner_signals` storage per user |
| **Next.js `/scanner`** | Fetch live signals; replace mock data |

---

## 2. Precision Flow state machine

Each symbol maintains an independent `ScannerContext`:

```
                    ┌──────────────┐
                    │   IDLE       │
                    └──────┬───────┘
                           │ in_session?
                           ▼
                    ┌──────────────┐
         no ◄───────│ BIAS_OK      │───────► SKIP (neutral / mismatch)
                    └──────┬───────┘
                           │ sweep confirmed
                           ▼
                    ┌──────────────┐
                    │ SWEPT        │  (sweep bar index stored)
                    └──────┬───────┘
                           │ fvg valid + in zone
                           ▼
                    ┌──────────────┐
                    │ IN_FVG       │
                    └──────┬───────┘
                           │ m15 choch after sweep
                           ▼
                    ┌──────────────┐
                    │ CHOCH        │  ← mandatory gate
                    └──────┬───────┘
                           │ engulf OR rejection (closed M15)
                           ▼
                    ┌──────────────┐
                    │ CONFIRMED    │
                    └──────┬───────┘
                           │ rr >= 2.0
                           ▼
                    ┌──────────────┐
                    │ SCORED       │ → classify grade
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         A+ Sniper    A Strong    B Watchlist
         alert+hook   hook only   hook only
              │            │            │
              └────────────┴────────────┘
                           │
                    setup_id marked
                    (no repeat until RESET)
```

**RESET triggers:** new sweep level, opposite CHoCH, FVG mitigated, session boundary.

---

## 3. MT5 EA architecture

### 3.1 File tree

```
mt5/
  experts/
    Vyronis_APlus_Scanner.mq5          # OnInit, OnTimer, OnDeinit, inputs
  include/
    VyronisScannerTypes.mqh            # structs, enums, constants
    VyronisSession.mqh                 # GMT session gate
    VyronisStructure.mqh               # swings, D/H4 bias, M15 CHoCH, M15 BOS
    VyronisFvg.mqh                     # H4 FVG detect + mitigation
    VyronisLiquidity.mqh               # PDH/PDL, equal H/L sweeps
    VyronisConfirm.mqh                 # engulfing + rejection
    VyronisRisk.mqh                    # entry, SL, TP, R:R
    VyronisScore.mqh                   # gates + points + classification
    VyronisScannerWebhook.mqh          # JSON + WebRequest (reuse patterns from TradeWebhook)
    VyronisScannerState.mqh            # per-symbol context + dedupe + reset
```

### 3.2 EA inputs

| Input | Default | Purpose |
|-------|---------|---------|
| `InpVyronisScannerUrl` | `https://vyronishq.com/api/webhooks/mt5/scanner` | Webhook |
| `InpVyronisApiKey` | (empty) | Same as TradeSync key |
| `InpSymbols` | 6 pairs CSV | Watchlist |
| `InpScanOnNewM15Bar` | true | Scan trigger |
| `InpTimerSeconds` | 30 | Fallback poll |
| `InpMinAlertGrade` | `A_PLUS_SNIPER` | Fixed 90+ per rulebook |
| `InpPublishWatchlist` | true | Send A Strong / B to Vyronis without MT5 alert |
| `InpVerboseLog` | true | Experts tab |

### 3.3 Core structs (`VyronisScannerTypes.mqh`)

```cpp
enum ENUM_SCANNER_GRADE {
  GRADE_SKIP = 0,
  GRADE_B_WATCHLIST = 1,
  GRADE_A_STRONG = 2,
  GRADE_A_PLUS_SNIPER = 3
};

enum ENUM_SCANNER_BIAS { BIAS_NEUTRAL, BIAS_BULLISH, BIAS_BEARISH };
enum ENUM_SWEEP_SOURCE { SWEEP_PDH, SWEEP_PDL, SWEEP_EQH, SWEEP_EQL, SWEEP_NONE };
enum ENUM_CONFIRM_TYPE { CONF_NONE, CONF_ENGULF, CONF_REJECTION };

struct ScannerBiasResult {
  ENUM_SCANNER_BIAS daily;
  ENUM_SCANNER_BIAS h4;
  bool aligned;
  int direction;  // ORDER_TYPE_BUY / SELL
};

struct ScannerSweepResult {
  bool valid;
  ENUM_SWEEP_SOURCE source;
  double level;
  datetime bar_time;
  double wick_extreme;
};

struct ScannerFvgResult {
  bool valid;
  double top;
  double bottom;
  datetime formed_at;
  string id;  // for setup_id
};

struct ScannerChochResult {
  bool choch;
  bool bos;      // bonus only
  datetime bar_time;
};

struct ScannerConfirmResult {
  bool valid;
  ENUM_CONFIRM_TYPE type;
  datetime bar_time;
};

struct ScannerRiskResult {
  double entry;
  double sl;
  double tp;
  double rr;
  bool meets_min_rr;
};

struct ScannerSignal {
  string symbol;
  string pair_display;       // EUR/USD
  int direction;
  ENUM_SCANNER_GRADE grade;
  string grade_label;          // "A+ Sniper"
  int score;
  ENUM_SCANNER_BIAS daily_bias;
  ENUM_SCANNER_BIAS h4_bias;
  string zone_type;            // "FVG"
  string confirmation_type;    // "Bearish engulfing (M15)"
  double rr;
  string session;              // "London" | "New York"
  string setup_id;
  ScannerRiskResult risk;
  // factor breakdown for webhook
};
```

### 3.4 Module contracts

| Module | Function | Returns |
|--------|----------|---------|
| `VyronisSession` | `GetActiveSessionGMT()` | `NONE \| LONDON \| NEW_YORK` |
| `VyronisStructure` | `EvaluateBias(symbol)` | `ScannerBiasResult` |
| `VyronisLiquidity` | `DetectSweep(symbol, direction)` | `ScannerSweepResult` |
| `VyronisFvg` | `FindActiveFvg(symbol, direction, after_time)` | `ScannerFvgResult` |
| `VyronisStructure` | `DetectChoch(symbol, direction, after_sweep)` | `ScannerChochResult` |
| `VyronisConfirm` | `DetectConfirm(symbol, direction, after_choch)` | `ScannerConfirmResult` |
| `VyronisRisk` | `BuildRisk(symbol, direction, sweep, confirm)` | `ScannerRiskResult` |
| `VyronisScore` | `EvaluateSignal(...)` | `ScannerSignal` |
| `VyronisScannerState` | `ShouldAlert(setup_id)` | `bool` |
| `VyronisScannerWebhook` | `PostSignal(signal)` | `bool` |

### 3.5 Scan loop (`OnTimer` / new M15 bar)

```
FOR symbol IN watchlist:
  ctx = LoadState(symbol)

  IF NOT InSessionGMT(): reset ctx; CONTINUE

  bias = EvaluateBias(symbol)
  IF NOT bias.aligned: ctx.phase = IDLE; CONTINUE

  sweep = DetectSweep(symbol, bias.direction)
  IF NOT sweep.valid: ctx.phase = BIAS_OK; CONTINUE
  IF sweep.level != ctx.sweep_level: reset alert lock for symbol

  fvg = FindActiveFvg(symbol, bias.direction, sweep.bar_time)
  IF NOT fvg.valid OR NOT price_in_fvg: CONTINUE

  choch = DetectChoch(symbol, bias.direction, sweep.bar_time)
  IF NOT choch.choch: CONTINUE                    // MANDATORY

  confirm = DetectConfirm(symbol, bias.direction, choch.bar_time)
  IF NOT confirm.valid: CONTINUE                  // engulf OR rejection MANDATORY

  risk = BuildRisk(symbol, bias.direction, sweep, confirm)
  IF NOT risk.meets_min_rr: CONTINUE              // RR >= 2

  signal = EvaluateSignal(bias, sweep, fvg, choch, confirm, risk, session)
  signal.setup_id = BuildSetupId(symbol, signal)

  IF NOT ShouldAlert(signal.setup_id): CONTINUE

  IF signal.grade == GRADE_A_PLUS_SNIPER:
    FormatAlert(signal) → Alert()
  IF signal.grade >= GRADE_B_WATCHLIST AND InpPublishWatchlist:
    PostSignal(signal)   // Vyronis always gets full fields

  MarkAlerted(signal.setup_id)
  SaveState(symbol, ctx)
```

### 3.6 MT5 alert format (required fields)

```
Vyronis A+ Sniper | EURUSD SELL | Score 94
Session: London | R:R 1:2.4
Daily: Bearish | H4: Bearish
Zone: FVG | Confirm: Bearish engulfing (M15)
```

### 3.7 Dedupe storage

- Terminal: `GlobalVariableSet("VYRONIS_SCAN_"+setup_id, (double)TimeCurrent())`
- Vyronis: unique `(user_id, setup_id)` in DB
- `ShouldAlert`: false if GV exists OR webhook returned 200 duplicate

---

## 4. Scoring algorithm (V1)

### 4.1 Hard gates (all must pass — else Skip)

1. Active London or NY session  
2. Daily bias == H4 bias != Neutral  
3. Valid liquidity sweep  
4. Valid H4 FVG + M15 in zone  
5. **M15 CHoCH after sweep**  
6. **M15 engulfing OR rejection after CHoCH**  
7. **R:R ≥ 2.0**

BOS does **not** gate.

### 4.2 Point calculation (only if gates pass)

| Factor | Points |
|--------|--------|
| Daily/H4 aligned | 18 |
| Session | 14 |
| FVG valid | 14 |
| Sweep confirmed | 14 |
| CHoCH | 10 |
| Engulf or rejection | 12 |
| R:R ≥ 2.0 | 14 |
| **Subtotal** | **96** |
| BOS present (bonus) | +8 (cap 100) |
| R:R ≥ 3.0 (bonus) | +2 (cap 100) |

*Note: With all gates pass, base is 96; BOS/R:R bonuses tune 90+ band.*

### 4.3 Classification

```
if score >= 90 → A+ Sniper
else if score >= 80 → A Strong
else if score >= 70 → B Watchlist
else → Skip
```

### 4.4 Alert policy (frozen v1.2)

| Grade | MT5 popup | Vyronis webhook |
|-------|-----------|-----------------|
| A+ Sniper (90+) | **YES** | `status: active` |
| A Strong (80–89) | **NO** | `status: watchlist` |
| B Watchlist (70–79) | **NO** | `status: watchlist` |
| Skip (&lt;70) | **NO** | **Ignored — no POST** |

### 4.5 Cooldown (frozen)

- Store last alerted `sweep_level` per symbol in `GlobalVariable`.
- Block repeat MT5 alert until a **new liquidity sweep** (level change ≥ 0.5 pip).
- Vyronis dedupe via `UNIQUE (user_id, setup_id)`.

### 4.6 MT5 alert text (frozen)

```
PAIR: EURUSD
DIRECTION: SELL
GRADE: A+ Sniper
SCORE: 94
DAILY BIAS: Bearish
H4 BIAS: Bearish
ZONE: FVG
SWEEP: PDH
CHOCH: Confirmed
CONFIRMATION: Bearish engulfing (M15)
RR: 1:2.4
SESSION: London
```

### 4.7 MT5 chart dashboard (frozen)

Per watchlist symbol on chart Comment panel:

`Pair | Bias | Session | State | Last Scan | Grade`

---

## 5. Vyronis backend (V1)

### 5.1 Database — `supabase/047-scanner-signals.sql`

```sql
CREATE TABLE public.scanner_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  setup_id text NOT NULL,
  pair text NOT NULL,
  direction text NOT NULL,
  grade text NOT NULL,           -- A+ Sniper | A Strong | B Watchlist
  score integer NOT NULL,
  daily_bias text NOT NULL,
  h4_bias text NOT NULL,
  zone_type text NOT NULL,
  confirmation_type text NOT NULL,
  risk_reward numeric NOT NULL,
  session text NOT NULL,
  status text NOT NULL DEFAULT 'active',  -- active | watchlist | expired
  entry_price numeric,
  stop_loss numeric,
  take_profit numeric,
  raw_payload jsonb NOT NULL DEFAULT '{}',
  detected_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, setup_id)
);
```

RLS: user selects own rows. Webhook uses service role insert.

### 5.2 API — `app/api/webhooks/mt5/scanner/route.ts`

| Step | Action |
|------|--------|
| 1 | Parse JSON |
| 2 | `resolveUserByMt5ApiKey` (reuse trade sync) |
| 3 | Validate required fields (§10 rulebook) |
| 4 | Upsert `scanner_signals` on `setup_id` |
| 5 | Return `201` new / `200` duplicate |

### 5.3 App — `/scanner` changes

| File | Change |
|------|--------|
| `lib/scanner/scoring.ts` | Add grades: `A+ Sniper`, `A Strong`, `B Watchlist` |
| `lib/scanner/fetch-signals.ts` | **New** — client/server fetch from Supabase |
| `components/scanner/a-plus-scanner-workspace.tsx` | Live data + required columns |
| `components/scanner/signal-details-panel.tsx` | Match webhook fields |

### 5.4 Webhook JSON (frozen)

```json
{
  "api_key": "...",
  "setup_id": "EURUSD-SELL-20260623-LON-sweep1-fvg3",
  "pair": "EURUSD",
  "direction": "SELL",
  "grade": "A+ Sniper",
  "score": 94,
  "daily_bias": "Bearish",
  "h4_bias": "Bearish",
  "zone_type": "FVG",
  "confirmation_type": "Bearish engulfing (M15)",
  "risk_reward": 2.4,
  "session": "London",
  "status": "active",
  "entry": 1.1462,
  "stop_loss": 1.1484,
  "take_profit": 1.1416,
  "detected_at": "2026-06-23T08:42:00Z",
  "bos_bonus": true
}
```

`pair` sent as `EURUSD` from EA; Vyronis normalizes to `EUR/USD` for display.

---

## 6. Implementation phases (V1 only)

| Phase | Deliverable | Est. |
|-------|-------------|------|
| **P1** | `VyronisScannerTypes`, Session, Structure (bias) | EA foundation |
| **P2** | Liquidity + FVG modules | Pipeline middle |
| **P3** | CHoCH, Confirm, Risk | Mandatory gates |
| **P4** | Score + State + dedupe | Classifications |
| **P5** | Webhook MQH + main EA | End-to-end MT5 |
| **P6** | Supabase migration + API route | Vyronis ingest |
| **P7** | `/scanner` live UI | Replace mock |
| **P8** | Demo forward test 2 weeks | Tuning doc |

**Out of V1 scope:** S/D, OB, flip zones, M5 refine, auto trade, backtest UI.

---

## 7. Testing plan

| Test | Method |
|------|--------|
| Session gate | Unit: GMT boundaries 06:59 / 07:00 / 10:01 |
| Bias | Visual: mark HH/HL on D/H4 vs EA log |
| Sweep | Replay known PDH sweep chart |
| CHoCH gate | Assert no alert without CHoCH even if engulf present |
| Engulf gate | Assert no alert with CHoCH but no engulf/rejection |
| BOS bonus | Score +8 with BOS, alert unchanged if &lt;90 |
| Dedupe | Same setup twice → one alert |
| Reset | New sweep → new alert allowed |
| Webhook | `curl` POST → row in `scanner_signals` |
| Vyronis UI | Signal shows all 10 required fields |

---

## 8. Dependencies & prerequisites

| Item | Status |
|------|--------|
| `VyronisTradeSync` API key pattern | Exists |
| WebRequest whitelist `https://vyronishq.com` | User MT5 config |
| `lib/scanner/scoring.ts` | Update grades in P7 |
| Mock data on `/scanner` | Replace in P7 |

---

## 9. Risk & limitations (documented)

- Fractal bias ≠ discretionary trend reader — tune on demo.
- Equal highs clustering varies by pair — ATR scaling required.
- FVG on H4 may lag fast M15 moves.
- Asia range TP target needs Asia session definition (00:00–07:00 GMT **proposed**).
- CHoCH on M15 is algorithmic — may differ from manual SMC labeling.
- **No auto execution** — trader confirms in Vyronis Coach / journal.

---

## 10. Sign-off checklist

| # | Item | Approved |
|---|------|----------|
| 1 | A+ Sniper only for MT5 alerts | ✅ |
| 2 | CHoCH mandatory | ✅ |
| 3 | Engulf OR rejection after CHoCH mandatory | ✅ |
| 4 | BOS score bonus only | ✅ |
| 5 | Classifications: A+ Sniper / A Strong / B Watchlist / Skip | ✅ |
| 6 | One alert per setup until reset | ✅ |
| 7 | Precision Flow pipeline order | ✅ |
| 8 | Alert only | ✅ |
| 9 | Required display fields | ✅ |
| 10 | V1 spec + architecture | ✅ (this document) |

**Implementation:** Phase P1–P8 in progress (frozen spec).

---

*V1 coding specification — 2026-06-23*
