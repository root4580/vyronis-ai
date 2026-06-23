# Vyronis A+ Scanner V1 — Deployment & Testing

**Rulebook:** [VYRONIS-APlus-SCANNER-RULEBOOK.md](./VYRONIS-APlus-SCANNER-RULEBOOK.md) v1.2 (frozen)  
**Spec:** [VYRONIS-APlus-SCANNER-V1-SPEC.md](./VYRONIS-APlus-SCANNER-V1-SPEC.md)

---

## 1. Complete file tree (created + modified)

```
vyronis-ai-dashboard/
├── app/api/
│   ├── scanner/signals/route.ts              [CREATED]  GET live signals for /scanner
│   └── webhooks/mt5/scanner/route.ts           [CREATED]  POST MT5 scanner webhook
├── components/scanner/
│   ├── a-plus-scanner-workspace.tsx            [MODIFIED] Live signals UI
│   ├── a-plus-score.tsx                        [MODIFIED] Grade labels
│   └── signal-details-panel.tsx                [MODIFIED] Rulebook fields
├── docs/
│   ├── MT5-SCANNER-EA.md                       [CREATED]  This guide
│   ├── VYRONIS-APlus-SCANNER-RULEBOOK.md       [CREATED]  Frozen rules v1.2
│   └── VYRONIS-APlus-SCANNER-V1-SPEC.md        [CREATED]  Architecture spec
├── hooks/
│   └── use-scanner-signals.ts                  [CREATED]  Poll /api/scanner/signals
├── lib/scanner/
│   ├── map-signal-row.ts                       [CREATED]  DB row → UI signal
│   ├── mock-data.ts                            [MODIFIED] Fallback when migration missing
│   ├── scanner-webhook-service.ts              [CREATED]  Webhook ingest logic
│   ├── scoring.ts                              [MODIFIED] A+ Sniper / A Strong / B / Skip
│   ├── signal-types.ts                         [CREATED]  Shared UI types
│   └── types.ts                                [CREATED]  Webhook + DB types
├── mt5/
│   ├── README.md                               [MODIFIED] Scanner section
│   ├── experts/
│   │   └── Vyronis_APlus_Scanner.mq5           [CREATED]  Main EA
│   └── include/
│       ├── VyronisConfirm.mqh                  [CREATED]
│       ├── VyronisFvg.mqh                      [CREATED]
│       ├── VyronisLiquidity.mqh                [CREATED]
│       ├── VyronisRisk.mqh                     [CREATED]
│       ├── VyronisScannerPanel.mqh             [CREATED]  Chart dashboard
│       ├── VyronisScannerState.mqh             [CREATED]  Cooldown + dedupe
│       ├── VyronisScannerTypes.mqh             [CREATED]
│       ├── VyronisScannerWebhook.mqh           [CREATED]
│       ├── VyronisScore.mqh                    [CREATED]
│       ├── VyronisSession.mqh                  [CREATED]
│       └── VyronisStructure.mqh                [CREATED]
└── supabase/
    ├── 047-scanner-signals.sql                 [CREATED]  Migration
    └── RUN-SCANNER-SIGNALS.sql                 [CREATED]  Pointer
```

---

## 2. Exact Supabase migration commands

### Option A — Supabase Dashboard (recommended)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **SQL Editor** → **New query**.
3. Open `supabase/047-scanner-signals.sql` from this repo.
4. Copy the **entire file contents** and paste into the editor.
5. Click **Run**.
6. Confirm success: **Success. No rows returned.**

### Option B — Supabase CLI (if linked)

```bash
cd /path/to/vyronis-ai-dashboard
supabase db execute --file supabase/047-scanner-signals.sql
```

### Verify migration

