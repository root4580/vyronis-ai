# Manual trade journal (primary workflow)

Vyronis is optimized for **manual logging** first. MT5 automation is paused and lives under **Account Settings → MT5 auto-sync (coming later)**.

## Daily flow

1. **Trade Journal** → **New Trade** (or FAB on any tab).
2. Log pair, result, P&L, **emotion**, **setup grade** (A+ default), strategy, screenshot.
3. Tap a calendar day → **Log trade for this day** (date pre-filled).
4. Open a trade → **AI review** + execution replay in the detail modal.

## Mobile

- Calendar day list and **trade cards** on phone (`md` breakpoint).
- Full table on desktop.

## Bulk import

**Import CSV** accepts broker export files (`journal_csv`) — not required for daily use.

## MT5 (future)

- Code: `lib/mt5/`, `app/api/webhooks/mt5/`, `mt5/experts/`
- UI: collapsed in Account Settings only
- No EA setup in the main journal path
