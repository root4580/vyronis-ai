# Vyronis London Breakout EA (MT5)

Demo-only research EA for Vyronis Research Lab CSV import.

## Install

1. Copy `experts/Vyronis_LondonBreakout_EA.mq5` to:
   `MetaTrader 5/MQL5/Experts/`
2. Open MetaEditor → compile (F7).
3. Attach to **EURUSD M15** on a **demo** account.
4. Enable **Algo Trading** in MT5.

## Vyronis setup

1. Research Lab → create strategy **London Breakout EA**
2. Set magic number: **92601001**
3. After trades run, export MT5 Account History as CSV
4. Import at `/research-lab/import`

## Safety

- Refuses to run on live accounts (`RequireDemoAccount = true`)
- Magic: `92601001`
- Comments: `Vyronis-LBO|BUY|range=...` for CSV traceability
