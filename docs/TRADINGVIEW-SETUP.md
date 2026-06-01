# TradingView setup (Vyronis HQ)

Vyronis connects to TradingView through **webhook alerts** — not OAuth or the TradingView API. When your strategy fires on TradingView, Vyronis grades the setup against your **War Room** watchlist and opens **Coach** or **Trade Planner**.

## Prerequisites

1. Run Supabase migrations: `supabase/RUN-TRADINGVIEW-SIGNALS.sql`
2. Production env vars:
   - `NEXT_PUBLIC_APP_URL` — e.g. `https://vyronishq.com`
   - `SUPABASE_SERVICE_ROLE_KEY` — required for inbound webhooks
   - Optional: `OPENAI_API_KEY` (chart vision), `RESEND_API_KEY` (B+ email alerts)

## Step 1 — War Room

1. Open **War Room** (`/war-room`)
2. Set weekly watchlist, pair bias, and AOI status
3. Upload HTF chart screenshots (H4 preferred)

TradingView alerts are graded against this context (A+ / B / C / D).

## Step 2 — Webhook credentials

1. Open **Account Settings** (gear on HQ)
2. Scroll to **TradingView Setup Alerts**
3. Turn **Accept TradingView alerts** on
4. Copy **Webhook URL** and **Secret key**
5. Copy the **alert JSON template**

## Strategy filters (automatic)

Every webhook is validated **before** a trade plan or Coach session is created:

| Filter | Rule | On fail |
|--------|------|---------|
| Session | London **2–5am ET** or New York **8am–12pm ET** | Silent reject (logged only) |
| Timeframe | **M15** only (`15`, `M15`, `15m`) | Silent reject (logged only) |
| Bias | Alert direction must match War Room watchlist bias | Bell: `⚠️ Against bias - skipped` |

When all filters pass:

- Grade **A+**
- Trade plan created (when entry, SL, TP are present)
- Coach session created
- Bell message: `🔥 A+ SETUP: {symbol}`

All webhooks are stored in **`tradingview_signals_log`** with pass/fail reason (run `supabase/033-tradingview-signals-log.sql`).

## Step 3 — Create the TradingView alert

1. In TradingView, open your chart and create an alert on your strategy/condition
2. Under **Notifications**, enable **Webhook URL**
3. Paste the Vyronis webhook URL
4. In **Message**, paste the JSON template from settings (includes your secret)
5. Replace placeholders or keep TradingView variables like `{{ticker}}`, `{{close}}`

Example fields Vyronis reads:

| Field | Purpose |
|-------|---------|
| `symbol` | Pair (e.g. `EURUSD`) |
| `direction` | `BUY` or `SELL` |
| `entry_zone` | Entry price or zone |
| `stop_loss` | Stop loss price |
| `take_profit` | Take profit price |
| `strategy_name` | Your setup name |
| `timeframe` | Chart interval |

TradingView cannot attach chart images. Upload screenshots in War Room — Vyronis runs vision on alerts using those uploads.

## Step 4 — Test without TradingView

In Account Settings:

- **Test best pair** — uses a pair from your watchlist
- **Test GBPCAD** — fixed smoke test

Check the **bell icon** (top right) for the graded alert.

## What happens when an alert fires

1. Alert saved to your **Setup Alerts** inbox (bell)
2. Graded vs watchlist + AOI + HTF bias
3. Pre-trade **Coach** session created automatically
4. From the bell: **Coach** (review with AI) or **Plan** (open Trade Planner with entry/SL/TP prefilled)
5. After you log the trade in Journal, the signal links to your journal entry for learning

## Pause webhooks

Use **Accept TradingView alerts** in Account Settings. Your URL and secret stay the same — alerts are ignored while paused.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Settings show migration error | Run `supabase/RUN-TRADINGVIEW-SIGNALS.sql` |
| Real alerts never arrive | Confirm `SUPABASE_SERVICE_ROLE_KEY` on server; secret in alert JSON matches settings |
| Grade always low | Update War Room watchlist, bias, and chart uploads |
| No chart vision | Set `OPENAI_API_KEY`; upload War Room screenshots |
| Wrong webhook URL | Set `NEXT_PUBLIC_APP_URL` to your live domain |

## Security

- Each user has a unique webhook secret
- Vyronis **never places trades** from TradingView webhooks
- Regenerate secret in settings if it is ever exposed
