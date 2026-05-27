# Vyronis 1.0 — Closed Beta Deploy Checklist

Use this checklist before inviting beta traders. Complete in order.

## 1. Environment variables (Vercel)

| Variable | Required | Notes |
|----------|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Anon key only — never service role in Next.js |
| `NEXT_PUBLIC_APP_URL` | Yes (prod) | e.g. `https://your-app.vercel.app` — no trailing slash |
| `OPENAI_API_KEY` | Optional | Only if AI narrative / vision enabled |
| `AI_PROVIDER` | Optional | `openai` \| `claude` \| `gemini` \| `heuristic` |
| `CHART_VISION_PROVIDER` | Optional | Defaults with `AI_PROVIDER` |
| `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET` | Optional | Default `trade-screenshots` |

**Verify:** Redeploy after changing env. Missing Supabase vars cause middleware 500 (intentional fail-fast).

## 2. Supabase Auth redirects

In **Authentication → URL Configuration**:

- **Site URL:** `NEXT_PUBLIC_APP_URL`
- **Redirect URLs:**  
  - `https://<your-domain>/auth/callback`  
  - `http://localhost:3000/auth/callback` (dev only)

**Smoke test:** Login → lands on `/` with session; logout → `/auth/login`.

## 3. Database migrations

Run SQL from `supabase/MIGRATION_ORDER.md` on the **production** project.

Minimum for beta core:

1. `trades-migration.sql`
2. `trade-fields-migration.sql`
3. `007-setup-score-columns.sql`
4. `008-weekly-reviews.sql` (optional but recommended for saved reviews)
5. `trade-coach-migration.sql` (if using coach)
6. `user-settings-migration.sql`
7. `user-profiles-migration.sql`
8. `storage-setup.sql`

If upgrading existing DB, run repair chain `001` → `004` per `MIGRATION_ORDER.md`.

**Verify:**

```sql
SELECT count(*) FROM public.trades;
SELECT count(*) FROM public.user_settings;
```

## 4. Storage

- Bucket `trade-screenshots` exists (or custom bucket matches env).
- Policies from `storage-setup.sql` applied.

**Known beta limitation:** Screenshots are **public-read** by URL. Do not share chart URLs publicly until private storage is implemented.

## 5. Row Level Security

Confirm RLS enabled on: `trades`, `user_settings`, `user_profiles`, coach tables, `weekly_reviews` (if migrated).

**Verify:** Two test accounts cannot read each other's trades in SQL editor as authenticated user.

## 6. Build & deploy

```bash
npm ci
npx tsc --noEmit
npm run build
```

Deploy `main` to Vercel. Confirm build log shows type checking (no `ignoreBuildErrors`).

## 7. Post-deploy smoke tests (15 min)

| Step | Expected |
|------|----------|
| Unauthenticated `/` | Redirect to login |
| Unauthenticated `/analytics` | Redirect to login |
| Register / login | Dashboard loads |
| Log trade | Saves, appears in journal |
| Logout → login as **different** user | No previous user's trades flash |
| Primary Leak Card | Shows building state or leak with corrective action |
| Daily ritual | Check-in → coach → log → debrief flow |
| Repeat last trade | Loads prior setup |
| Weekly review → Print | Opens print layout |
| Upload screenshot | Succeeds, image displays |
| `/analytics` | Loads with same user's data |

## 8. Rollback safety

- Vercel: promote previous deployment from Deployments tab.
- Database: migrations are additive; do not drop columns in production without backup.
- Env: revert env vars and redeploy previous build.

## 9. Beta communication (trust)

Tell testers explicitly:

- Insights are built from **their logged trades**, not live market data.
- Without API keys, coach/vision uses **rule-based analysis** (not GPT).
- Vyronis is a **discipline journal**, not trade signals or execution platform.

## 10. Known post-launch items (not blockers)

- Private screenshot storage (signed URLs)
- API rate limiting
- Server-side trade pagination
- Unified single “intelligence brain” across all widgets

---

**Sign-off:** _______________ **Date:** _______________ **Production URL:** _______________
