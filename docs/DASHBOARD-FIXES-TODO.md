# Dashboard/Console Fixes (Not Code — Do These Manually)

These two items from the launch QA list can't be fixed by editing code. Do them directly in the Supabase and Vercel dashboards.

## 1. Fix auth email delivery (custom SMTP)

Default Supabase auth email is rate-limited and unreliable for real users. Switch to a custom SMTP provider.

1. Go to your Supabase project → **Authentication** → **Emails** → **SMTP Settings**.
2. Toggle "Enable Custom SMTP."
3. Pick a transactional email provider (Resend, Postmark, or SendGrid are common choices — this repo already uses Resend elsewhere, see `lib/alerts/resend-config.ts`, so reusing Resend keeps things simple).
4. Get SMTP credentials from that provider's dashboard (host, port, username, password — for Resend this is under Settings → SMTP).
5. Fill in the Supabase SMTP fields: Host, Port (usually 587), Username, Password, Sender email, Sender name.
6. Save, then send a test signup/reset email to confirm delivery.

## 2. Fix inconsistent Vercel preview env vars

Preview/branch deployments on Vercel break auth redirects because env vars differ from production.

1. Go to your Vercel project → **Settings** → **Environment Variables**.
2. For each variable used in `.env.example` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `AI_PROVIDER` + its key, etc.), check it's set for **all three** environments: Production, Preview, and Development — not just Production.
3. Specifically check any variable containing a redirect URL or site URL (e.g. `NEXT_PUBLIC_SITE_URL` if present) — this is usually the one that's hardcoded to the production domain and breaks preview deploys. Set it dynamically if your code supports `VERCEL_URL`, or add a preview-specific value.
4. Redeploy a preview branch and test a full signup/login flow on the preview URL to confirm redirects work.

## 3. Run the security hardening migration (CRITICAL — do this first)

Supabase's Advisor flagged 4 critical issues: RLS disabled on `trade_id_migration_map`, and 3 views (`vyronis_trade_id_migration_gaps`, `vyronis_trades_enum_violations`, `vyronis_session_json_drift`) defined without `security_invoker`, which can leak data across user accounts to anyone who can query them via the API.

1. Go to Supabase → your project → **SQL Editor**.
2. Open `supabase/050-security-advisor-hardening.sql` from this repo, copy its contents, paste into the SQL Editor, and run it.
3. Re-run the Advisor (Project Overview → Advisor) to confirm all 4 issues clear.
4. The migration is idempotent — safe to run more than once if unsure.

This is unrelated to the app's code and can't be fixed by editing files — it has to be run directly against your database.

---
Generated as part of the code review fix pass — see chat history for the full list of items and their status.
