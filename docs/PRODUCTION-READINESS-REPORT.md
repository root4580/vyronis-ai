# Vyronis AI — Production Readiness Report

**Date:** 2026-05-27  
**Production URL:** https://vyronis-ai.vercel.app  
**Vercel project:** `vyronis-ai`  
**Supabase project:** `jjdxodqipdjfkjanjywf`  
**Latest deploy:** commit after QA sweep (safe fixes applied)

---

## Executive summary

Vyronis AI is **ready for closed beta** with manual Supabase dashboard steps completed (Resend SMTP + email templates + migrations). Core journal, auth, and analytics flows are functional on production. Protected routes, session middleware, and env validation are working.

**Blockers before wide external launch:** Resend SMTP in Supabase (password reset / verification delivery), confirm all SQL migrations applied on production DB, unify shell UX across home vs `/analytics`.

---

## Critical issues (fix before external users)

| # | Area | Issue | Status | Action |
|---|------|-------|--------|--------|
| C1 | Auth email | Default Supabase SMTP is unreliable; reset/verify emails may not arrive | **Manual** | Enable Resend SMTP per [`SUPABASE-RESEND-SETUP.md`](./SUPABASE-RESEND-SETUP.md) |
| C2 | Database | Migrations 005/006/008 may be missing on prod (trade insert default, coach feedback upsert, weekly_reviews table) | **Verify in Supabase** | Run repair SQL if not applied — see checklist below |
| C3 | Deployment | `NEXT_PUBLIC_APP_URL` set on **Production only** — Preview deploys crash or leak preview URLs in emails | **Open** | Add `NEXT_PUBLIC_APP_URL=https://vyronis-ai.vercel.app` to Vercel Preview env, or disable preview auth testing |
| C4 | UI | Home page does not use `DashboardAppShell` — analytics page lacks FAB, profile bar, logout parity | **Deferred refactor** | See “Refactors requiring approval” |

---

## High priority (should fix soon)

| # | Area | Issue | Status |
|---|------|-------|--------|
| H1 | Analytics | Duplicate analytics surface on home (`activeTab === "analytics"`) causes flash before redirect to `/analytics` | Open |
| H2 | Analytics | Two weekly review backends: `weekly_reviews` (Analytics) vs `ai_reviews` (Learning panel) | Open |
| H3 | Analytics | Emotion charts count pre-trade `emotion` only — `emotion_after` ignored | Open |
| H4 | Database | Partial migration → weekly debrief API 500 on missing quality columns (learning path) | **Mitigated** in weekly-review service (column fallback added) |
| H5 | Auth | Signup/callback profile upserts fail silently if `user_profiles` migration missing | Open — run `user-profiles-migration.sql` |

---

## Medium priority

| # | Area | Issue |
|---|------|-------|
| M1 | Journal | Schema fallback on save silently drops extended fields if migrations missing |
| M2 | Coach | Deprecated session columns still dual-written (`chart_url`, etc.) |
| M3 | Settings | Home opens account modal; `/analytics` navigates to `/profile` — inconsistent |
| M4 | Auth | Dashboard bootstrap uses `getSession()` vs middleware `getUser()` |
| M5 | UI | Hardcoded notification badge `"3"` in header |
| M6 | Docs | Repair migrations 005/006 not listed in `MIGRATION_ORDER.md` |

---

## Low priority / polish

- Min password length 6 only (client-side)
- Ritual check-in emotion (localStorage) not linked to trade form
- Recharts 0×0 dimension warnings on first paint (cosmetic)
- `Greed` in risk guard but not in emotion picker
- Journal table has no emotion column (visible only in detail modal)

---

## QA results by area

### 1. Authentication ✅ (with manual email config)

| Test | Result | Evidence |
|------|--------|----------|
| Protected `/` → login | ✅ Pass | HTTP 307 → `/auth/login?next=%2F` |
| Protected `/analytics` → login | ✅ Pass | HTTP 307 → `/auth/login?next=%2Fanalytics` |
| Login page loads | ✅ Pass | HTTP 200 |
| Signup + verify flow | ✅ Code complete | `/auth/sign-up`, `/auth/verify-email`, resend cooldown |
| Forgot password | ✅ Code complete | Canonical redirect via `getPasswordResetRedirectUrl()` |
| Reset password | ✅ Code complete | PKCE exchange + `PASSWORD_RECOVERY` handler |
| Logout | ✅ Code complete | Cache clear + server signOut with timeout |
| Session persistence | ✅ Middleware refreshes cookies on every request |
| Protected API routes | ✅ All 27 routes return 401 without user |

**Automated:** `npm run test:auth` — passed

### 2. Database ⚠️ (verify migrations on prod)

**Migration inventory:** 23 SQL files in `supabase/` (greenfield + repair chain).

**Production verification SQL** (run in Supabase SQL Editor):

