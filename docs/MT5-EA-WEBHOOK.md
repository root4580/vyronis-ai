# MT5 EA → Vyronis Trade Webhook

Automatically sync **closed** MetaTrader 5 trades into your Vyronis journal with AI analysis — no CSV export step.

## 1. Database setup

Run in Supabase → SQL Editor (in order):

```text
supabase/023-mt5-trade-webhook.sql
supabase/024-mt5-sync-status.sql
```

## 2. Environment (Vercel / `.env.local`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY` | Yes | Server webhook ingest (never expose to EA) |
| `NEXT_PUBLIC_APP_URL` | Production | Canonical URL, e.g. `https://vyronishq.com` |

## 3. Get your API key

While logged into Vyronis:

- Open **Trade Journal** → **MT5 Connection** panel → **Copy API key**
- Or **GET** `/api/mt5/settings` (returns `apiKey`, `webhookUrl`, `connection`, `lastSyncAt`)
- **POST** `/api/mt5/settings` with `{ "regenerateApiKey": true }` — rotates key

Store the key in the EA inputs only (never commit to git).

## 4. Install VyronisTradeSync EA

### Copy files

| Source | Destination (MT5 data folder) |
|--------|-------------------------------|
| `mt5/experts/VyronisTradeSync.mq5` | `MQL5/Experts/` |
| `mt5/include/VyronisTradeWebhook.mqh` | `MQL5/Include/` |

**macOS example:** `~/Library/Application Support/MetaQuotes/Terminal/<HASH>/MQL5/`

### Compile

1. Open **MetaEditor** (F4 from MT5).
2. Open `VyronisTradeSync.mq5` → **Compile** (F7). Fix any include path errors.

### Attach to chart (once)

1. Enable **Algo Trading** (toolbar).
2. Drag **VyronisTradeSync** onto **one** chart only (e.g. EURUSD H1). It watches **all symbols** on the account — do not attach to every pair.
3. Inputs:
   - **InpVyronisWebhookUrl** — `https://vyronishq.com/api/webhooks/mt5/trades` (or `http://localhost:3000/api/webhooks/mt5/trades` for local dev)
   - **InpVyronisApiKey** — from Vyronis MT5 Connection panel
   - **InpSyncHistoryHours** — `72` backfills recent closes on attach (set `0` to disable)
   - **InpMaxRetries** — `3`
4. Allow live trading / DLL if prompted (EA only sends HTTP on close).

### WebRequest URL whitelist (required)

**Tools → Options → Expert Advisors:**

- Enable **Allow algorithmic trading**
- Enable **Allow WebRequest for listed URL**
- Add each host you use (no path, no trailing slash):

| Environment | Add to list |
|-------------|-------------|
| Production | `https://vyronishq.com` |
| Local dev | `http://localhost:3000` |
| Custom domain | `https://your-domain.com` |

Restart MT5 after changing this list. If WebRequest fails, Experts log shows error `4014` and the EA prints a whitelist reminder.

## 5. How it works

1. **OnTradeTransaction** — when MT5 adds a closing deal (`DEAL_ENTRY_OUT` / `OUT_BY`), the EA builds a JSON payload and POSTs to Vyronis.
2. **Backfill** — on attach, optional scan of last N hours of closed deals (skips tickets already synced this terminal session).
3. **Dedupe** — terminal uses `GlobalVariable` prefix `VYRONIS_SYNC_`; server dedupes by `ticket` + `import_source=mt5_webhook`.
4. **Retries** — failed HTTP (except 401/403) retries with backoff (default 3 attempts).
5. **Vyronis** — saves trade, runs intelligence (setup score, AI insight, discipline).

### Payload fields

| Field | Description |
|-------|-------------|
| `ticket` | Position ID (preferred) or deal ticket |
| `symbol` | e.g. `EURUSD` |
| `direction` | `BUY` / `SELL` |
| `open_price` | Entry price |
| `close_price` | Exit price |
| `volume` | Lot size |
| `sl` / `tp` | Stop loss / take profit |
| `profit` | Net P&L (profit + commission + swap) |
| `open_time` / `close_time` | `YYYY.MM.DD HH:MM:SS` |
| `commission`, `swap`, `magic`, `comment`, `account_login`, `broker` | Optional metadata |

## 6. Endpoint

| | |
|--|--|
| **URL** | `POST {APP_URL}/api/webhooks/mt5/trades` |
| **Auth** | `X-API-Key: <key>` or `Authorization: Bearer <key>` or `"api_key"` in JSON |
| **Content-Type** | `application/json` |

### Success

- **201** — new trade saved + AI pipeline run
- **200** — duplicate ticket skipped

Response includes `pipeline` stages: `auth`, `normalize`, `supabase_save`, `journal_calendar`, `intelligence_sync`, `setup_score`, `ai_insight`, `discipline_metrics`.

## 7. Dashboard status

Trade Journal sidebar (**MT5 Connection**):

- **Connection indicator** — Connected / Waiting / Error / Disabled
- **Last MT5 Sync** — time, ticket, status message
- **Copy API key** / **Rotate key**

Refreshes every 30s; closing a trade in MT5 should appear within seconds after sync.

## 8. Verify without MT5

```bash
npm run mt5:check-env
npm run mt5:quick-test   # dev only — creates a fake trade
```

Remove test trades:

```bash
npx tsx scripts/cleanup-mt5-test-trades.ts
```

Production validation: close one real demo trade with EA attached, confirm journal + intelligence panel.

## 9. Security

- **HTTPS** only in production.
- Rotate API keys if leaked.
- Never embed `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SECRET_KEY` in MQ5.
- Prefer **demo accounts** until fully validated.

## 10. Journal vs Research Lab

| `import_source` | Appears in |
|-----------------|------------|
| `mt5_webhook` | Trade Journal (calendar + list) |
| `mt5_csv` | Research Lab only |

Optional `research_strategy_id` in JSON links to a Research Lab strategy UUID.

## 11. Troubleshooting

| Symptom | Fix |
|---------|-----|
| EA alert: invalid API key | Copy key from Vyronis MT5 Connection; no spaces |
| WebRequest error 4014 | Whitelist URL in MT5 options |
| HTTP 401 | Wrong or rotated API key |
| HTTP 503 | Run SQL migrations 023 + 024 |
| Trade missing on calendar | Check `close_time`; Experts → Journal for `trade_date` |
| Duplicate in log, no new row | Expected — same ticket already ingested |
| Last sync never updates | Run `024-mt5-sync-status.sql` |