In SQL Editor:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'scanner_signals'
ORDER BY ordinal_position;
```

Expected: columns include `setup_id`, `pair`, `grade`, `status`, `daily_bias`, `h4_bias`, etc.

```sql
SELECT COUNT(*) FROM public.scanner_signals;
```

Expected: `0` (empty table, no error).

---

## 3. Exact MT5 installation steps

1. **Locate MT5 data folder**
   - MT5 → **File → Open Data Folder**
   - Note paths: `MQL5/Experts/` and `MQL5/Include/`

2. **Copy EA**
   - From repo: `mt5/experts/Vyronis_APlus_Scanner.mq5`
   - To: `MQL5/Experts/Vyronis_APlus_Scanner.mq5`

3. **Copy includes** (all required)
   - From repo `mt5/include/` copy these to `MQL5/Include/`:
     - `VyronisScannerTypes.mqh`
     - `VyronisSession.mqh`
     - `VyronisStructure.mqh`
     - `VyronisLiquidity.mqh`
     - `VyronisFvg.mqh`
     - `VyronisConfirm.mqh`
     - `VyronisRisk.mqh`
     - `VyronisScore.mqh`
     - `VyronisScannerState.mqh`
     - `VyronisScannerWebhook.mqh`
     - `VyronisScannerPanel.mqh`
     - `VyronisTradeWebhook.mqh` (dependency — should already exist from TradeSync)

4. **Compile**
   - Open MetaEditor (F4 in MT5)
   - Open `Vyronis_APlus_Scanner.mq5`
   - Press **Compile** (F7)
   - **Errors tab must show 0 errors**

5. **Attach EA**
   - Open any chart (e.g. EURUSD M15)
   - Navigator → Expert Advisors → drag **Vyronis_APlus_Scanner** onto chart
   - Inputs tab:
     - `InpVyronisApiKey` = your Vyronis API key (see section 5)
     - `InpVyronisScannerUrl` = `https://vyronishq.com/api/webhooks/mt5/scanner`
     - `InpSymbols` = adjust for broker suffix if needed (e.g. `EURUSD.sim,AUDUSD.sim,...`)
   - Common tab: enable **Allow Algo Trading**
   - Click **OK**

6. **Enable Algo Trading**
   - Toolbar → **Algo Trading** button must be green

7. **Confirm panel**
   - Chart should show `=== Vyronis A+ Scanner v1.00 ===` with 6 pair rows

---

## 4. Exact WebRequest whitelist settings

1. MT5 → **Tools → Options**
2. Tab: **Expert Advisors**
3. Check: **Allow automated trading**
4. Check: **Allow WebRequest for listed URL**
5. In the URL list, add **exactly** (one per line):

```
https://vyronishq.com
```

For local development only, also add:

```
http://localhost:3000
```

6. Click **OK**
7. **Restart MT5** (recommended after first whitelist change)

If WebRequest fails, Experts log shows:

```
WebRequest failed ... Error=4014 — whitelist URL in Tools → Options → Expert Advisors → WebRequest
```

---

## 5. Exact API key configuration steps

The scanner reuses the **same API key** as `VyronisTradeSync`.

### Vyronis (web app)

1. Log in to Vyronis HQ.
2. Open **Account Settings** (gear icon).
3. Go to **MT5 auto-sync** section.
4. If no key exists: click **Generate API key** (or equivalent).
5. Copy the key (64-char hex string). Store securely.
6. Ensure MT5 auto-sync is **enabled**.

### MT5 (Vyronis_APlus_Scanner inputs)

1. Right-click chart → **Expert Advisors → Vyronis_APlus_Scanner → Properties**
2. **Inputs** tab → `InpVyronisApiKey` → paste key
3. Click **OK**

### MT5 (VyronisTradeSync — if also used)

Same key in `InpVyronisApiKey` on the TradeSync EA.

### Never

- Do not commit the API key to git.
- Do not share the key in screenshots.

---

## 6. Step-by-step demo testing procedure

### Phase 1 — Webhook without MT5 (5 min)

1. Run Supabase migration (section 2).
2. Deploy app or run locally with production Supabase env.
3. Get API key from Account Settings.
4. Run curl test:

```bash
curl -s -w "\nHTTP:%{http_code}\n" -X POST "https://vyronishq.com/api/webhooks/mt5/scanner" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY_HERE" \
  -d '{
    "setup_id": "DEMO-EURUSD-SELL-001",
    "pair": "EURUSD",
    "direction": "SELL",
    "grade": "A+ Sniper",
    "score": 94,
    "daily_bias": "Bearish",
    "h4_bias": "Bearish",
    "zone_type": "FVG",
    "sweep": "PDH",
    "choch": "Confirmed",
    "confirmation_type": "Bearish engulfing (M15)",
    "risk_reward": 2.4,
    "session": "London",
    "status": "active",
    "entry": 1.1462,
    "stop_loss": 1.1484,
    "take_profit": 1.1416
  }'
```

5. Expected: `HTTP:201`, JSON with `setup_id`, `signal_id`, `duplicate: false`.
6. Log in to Vyronis → open **/scanner**.
7. Expected: EUR/USD SELL signal, grade **A+ Sniper**, status **Active**.

### Phase 2 — Watchlist grade (2 min)

Repeat curl with:

```json
"setup_id": "DEMO-GBPCAD-BUY-001",
"pair": "GBPCAD",
"direction": "BUY",
"grade": "A Strong",
"score": 85,
"status": "watchlist"
```

