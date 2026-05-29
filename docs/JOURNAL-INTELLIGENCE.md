# Journal Intelligence System

Vyronis journal is a **decision and learning workflow**, not a trade history table.

## Modes (Journal tab)

| Mode | Purpose |
|------|---------|
| **Calendar** | Monthly grid — green win days, red loss days, gray no-trade days, daily E/X scores |
| **Analytics** | Drawdown, session, weekday performance |
| **Intelligence** | Pattern memory + links to trade-level analysis |

## Workflow

1. [Weekly War Room](/war-room) — Sunday bias, pairs, AOI, scenarios  
2. [Strategy Brain](/strategy-brain) — AOI status, setup scoring, emotion gate  
3. Command Center — Session guard / chart verdict  
4. Journal — Log trade with screenshot + emotion  
5. Post-trade review — Strategy Brain  
6. Pattern memory — Intelligence mode + trade detail page  

## Routes

- `/war-room` — **Mission control** — HTF bias, session plan, pair cards, AOI status, thesis, HTF screenshots (human-controlled)  
- `/strategy-brain` — AOI monitor + setup evaluator (advisory, no auto-entry)  
- `/journal/trade/[id]` — **Trade case study** — 8 structured sections + fingerprint memory  
- `/?tab=journal` — Decision journal hub  

## Setup fingerprints

Each synced trade stores a fingerprint in `trade_memory.metadata.setup_fingerprint`:

- pair, structure type, confirmation quality, emotion, session, result, mistakes  

Intelligence mode and the case study page compare current setups to prior wins/losses.

## Database

- `026-strategy-brain-foundation.sql` — plans, pair AOI, evaluations  
- `027-war-room-extension.sql` — session_focus, expected_scenarios, screenshot_urls  

## APIs

- `GET/PUT /api/strategy-brain/weekly-plan`  
- `GET /api/strategy-brain/dashboard`  
- `GET/POST /api/intelligence/trades/[tradeId]`  
