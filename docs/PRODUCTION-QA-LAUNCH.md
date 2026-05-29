# Vyronis HQ — Production QA & Launch Status

## Live deployment

| Field | Value |
|-------|--------|
| **Status** | **LIVE** |
| **Production URL** | https://vyronishq.com |
| **Vercel project** | `vyronis-ai` |
| **GitHub repo** | `root4580/vyronis-ai` · branch `main` |
| **Latest deploy** | `d1226b5` — auth reset redirect fix + unified Analytics shell |
| **Supabase project** | `jjdxodqipdjfkjanjywf` (shared with local `.env.local`) |
| **Launch date** | 2026-05-27 |

**Canonical URL for testers:** https://vyronishq.com  
Do **not** use preview URLs (`*.vercel.app` deployment hashes) or the deleted duplicate project.

Primary: `https://vyronishq.com`. Legacy Vercel URLs may still redirect to the same deployment.

---

## Pre-flight (ops — one time)

Run before inviting external testers.

- [ ] Vercel **Production** env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL=https://vyronishq.com`
- [ ] Vercel **Production** env: `AI_PROVIDER`, `OPENAI_API_KEY` (if AI coach/vision enabled)
- [ ] Supabase **Site URL** = `https://vyronishq.com`
- [ ] Supabase **Redirect URLs** include `https://vyronishq.com/auth/callback` + `http://localhost:3000/auth/callback`
- [ ] Supabase migrations run (minimum set in `CLOSED-BETA-DEPLOY-CHECKLIST.md` §4)
- [ ] Vercel deployment **Ready** on latest `main` commit
- [ ] SSO / deployment protection **disabled** for public beta access
- [ ] Vyronis email templates pasted (`docs/SUPABASE-VYRONIS-BRANDING.md`) — recommended

---

## Final production QA checklist

Test on **https://vyronishq.com** in **incognito**. Use two separate test accounts (Account A, Account B).

### A. Auth & session

| # | Test | Pass |
|---|------|------|
| A1 | `/` logged out → redirects to `/auth/login` | ☐ |
| A2 | `/analytics` logged out → redirects to login | ☐ |
| A3 | Sign up (new email) → lands on dashboard or confirmation flow | ☐ |
| A4 | Sign in (existing user) → dashboard loads, no login loop | ☐ |
| A5 | **Forgot password** → email received (check spam) → reset link works | ☐ |
| A6 | Logout → `/auth/login`; refresh `/` → still logged out | ☐ |
| A7 | Account A logout → Account B login → **no flash** of A's data | ☐ |

### B. Navigation & shell

| # | Test | Pass |
|---|------|------|
| B1 | Top nav: Dashboard · Strategies · Analytics · Journal — same header on all | ☐ |
| B2 | Analytics page uses same Vyronis shell (not separate app header) | ☐ |
| B3 | Mobile nav pills work (resize or device mode) | ☐ |
| B4 | `/profile` loads from header/settings | ☐ |
| B5 | `/strategy` playbook page loads | ☐ |

### C. Dashboard & profile

| # | Test | Pass |
|---|------|------|
| C1 | Stats cards show balance, P&L, win rate (or defaults for new user) | ☐ |
| C2 | User profile bar shows name **or** email (no “Profile table missing” toast) | ☐ |
| C3 | `/profile` → save first/last name → dashboard shows name | ☐ |
| C4 | Account settings modal saves (starting balance, max risk, prop size) | ☐ |
| C5 | Primary Leak Card visible (“Building profile” or detected leak) | ☐ |
| C6 | Daily Ritual strip visible; check-in interaction works | ☐ |
| C7 | Dashboard loads within ~10s (no infinite skeleton) | ☐ |

### D. Journal & trades

| # | Test | Pass |
|---|------|------|
| D1 | Journal tab → trade list loads | ☐ |
| D2 | Log new trade (pair, direction, result, P&L, emotion, session) → saves | ☐ |
| D3 | Edit trade → changes persist | ☐ |
| D4 | Delete trade → removed from list | ☐ |
| D5 | Repeat last trade pre-fills prior setup | ☐ |
| D6 | Risk guard banner shows when applicable | ☐ |
| D7 | Screenshot upload attaches to trade (if storage migration run) | ☐ |
| D8 | Trade details modal opens; coach/learning panels load | ☐ |

### E. Analytics

