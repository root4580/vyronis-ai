# Vercel vs localhost — why features are missing

Vyronis does **not** auto-sync database or config to Vercel. Local (`127.0.0.1`) and production are only the same when **all three** match:

1. **Same git deployment** (latest `main` on Vercel)
2. **Same Supabase project** (Vercel env vars = your local `.env.local` URLs/keys)
3. **Same migrations run** on that Supabase project

If any of these differ, Vercel will look “broken” or “missing features” while localhost works.

**Quick deploy checklist:** see [`DEPLOY-CHECKLIST.md`](./DEPLOY-CHECKLIST.md). The same list appears in **Account Settings** in the app.

---

## Feature parity matrix

| Feature | Needs on Vercel | If missing, you see… |
|--------|------------------|----------------------|
| Login / sign-up | Env vars + Auth URL config | Invalid credentials, login loop, or 500 |
| Forgot / reset password | Latest deploy (`80439cf+`) + Auth redirect URLs | No link on login or reset fails |
| Profile name | `user-profiles-migration.sql` | “Profile table missing” toast |
| Account settings (balance, prop size) | `user-settings-migration.sql` | Defaults only; save errors |
| Trade journal + stats | `trades-migration.sql` | Empty dashboard, load errors |
| Extended trade fields (SL/TP, notes) | `trade-fields-migration.sql` | Toast about extended columns |
| Setup score (A+/B/C) | `007-setup-score-columns.sql` | Scoring disabled on save |
| Primary leak + daily ritual | Trades + settings (above) | “Building profile” forever with 0 trades |
| Repeat last trade | Trades (above) | Button disabled / no prior trade |
| Pre-trade AI coach | `trade-coach-migration.sql` + optional coach migrations | Coach unavailable toast |
| Chart / MTF vision coach | Coach + `chart-vision-ai-migration.sql` etc. | Text-only coach |
| Weekly review + print export | `008-weekly-reviews.sql` | Review fails or empty |
| Strategy playbooks (`/strategy`) | `strategy-playbooks-migration.sql` | Page error / migration hint |
| Learning / trade memory panel | `trade-memory-migration.sql` | “Learning engine unavailable” |
| Screenshot upload | `storage-setup.sql` + bucket env | Upload fails |
| AI narrative (weekly, coach copy) | `OPENAI_API_KEY` (optional) | “Journal rules” / heuristic only — still works |

---

## Most common causes (in order)

### 1. Wrong or stale Vercel deployment
- **Production URL:** `https://vyronishq.com` (Vercel project `vyronis-ai`, linked to `root4580/vyronis-ai` on `main`).
- Set `NEXT_PUBLIC_APP_URL` to that exact URL → **Redeploy**.

### 2. Different Supabase project
- Local `.env.local` often points at **dev** Supabase; Vercel points at **prod** (or another project).
- Accounts and trades **do not transfer** between projects.
- **Fix:** Either point Vercel env at the **same** project as local, or run migrations + have users sign up on production.

### 3. Migrations not run on production Supabase
- Local DB may have 15+ tables; production may only have `trades`.
- **Fix:** Supabase (production project) → SQL Editor → run `supabase/MIGRATION_ORDER.md` minimum set (see `CLOSED-BETA-DEPLOY-CHECKLIST.md` §4).

### 4. Unpushed code
- Login cookie fix, profile backfill, etc. only help after **push + Vercel redeploy**.
- **Fix:** `git push origin main` → wait for deploy → hard refresh.

### 5. Optional AI keys not set
- Not “missing features” — coach/reviews fall back to **rule-based** analysis (by design).

---

## One-time production sync (recommended)

**A. Vercel**
1. Confirm project imports `vyronis-ai` repo, branch `main`.
2. Env (Production): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`.
3. Redeploy latest commit.

**B. Supabase** (the project in those env vars)
1. Run migrations 1–8 from `CLOSED-BETA-DEPLOY-CHECKLIST.md` §4.
2. Auth → Site URL + `/auth/callback` redirect = your Vercel URL.
3. (Beta) Email provider → disable “Confirm email” if testers can’t log in.

**C. Smoke test on Vercel URL** (not localhost)
Use `CLOSED-BETA-DEPLOY-CHECKLIST.md` §5 checklist.

---

## Quick compare: same project or not?

| Check | Local | Vercel |
|-------|-------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` | Vercel → Settings → Env |
| First 8 chars of anon key | `.env.local` | Vercel env (should match if same project) |
| User email exists | Supabase Auth → Users | **Same** dashboard → Users |

If URLs differ → **different databases** → expect missing trades, profile, coach, reviews.