Expected: HTTP 201, `/scanner` shows **Watchlist** (not Active).

### Phase 3 — MT5 EA on demo account (session hours)

**Only during London 07:00–10:00 GMT or NY 13:00–16:00 GMT.**

1. Complete MT5 install (sections 3–5).
2. Attach EA on demo account.
3. Wait for M15 bar close (or set `InpScanOnNewM15Bar = false` temporarily for faster polling).
4. Watch chart panel — states should update per pair.
5. When a real A+ Sniper setup forms:
   - MT5 popup with 12-field alert text
   - Experts log: `Vyronis Scanner ALERT ...`
   - `/scanner` updates within ~60 seconds

### Phase 4 — Cooldown test

1. After an A+ alert fires on a pair, wait for next scans.
2. Same sweep level → **no second popup**.
3. After a new liquidity sweep at a different level → new alert allowed.

---

## 7. Common troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `INIT_PARAMETERS_INCORRECT` on attach | API key too short | Paste full key from Account Settings → MT5 auto-sync |
| WebRequest error 4014 | URL not whitelisted | Add `https://vyronishq.com` in Options → Expert Advisors |
| HTTP 401 on webhook | Wrong API key | Regenerate/copy key; ensure no extra spaces |
| HTTP 503 webhook | Migration not run | Run `047-scanner-signals.sql` |
| HTTP 422 webhook | Skip grade sent | Only A+ Sniper, A Strong, B Watchlist are accepted |
| `/scanner` shows mock data | `tableMissing: true` | Run migration 047 |
| `/scanner` empty but curl works | Wrong user logged in | Signal is per `user_id` — use same account as API key owner |
| No MT5 alerts | Outside session | London 07–10 or NY 13–16 GMT only |
| No MT5 alerts | Grade &lt; 90 | Only **A+ Sniper** triggers popup |
| No MT5 alerts | Cooldown active | Wait for new liquidity sweep |
| Panel shows Skip for all | No session / no bias | Normal outside session or ranging market |
| Compile errors | Missing includes | Copy all `.mqh` files to `MQL5/Include/` |
| Symbol not found | Broker suffix | Use `EURUSD.sim` etc. in `InpSymbols` |
| Webhook OK but no alert | Grade A Strong/B | By design — Vyronis only, no popup |

---

## 8. Verification checklist

Use this checklist to prove end-to-end V1 is working.

### Database

- [ ] `scanner_signals` table exists in Supabase
- [ ] curl POST returns `201` for A+ Sniper payload
- [ ] Row visible: `SELECT pair, grade, status FROM scanner_signals ORDER BY created_at DESC LIMIT 5;`
- [ ] Duplicate POST same `setup_id` returns `200` with `duplicate: true`

### Webhook API

- [ ] `POST /api/webhooks/mt5/scanner` accepts `X-API-Key` header
- [ ] Skip grade returns `422`
- [ ] A Strong returns `201` with `status: watchlist`

### Scanner page (`/scanner`)

- [ ] Badge shows **Live · MT5 scanner** (not "run migration 047")
- [ ] Signal list shows: Pair, Direction, Grade, Session, R:R
- [ ] Signal Details shows: Daily bias, H4 bias, Zone, Sweep, CHoCH, Confirmation, Session
- [ ] A+ Sniper shows **Active** status
- [ ] A Strong / B show **Watchlist** status

### MT5 EA

- [ ] Compiles with 0 errors in MetaEditor
- [ ] Chart panel shows 6 pairs with Bias, Session, State, Last Scan, Grade
- [ ] Experts log: `Vyronis A+ Scanner: monitoring 6 pairs` on attach
- [ ] During session: panel updates `Last Scan` timestamp

### MT5 alerts (A+ Sniper only)

- [ ] Popup contains all fields: PAIR, DIRECTION, GRADE, SCORE, DAILY BIAS, H4 BIAS, ZONE, SWEEP, CHOCH, CONFIRMATION, RR, SESSION
- [ ] Experts log: `Vyronis Scanner ALERT ...`
- [ ] Same setup does not popup twice (cooldown)

### Integration

- [ ] After MT5 alert, signal appears on `/scanner` within 60s
- [ ] `VyronisTradeSync` still works independently (journal unaffected)

**All boxes checked = V1 deployment verified.**

---

## Known V1 limitations

- FVG zones only (no S/D, OB, flip)
- 6 pairs, M15 confirmation, London/NY sessions only
- Alert-only — no auto execution
- Algorithmic structure may differ from manual SMC
- Recommend 2 weeks demo forward test before live reliance

---

*Vyronis A+ Scanner V1 — deployment guide*
