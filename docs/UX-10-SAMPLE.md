# Vyronis 10/10 UX — Sample walkthrough

This document shows what the **Today-first** dashboard feels like after the 10/10 pass. Use it to review on desktop and iPhone.

---

## Mobile sample (iPhone)

```
┌─────────────────────────────────────┐
│ ⚡ Vyronis AI          LIVE  ⚙ 🔔  │
├─────────────────────────────────────┤
│ Profile bar                         │
├─────────────────────────────────────┤
│ [Balance] [P&L] [Win%] [Risk]       │
│ Shield · Vyronis advises — you exec  │
│ · 5 trades · Synced 11:15 PM        │
├─────────────────────────────────────┤
│ TODAY                    ████░ 2/4  │
│ Run pre-trade coach                 │
│ Multi-timeframe before you execute  │
│ ┌─────────────────────────────────┐ │
│ │   Open Vyronis Coach        →   │ │
│ └─────────────────────────────────┘ │
│ ✓Check-in ●Coach ○Log ○Debrief      │
├─────────────────────────────────────┤
│ PRIMARY BEHAVIORAL LEAK             │
│ Entries without confirmation…       │
│ Corrective focus: …                 │
├─────────────────────────────────────┤
│ ▼ Performance (collapsed)           │
│ ▼ Intelligence (collapsed)          │
├─────────────────────────────────────┤
│ Home · Journal · Coach · Log · Prep · Stats │  ← dock (no header tabs)
└─────────────────────────────────────┘
```

### Expected behavior

1. **Refresh** → always Dashboard (home).
2. **Tap ⚡** → Dashboard.
3. **Tap “Open Vyronis Coach”** → Command Center (pre-trade); ritual step marked.
4. **Tap Coach in dock** → same Command Center entry.
5. **Tap Log** → New trade modal; submit always visible (thumbnail upload).
6. **Tap leak card** → read-only insight; scroll Performance when ritual complete.

---

## Desktop sample

```
Header:  ⚡ Vyronis AI  | Today: Dashboard | Prepare: Strategies | Review: Analytics · Journal

Main:
  Stats row
  Trust strip
  TODAY hero (wide CTA)
  Primary behavioral leak (hero placement)
  Risk guard
  Performance ▼ (expanded by default on lg)
  Intelligence ▼

Floating:  [Vyronis AI] bottom-left   [+ New Trade] bottom-right
```

---

## Daily loop (sample session)

| Time | Action | Screen |
|------|--------|--------|
| 08:00 | Open app | Dashboard → **Complete check-in** |
| 08:05 | CTA → Coach | Command Center, upload 88px chart strip |
| 08:20 | Dock → Log | Add trade modal |
| 16:00 | CTA → Debrief | Inline debrief in Today hero |
| 16:05 | Close session | Ritual 4/4 |

---

## Files touched

- `components/dashboard/today-hero-strip.tsx` — single primary CTA
- `components/dashboard/dashboard-mobile-dock.tsx` — Home · Coach · Log
- `components/dashboard/dashboard-trust-strip.tsx`
- `components/dashboard/collapsible-dashboard-section.tsx`
- `lib/dashboard-today.ts` — CTA logic
- `components/dashboard/trading-components.tsx` — Today / Prepare / Review nav
- `app/page.tsx` — layout order

---

## How to preview locally

```bash
npm run dev
```

Open `http://localhost:3000` — use DevTools → iPhone 14 Pro, or a real device on the same network.

Hard refresh after deploy to clear cached JS.
