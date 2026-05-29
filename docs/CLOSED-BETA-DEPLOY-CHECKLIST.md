# Vyronis 1.0 — Closed Beta Launch Runbook

Concise step-by-step guide. Complete in order.

---

## 1. Environment variables (Vercel)

**Project:** `vyronis-ai`  
**Production URL:** `https://vyronishq.com`

**Path:** Vercel → Project → Settings → Environment Variables → **Production**

| Variable | Required | Example / values |
|----------|----------|------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | `https://xxxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | Supabase anon public key |
| `NEXT_PUBLIC_APP_URL` | **Yes** | `https://vyronishq.com` (no trailing `/`) |
| `OPENAI_API_KEY` | No | Only if AI narrative/vision enabled |
| `AI_PROVIDER` | No | `openai` · `claude` · `gemini` · `heuristic` |
| `CHART_VISION_PROVIDER` | No | Usually same as `AI_PROVIDER` |
| `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET` | No | Default: `trade-screenshots` |

**Never add** `SUPABASE_SERVICE_ROLE_KEY` to Next.js env.

**Steps:**
1. Add each variable for **Production** (and Preview if you test preview URLs).
2. Save.
3. Redeploy (Deployments → … → Redeploy) so vars apply.

---

## 2. Supabase Auth redirect setup

**Path:** Supabase Dashboard → **Authentication** → **URL Configuration**

| Field | Value |
|-------|--------|
| **Site URL** | Same as `NEXT_PUBLIC_APP_URL` |
| **Redirect URLs** | `https://vyronishq.com/auth/callback` |
| | `http://localhost:3000/auth/callback` (local dev only) |

Password reset emails use `/auth/callback?next=/auth/reset-password` — the callback URL above covers this flow.

**Password reset email not arriving?**
1. Use **production** only: `https://vyronishq.com/auth/forgot-password` (not a `*.vercel.app` preview URL).
2. Supabase → **Authentication** → **Users** — confirm the email exists in this project.
3. Check **spam/promotions**; Supabase default mail can take 5–10 minutes.
4. Supabase → **Authentication** → **Logs** — look for `user.recovery` or mail errors (free tier: ~4 auth emails/hour).
5. For reliable delivery, configure **Custom SMTP** (Resend, SendGrid, etc.) under Authentication → SMTP.

**Steps:**
1. Set **Site URL** to your production Vercel URL.
2. Under **Redirect URLs**, add production callback (and localhost for dev).
3. Click **Save**.
4. Confirm **Email** provider enabled if using password auth (Authentication → Providers).
5. **Login fails with “Email not confirmed”** → Authentication → Providers → Email → disable “Confirm email” for closed beta, or have the user click the confirmation link first.
6. **Localhost works but Vercel login fails** → Vercel env must use the **same** Supabase project where the account was created (or sign up again on the production URL).

**Vyronis-branded auth emails:** see **`docs/SUPABASE-VYRONIS-BRANDING.md`** (templates + custom SMTP sender name).

---

## 3. Vercel deployment steps

**Prerequisites:** GitHub repo connected; `main` pushed (includes stabilization commit).

1. Go to [vercel.com](https://vercel.com) → **Add New** → **Project**.
2. Import `vyronis-ai` (or your repo name).
3. Framework: **Next.js** (auto-detected).
4. Root directory: `.` (default).
5. Build command: `npm run build` (default).
6. Install command: `npm install` (default).
7. Add env vars from **Section 1** before first deploy.
8. Click **Deploy**.
9. Wait for build success (green).
10. Copy deployment URL → set as `NEXT_PUBLIC_APP_URL` if not set → **Redeploy once**.
11. (Optional) Add custom domain → update Supabase Site URL + Redirect URLs → redeploy.

---

## 3b. Local vs Vercel feature gap

If localhost has features Vercel does not, read **`docs/VERCEL-LOCAL-PARITY.md`**.

**Use only:** `https://vyronishq.com`

---

## 4. Supabase migrations (before inviting users)

**Path:** Supabase → **SQL Editor** → New query

Run files in order from `supabase/MIGRATION_ORDER.md`. Minimum for beta:

1. `trades-migration.sql`
2. `trade-fields-migration.sql`
3. `007-setup-score-columns.sql`
4. `008-weekly-reviews.sql`
5. `trade-coach-migration.sql` (if using coach)
6. `user-settings-migration.sql`
7. **`user-profiles-migration.sql`** — required for profile name on dashboard; without it you see “Profile table missing”
8. `storage-setup.sql`
9. `trade-memory-migration.sql` (learning panel)
10. `strategy-playbooks-migration.sql` (`/strategy` page)
11. Coach chart stack (`chart-vision-ai-migration.sql`, etc.) — only if using vision coach

**Full order:** `supabase/MIGRATION_ORDER.md`

Existing production DB: run repair `001` → `004` first per `MIGRATION_ORDER.md`.

---

## 5. Post-deploy verification checklist

Run on **production URL** with a real test account.

- [ ] Open `/` logged out → redirects to `/auth/login`
- [ ] Open `/analytics` logged out → redirects to login
- [ ] Sign up or sign in → lands on dashboard
- [ ] Stats / journal load within ~10s (no endless skeleton)
- [ ] Log one trade → saves and appears in journal
- [ ] Primary Leak Card visible (building state or leak)
- [ ] Daily ritual strip visible; check-in works
- [ ] Repeat last trade loads prior setup
- [ ] Logout → login page; no dashboard data visible
- [ ] **Second account:** login different user → **no flash of first user’s trades**
- [ ] Weekly review opens; Print review opens print dialog
- [ ] Screenshot upload works (if using charts)
- [ ] `/profile` saves name
- [ ] `/strategy` loads (if coach enabled)

---

## 6. Closed beta testing checklist

Give testers this short list. Use 2 test accounts yourself first.

### Onboarding
- [ ] Sign up with email/password
- [ ] First dashboard load feels calm (not broken/errors)
- [ ] Understand: journal-first, not live signals

### Daily discipline loop
- [ ] Complete check-in emotion
- [ ] Open pre-trade coach (or skip)
- [ ] Log at least 2 trades with session + emotion + result
- [ ] Debrief shows one corrective focus
- [ ] Repeat-last trade saves correctly

### Trust / honesty
- [ ] Weekly review badge says **Journal rules** or **AI-assisted** (not fake “GPT” if no key)
- [ ] Primary leak message feels specific to *their* tags
- [ ] No SQL migration errors shown in normal use

### Account safety
- [ ] Logout on shared computer → next person cannot see trades
- [ ] Two accounts on same browser (logout between) → data isolated

### Known beta limits (tell testers)
- Chart screenshots may be viewable if someone has the direct URL
- Large journals (500+ trades) may feel slower
- Coach without API keys uses rule-based analysis

### Feedback to collect
- Did the **one primary leak** feel accurate?
- Was daily ritual under 2 minutes?
- Anything feel “generic AI” or “broken”?
- Would they use it tomorrow?

---

## 7. Rollback

- **App:** Vercel → Deployments → previous deployment → **Promote to Production**
- **Env:** Revert variables → Redeploy
- **DB:** Do not drop tables; migrations are additive

---

**Sign-off**

See **`docs/PRODUCTION-QA-LAUNCH.md`** for live status, full QA matrix, and post-launch priorities.

| Field | Value |
|-------|--------|
| Production URL | https://vyronishq.com |
| Status | **LIVE** (2026-05-27) |
| Migrations verified | ☐ |
| Two-account test passed | ☐ |
