# Vyronis HQ — Review Packet (paste into Claude)

Use this as a single message to Claude for UI/architecture review. Attach screenshots where noted.

---

## Context

**Vyronis HQ** is an AI-assisted trading operating system — not a generic journal. Brand direction: premium, institutional, disciplined. Core stack: Next.js App Router, Supabase auth, Tailwind.

You previously flagged three issues on the live site. **All three are addressed in the current build:**

| Issue | Status | What changed |
|-------|--------|--------------|
| No public landing page | **Fixed** | `/` is a public marketing page. Login moved to `/auth/login`. |
| Visible "Loading…" flash | **Fixed** | Skeleton loaders on auth pages and `/hq`; no bare "Loading…" on main flows. |
| SEO essentially zero | **Fixed** | Public pages indexable; `robots.txt`, `sitemap.xml`, metadata + OpenGraph. |

**Authenticated app home is `/hq`** (not `/`). Logged-in users hitting `/` redirect to `/hq`.

---

## Route map

### Public (indexable)
- `/` — Marketing landing (hero, Precision Flow, AI journal, features, demo preview, pricing placeholder, FAQ)
- `/auth/login` — Sign in (split layout: product context + form)
- `/auth/sign-up` — Create account

### Private (auth required)
- `/hq` — Command center / dashboard shell (`?tab=dashboard|journal|strategies`)
- `/hq?tab=journal` — Trade journal (Plan vs Log modes, Vyronis scoring)
- `/war-room` — Weekly War Room (bias, watchlist, pair plans)
- `/strategy-brain` — Strategy Brain dashboard
- `/analytics` — Discipline analytics + weekly AI review
- `/evolution` — Trader evolution / Vyronis OS intelligence
- `/journal/trade/[id]` — Trade intelligence / case study
- `/profile` — Trader profile settings

---

## Product features to review

### 1. Precision Flow + Vyronis scoring (journal)
- **Plan mode** — Score setup *before* entry; saves planned trade marker, BE / $0 PnL
- **Log mode** — Fast post-trade logging with optional setup details
- **A+ Setup Gate** — Pre-trade checklist mapped to Strategy 1 (FXAlexG-style top-down)
- **Auto grades:** A+ (90+), A (80–89), B (70–79), Skip (<70 or hard block)
- **Hard skip rules:** revenge/impulsive emotion OR missing HTF alignment
- **R:R warning** if below 1:2

Key files:
- `lib/strategy/vyronis-core.ts`
- `lib/scoring/trade-score.ts`
- `lib/strategy/vyronis-journal-bridge.ts`
- `components/dashboard/add-trade-modal.tsx`
- `components/dashboard/vyronis-core-model-fields.tsx`
- `docs/STRATEGY-1-PLUS-CHECKLIST.md`

### 2. War Room
- Weekly market bias, Sunday planning, AOI pair cards, watchlist workflow
- Route: `/war-room`
- Key: `components/journal/weekly-war-room.tsx`

### 3. Analytics & evolution
- Win rate, leak detection, emotion patterns, weekly AI review
- Trader evolution timeline, replay simulator, adaptive cognition
- Routes: `/analytics`, `/evolution`

### 4. Public marketing layer (new)
- Institutional dark UI, cyan accent, JSON-LD structured data
- Key: `components/marketing/landing-page.tsx`, `app/(marketing)/layout.tsx`

---

## Architecture (public vs private)

```
app/
├── (marketing)/          → Public landing at /
│   ├── layout.tsx        → SEO metadata, OG tags
│   └── page.tsx
├── (app)/                → Authenticated shell
│   ├── layout.tsx        → noindex for app routes
│   ├── loading.tsx       → Shared skeleton
│   └── hq/page.tsx       → Main dashboard (was app/page.tsx)
├── auth/                 → Login, sign-up, forgot-password
├── robots.ts
└── sitemap.ts

lib/
├── branding.ts           → APP_HOME_PATH = "/hq"
├── auth-routes.ts        → PROTECTED_PATHS vs public marketing
└── supabase/middleware.ts → Auth redirects
```

**Constants:**
- Public landing: `/`
- App home after login: `/hq`
- Deep links: `/hq?tab=journal&edit=ID`, `/hq?tab=journal&trade=ID`

---

## Screenshot checklist (attach these)

| # | URL / screen | What to show |
|---|--------------|--------------|
| 1 | `/` | Hero + primary CTA ("Access Command Center" / Sign in) |
| 2 | `/` scrolled | Precision Flow section + AI journal explanation |
| 3 | `/auth/login` | Split auth layout (marketing panel + compact form) |
| 4 | `/hq` | Dashboard overview after login |
| 5 | `/hq?tab=journal` → Add Trade | **Plan** tab — Vyronis core fields + A+ Setup Gate |
| 6 | Same modal | **Log** tab — fast post-trade path |
| 7 | After submit | Vyronis score result (grade badge A+/A/B/Skip + reasons) |
| 8 | `/war-room` | Weekly bias + watchlist + pair cards |
| 9 | `/analytics` | Charts / weekly AI review panel |
| 10 | Mobile (375px) | Journal form — sticky submit, no horizontal overflow |

---

## Code snippets (optional — paste if Claude wants architecture review)

**Auth routing:**
```
lib/auth-routes.ts
lib/supabase/middleware.ts
lib/branding.ts          → APP_HOME_PATH = "/hq"
lib/dashboard-nav.ts     → getDashboardTabHref()
```

**Marketing:**
```
app/(marketing)/layout.tsx
app/(marketing)/page.tsx
components/marketing/landing-page.tsx
app/robots.ts
app/sitemap.ts
```

**Journal + scoring:**
```
components/dashboard/add-trade-modal.tsx
lib/trade-journal-mode.ts
lib/scoring/trade-score.ts
supabase/028-vyronis-journal-scoring.sql
```

**Auth UX:**
```
components/auth/auth-page-frame.tsx
components/auth/auth-marketing-panel.tsx
components/auth/auth-shell-skeleton.tsx
app/(app)/hq/loading.tsx
```

---

## What I want feedback on

1. **First impression** — Does `/` feel like a premium trading OS, not a side project?
2. **Auth UX** — Is the login/sign-up flow clear without feeling like a bare dashboard gate?
3. **Journal workflow** — Is Plan vs Log intuitive? Is scoring visible at the right moment?
4. **War Room** — Is weekly planning usable or overwhelming?
5. **Mobile** — Journal form on small screens (sticky footer, touch targets, overflow)
6. **Gaps** — What's missing before this feels launch-ready for serious traders?

---

## Notes for reviewer

- I am **not** sharing live credentials in chat. Review is via **screenshots + this packet** (and optional code paste above).
- Production URL: `https://vyronishq.com` (or run locally: `npm run dev`)
- DB migration `supabase/028-vyronis-journal-scoring.sql` may need to be applied on Supabase for full scoring persistence.
- Brand: **Vyronis** = AI-assisted trading operating system. Not a signal service.

---

## One-line summary

Vyronis HQ separates a **public marketing layer** (`/`) from an **authenticated command center** (`/hq`) with Precision Flow journal scoring, War Room planning, and institutional-grade analytics — built for disciplined, funded, and independent traders.
