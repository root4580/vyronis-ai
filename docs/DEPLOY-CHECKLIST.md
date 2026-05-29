# Deploy checklist (Vercel + Supabase)

Use this before sharing **https://vyronishq.com** with testers.

## 1. Code

- [ ] Latest `main` deployed on Vercel
- [ ] `npm run build` passes locally

## 2. Environment (Vercel → Production **and** Preview)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Same project as local |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same project as local |
| `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` | **Same Supabase project** as URL/anon (TradingView webhook + vision) |
| `NEXT_PUBLIC_APP_URL` | `https://vyronishq.com` (auth redirects) |
| `OPENAI_API_KEY` | Vision coach + War Room autofill |

## 3. Supabase SQL (production project)

Minimum for current trading OS:

- [ ] `trade-coach-migration.sql`
- [ ] `RUN-STRATEGY-BRAIN-AND-WAR-ROOM.sql` (or split strategy-brain migrations)
- [ ] `trades-migration.sql` + `trade-fields-migration.sql`
- [ ] `user-settings-migration.sql` + `user-profiles-migration.sql`
- [ ] Chart vision / MTF columns if using full coach
- [ ] `013-tradingview-signals.sql`
- [ ] `028-tradingview-signals-insert.sql` (in-app **Test GBPCAD** button)
- [ ] `trade-quality-engine-migration.sql` (weekly debrief quality grades + coach scores)

Sync env from local (includes service role):

```bash
./scripts/sync-vercel-env.sh vyronis-ai https://vyronishq.com
```

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

## 6. TradingView test alert (“Could not validate webhook secret”)

1. **Vercel env:** `NEXT_PUBLIC_SUPABASE_URL`, anon key, and `SUPABASE_SECRET_KEY` must all be from **one** project (Dashboard → Project Settings → API). A service role JWT for a different `*.supabase.co` ref breaks webhooks and older test flows.
2. **SQL:** Run `028-tradingview-signals-insert.sql` so logged-in users can insert test signals.
3. **Redeploy** after `main` includes the session-based test route (no service role required for **Test GBPCAD**).

## 7. Common “missing features” causes

1. Wrong Supabase project on Vercel  
2. Migrations not run on prod DB  
3. `OPENAI_API_KEY` missing → text-only coach  
4. `NEXT_PUBLIC_APP_URL` missing on Preview deploys  
