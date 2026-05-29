# Deploy checklist (Vercel + Supabase)

Use this before sharing **https://vyronis-ai.vercel.app** with testers.

## 1. Code

- [ ] Latest `main` deployed on Vercel
- [ ] `npm run build` passes locally

## 2. Environment (Vercel → Production **and** Preview)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Same project as local |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same project as local |
| `SUPABASE_SERVICE_ROLE_KEY` | API routes / webhooks |
| `NEXT_PUBLIC_APP_URL` | `https://vyronis-ai.vercel.app` (auth redirects) |
| `OPENAI_API_KEY` | Vision coach + War Room autofill |

## 3. Supabase SQL (production project)

Minimum for current trading OS:

- [ ] `trade-coach-migration.sql`
- [ ] `RUN-STRATEGY-BRAIN-AND-WAR-ROOM.sql` (or split strategy-brain migrations)
- [ ] `trades-migration.sql` + `trade-fields-migration.sql`
- [ ] `user-settings-migration.sql` + `user-profiles-migration.sql`
- [ ] Chart vision / MTF columns if using full coach

See `docs/VERCEL-LOCAL-PARITY.md` for the full feature matrix.

## 4. Auth email

- [ ] Resend SMTP configured in Supabase (`docs/SUPABASE-RESEND-SETUP.md`)
- [ ] Redirect URLs include production + localhost

## 5. Smoke test on production

- [ ] Login / logout
- [ ] War Room: save watchlist + vision autofill
- [ ] Pre-trade coach: upload → MTF → check-in → **Log this trade**
- [ ] Journal: save trade + coach feedback
- [ ] Weekly debrief on Journal tab

## 6. Common “missing features” causes

1. Wrong Supabase project on Vercel  
2. Migrations not run on prod DB  
3. `OPENAI_API_KEY` missing → text-only coach  
4. `NEXT_PUBLIC_APP_URL` missing on Preview deploys  