| # | Test | Pass |
|---|------|------|
| E1 | `/analytics` → metrics, equity curve, setup/emotion charts (or empty state) | ☐ |
| E2 | Weekly AI Review panel loads | ☐ |
| E3 | Print/export weekly review opens print dialog | ☐ |
| E4 | Analytics trust label: **Journal rules** or **AI-assisted** (matches env keys) | ☐ |

### F. Coach & strategy (if migrations + API keys enabled)

| # | Test | Pass |
|---|------|------|
| F1 | Pre-trade coach modal opens from ritual or journal | ☐ |
| F2 | Planned trade flow: start plan → continue → link to logged trade | ☐ |
| F3 | Coach feedback generates (AI or heuristic fallback) | ☐ |
| F4 | `/strategy` → create/save playbook → coach references rules | ☐ |
| F5 | Learning / trade memory panel loads on dashboard Analytics tab | ☐ |

### G. Security & isolation

| # | Test | Pass |
|---|------|------|
| G1 | Two accounts: trades/settings never cross over | ☐ |
| G2 | Direct API routes return 401 without session | ☐ |
| G3 | No `SUPABASE_SERVICE_ROLE_KEY` exposed in client bundle | ☐ |

### H. Error & edge cases

| # | Test | Pass |
|---|------|------|
| H1 | Invalid login shows clear error (not silent fail) | ☐ |
| H2 | Expired reset link shows “Link expired” with retry path | ☐ |
| H3 | Trade save with missing migration shows actionable toast (not crash) | ☐ |
| H4 | Hard refresh on dashboard preserves session | ☐ |

---

## Launch sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Deploy verified | — | 2026-05-27 | ☑ LIVE |
| Auth QA | | | ☐ |
| Journal QA | | | ☐ |
| Analytics QA | | | ☐ |
| Two-account isolation | | | ☐ |

**Go / no-go:** **GO** for closed beta on production URL above, with known post-launch items below.

---

## Related docs

- Deploy runbook: `CLOSED-BETA-DEPLOY-CHECKLIST.md`
- Local vs prod parity: `VERCEL-LOCAL-PARITY.md`
- Vyronis auth email branding: `SUPABASE-VYRONIS-BRANDING.md`
- DB migrations: `supabase/MIGRATION_ORDER.md`

---

## Top 5 post-launch priorities

Ordered by user impact and known beta friction from launch week.

### 1. Reliable auth email delivery (Custom SMTP + Vyronis templates)

**Why:** Password reset and signup emails are unreliable on Supabase default mail (spam, rate limits, preview URL confusion).  
**Do:** Enable Custom SMTP (Resend/SendGrid), sender name **Vyronis HQ**, paste templates from `SUPABASE-VYRONIS-BRANDING.md`.  
**Done when:** Reset email lands in Gmail inbox within 2 minutes on production URL.

### 2. Unified app shell on Strategy + Profile routes

**Why:** Analytics now matches the dashboard shell; `/strategy` and `/profile` still feel like separate pages (back links, no shared nav).  
**Do:** Wrap in `DashboardAppShell` + route-aware nav (same pattern as Analytics unification).  
**Done when:** All main sections share one top nav without “Back to Dashboard” dead-ends.

### 3. Production onboarding for empty accounts

**Why:** New users see empty stats, “Building profile” leak, and no guided first trade — high drop-off risk.  
**Do:** First-run empty state on dashboard/journal with one CTA: “Log your first trade” + 60-second ritual explainer.  
**Done when:** New signup completes first trade without confusion in under 3 minutes unaided.

### 4. Preview / env hardening

**Why:** Preview deploys lacked `NEXT_PUBLIC_APP_URL`; auth emails and redirects can break when testing non-production URLs.  
**Do:** Set `NEXT_PUBLIC_APP_URL` on all Preview envs; add in-app banner when hostname ≠ production.  
**Done when:** Forgot-password from any Vercel URL sends link to `vyronis-ai.vercel.app`.

### 5. Performance & journal scale (500+ trades)

**Why:** Documented beta limit — large journals may slow dashboard load and journal filters.  
**Do:** Paginate journal table, lazy-load analytics charts, cache trade aggregates server-side or in DB views.  
**Done when:** 500-trade test account loads dashboard < 5s on production.

---

*Last updated: 2026-05-27 · Vyronis HQ closed beta*
