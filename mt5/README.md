# Vyronis MT5 Experts

## VyronisTradeSync (production journal sync)

Real-time closed-trade sync to Vyronis via webhook.

| File | Role |
|------|------|
| `experts/VyronisTradeSync.mq5` | Attach to any chart — detects closes, POSTs webhook |
| `include/VyronisTradeWebhook.mqh` | JSON builder, dedupe, retries, WebRequest |

**Full setup:** [docs/MT5-EA-WEBHOOK.md](../docs/MT5-EA-WEBHOOK.md)

Quick steps:

1. Run Supabase `023` + `024` migrations.
2. Copy `.mq5` → `MQL5/Experts/`, `.mqh` → `MQL5/Include/`.
3. Whitelist `https://vyronishq.com` (and `http://localhost:3000` for dev) in MT5 WebRequest list.
4. Copy API key from Vyronis **Trade Journal → MT5 Connection**.
5. Compile, attach EA, enable Algo Trading.

## Vyronis London Breakout EA (research demo)

Demo-only strategy for Research Lab CSV import (`experts/Vyronis_LondonBreakout_EA.mq5`).

- Magic: `92601001`
- Refuses live accounts when `RequireDemoAccount = true`
- CSV import: Research Lab → Import MT5 CSV

For live journal sync, use **VyronisTradeSync** instead of CSV.

## Vyronis_APlus_Scanner (setup alerts) — v1.3

Precision Flow scanner — W+D+H4 bias, FVG/OB/Supply/Demand AOI, liquidity, M15 confirmation, A/A+ only.

| File | Role |
|------|------|
| `experts/Vyronis_APlus_Scanner.mq5` | Attach once — scans 15 pairs, state sync + A/A+ webhook |
| `include/VyronisScanner*.mqh` | Session, structure, zones, liquidity, score, webhook, panel |
| `include/VyronisZones.mqh` | FVG + Order Block + Supply/Demand AOI detection |

**Migrations:** `047-scanner-signals.sql` + `049-scanner-pair-state.sql`

**Webhooks:**
- `POST /api/webhooks/mt5/scanner` — A/A+ live signals only
- `POST /api/webhooks/mt5/scanner/state` — per-pair watchlist sync (every 30s)

**Full setup:** [docs/MT5-SCANNER-EA.md](../docs/MT5-SCANNER-EA.md) (deployment + testing)

**Rulebook:** [docs/VYRONIS-APlus-SCANNER-RULEBOOK.md](../docs/VYRONIS-APlus-SCANNER-RULEBOOK.md) · [V1 spec](../docs/VYRONIS-APlus-SCANNER-V1-SPEC.md)
