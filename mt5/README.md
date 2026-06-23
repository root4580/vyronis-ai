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

## Vyronis_APlus_Scanner (setup alerts)

Precision Flow scanner — session, bias, FVG, liquidity, M15 confirmation, A+ scoring.

| File | Role |
|------|------|
| `experts/Vyronis_APlus_Scanner.mq5` | Attach once — scans 6 pairs, alerts + webhook |
| `include/VyronisScanner*.mqh` | Session, structure, FVG, liquidity, score, webhook, panel |

**Full setup:** [docs/MT5-SCANNER-EA.md](../docs/MT5-SCANNER-EA.md) (deployment + testing)

**Rulebook:** [docs/VYRONIS-APlus-SCANNER-RULEBOOK.md](../docs/VYRONIS-APlus-SCANNER-RULEBOOK.md) · [V1 spec](../docs/VYRONIS-APlus-SCANNER-V1-SPEC.md)