```sql
-- trades.id default (005)
SELECT column_default FROM information_schema.columns
WHERE table_name = 'trades' AND column_name = 'id';

-- coach feedback upsert (006)
SELECT conname FROM pg_constraint
WHERE conname = 'trade_coach_feedback_trade_id_key';

-- weekly_reviews (008)
SELECT to_regclass('public.weekly_reviews');

-- user_profiles
SELECT to_regclass('public.user_profiles');

-- RLS enabled
SELECT relname, relrowsecurity FROM pg_class
WHERE relname IN ('trades','user_profiles','weekly_reviews','trade_coach_sessions');
```

**RLS:** Enabled on all user-facing tables; app uses authenticated client (RLS enforced).

**Known risks:** Dual weekly review tables; deprecated coach columns still in code.

### 3. Journal flow ✅

| Test | Result |
|------|--------|
| Create trade | ✅ Supabase insert with setup score + extended fields |
| Edit trade | ✅ Update with form pre-fill |
| Delete trade | ✅ Scoped by `user_id`; **fixed:** clears selected trade + refreshes learning panel |
| Analytics update | ✅ Re-fetch after save/delete |
| Emotional tagging | ✅ Before + after in form; analytics chart uses before only |

### 4. Analytics ✅ (with UX gaps)

| Test | Result |
|------|--------|
| Charts render | ✅ Per-chart empty states; global empty when no trades |
| Weekly review | ✅ `/api/weekly-reviews` + panel on `/analytics` |
| Console errors | ✅ No build-time errors; dev-only dashboard logs gated |
| Deep link from review | ✅ **Fixed:** analytics weekly review → `/?tab=journal&trade=ID` |

### 5. Navigation / UI ⚠️

| Test | Result |
|------|--------|
| Mobile auth pages | ✅ `100dvh`, 48px touch targets |
| Dark theme | ✅ Consistent cyan/dark shell |
| Unified nav | ⚠️ Header tabs work; shell/layout differs home vs analytics |
| Broken links | ✅ No broken auth or nav links found |

### 6. Deployment safety ✅

| Check | Result |
|-------|--------|
| Production URL | ✅ https://vyronis-ai.vercel.app |
| `NEXT_PUBLIC_APP_URL` on Production | ✅ Set in Vercel |
| Supabase keys on Production | ✅ Set |
| Localhost in runtime TS | ✅ Dev fallback only; `assertProductionEnv()` blocks localhost in prod |
| Preview URL leak in emails | ✅ **Fixed:** removed `window.location.origin` fallback for auth email redirects |
| Build | ✅ `npm run build` passed |
| TypeScript | ✅ `tsc --noEmit` passed |

### 7. Performance ✅ (no blockers)

| Check | Result |
|-------|--------|
| Slow queries | No N+1 detected in trade fetch; analytics re-fetches independently |
| Hydration | ✅ **Fixed:** journal filters read sessionStorage after mount |
| React warnings | Login wrapped in Suspense for `useSearchParams` |
| Loading states | Auth, analytics skeleton, trade modals, reset password phases |

---

## Safe fixes applied in this QA sweep

1. Auth callback → `/auth/error?reason=exchange_failed` on failed code exchange
2. Auth email redirects never use preview `window.location.origin`
3. Login preserves `?next=` through sign-up / forgot-password links
4. Resend success message context-aware (verify vs reset)
5. Delete trade clears open detail + refreshes learning panel
6. Journal filter hydration fix (no SSR/client mismatch)
7. Dashboard shows loading state instead of blank screen while auth resolves
8. Analytics weekly review deep-links to journal trade detail
9. Weekly review service column fallback for partial migrations
10. Dashboard debug logs gated to development only

---

## Refactors requiring approval (do not auto-apply)

These are larger changes — confirm before implementing:

1. **Unify `DashboardAppShell`** across `/`, `/analytics`, `/strategy`, `/profile` (FAB, profile bar, logout, settings modal)
2. **Remove dead analytics tab** JSX from `app/page.tsx` (~90 lines)
3. **Consolidate weekly reviews** — migrate Learning panel from `ai_reviews` to `weekly_reviews` (or rename UX)
4. **Extend emotion analytics** to include `emotion_after` / before→after deltas
5. **Drop deprecated coach columns** — requires migration + code refactor after dual-write period

---

## Pre-invite checklist (operator)

- [ ] Resend SMTP enabled in Supabase
- [ ] Branded email templates pasted (`supabase/email-templates/`)
- [ ] Site URL + redirect URLs = `https://vyronis-ai.vercel.app/auth/callback`
- [ ] Run migration verification SQL above
- [ ] Sign up on production URL (not preview) in incognito
- [ ] Create → edit → delete a trade
- [ ] Generate weekly review on `/analytics`
- [ ] Test forgot password end-to-end

---

## Automated test commands

```bash
npm run test:auth
npx tsc --noEmit
npm run build
```

---

## Sign-off

| Gate | Status |
|------|--------|
| Closed beta (invited users) | **GO** after C1 + C2 manual steps |
| Public launch | **NO-GO** until C4 shell unification + H1–H3 addressed |
