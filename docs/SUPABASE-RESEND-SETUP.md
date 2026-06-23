# Supabase Auth + Resend (production email)

Vyronis sends auth emails through **Supabase Auth** with **Resend SMTP** for reliable inbox delivery.

## 1. Resend setup

1. Create account at [resend.com](https://resend.com).
2. Add and verify your sending domain (or use Resend test domain for staging).
3. Create an API key with **Sending access**.

Recommended sender: `Vyronis AI <noreply@yourdomain.com>`

## 2. Supabase SMTP (Resend)

**Supabase Dashboard → Authentication → SMTP Settings → Enable Custom SMTP**

| Field | Value |
|-------|--------|
| **Host** | `smtp.resend.com` |
| **Port** | `465` |
| **Username** | `resend` |
| **Password** | Your Resend API key |
| **Sender email** | `noreply@yourdomain.com` |
| **Sender name** | `Vyronis AI` |

## 3. Auth URLs

**Authentication → URL Configuration**

| Field | Value |
|-------|--------|
| **Site URL** | `https://vyronishq.com` |
| **Redirect URLs** | `https://vyronishq.com/auth/callback` |
| | `https://vyronishq.com/auth/confirm` |
| | `https://vyronishq.com/auth/reset-password` |
| | `http://localhost:3000/auth/callback` |
| | `http://localhost:3000/auth/confirm` |
| | `http://localhost:3000/auth/reset-password` |

## 4. Email templates

**Authentication → Email Templates**

Paste HTML from:

- `supabase/email-templates/confirm-signup.html` → **Confirm signup**
- `supabase/email-templates/reset-password.html` → **Reset password**

Subjects:

- Confirm signup: `Confirm your Vyronis AI account`
- Reset password: `Reset your Vyronis AI password`

## 5. Enable email confirmation (recommended for production)

**Authentication → Providers → Email**

- Enable **Confirm email** for production sign-ups.
- For closed beta you may disable temporarily if testers are blocked.

## 6. Vercel env (app — not Resend)

Resend credentials live **only in Supabase SMTP**, not in Next.js env.

| Variable | Required |
|----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes |
| `NEXT_PUBLIC_APP_URL` | Yes — `https://vyronishq.com` |

The app uses `NEXT_PUBLIC_APP_URL` for all `emailRedirectTo` / `redirectTo` values so preview deploys do not break email links.

## 7. App auth routes

| Route | Purpose |
|-------|---------|
| `/auth/sign-up` | Create account → verification email |
| `/auth/verify-email` | Resend verification |
| `/auth/forgot-password` | Request reset link |
| `/auth/reset-password` | Set new password after email link |
| `/auth/callback` | **Server-side** `exchangeCodeForSession` / `verifyOtp` (recommended) |
| `/auth/confirm` | Legacy forwarder → `/auth/callback` when query params present |

## 8. Verify delivery

1. Sign up on **https://vyronishq.com** (not preview URL).
2. Check inbox + spam within 5 minutes.
3. Supabase → **Authentication → Logs** — confirm `user.signup` / mail events.
4. Resend dashboard → **Logs** — confirm sent/delivered.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| No email | Resend SMTP enabled? Domain verified? Check Supabase Auth logs |
| Confirm link fails / can't log in | Site URL must be `https://vyronishq.com`; add all redirect URLs above; re-paste `confirm-signup.html` using `{{ .ConfirmationURL }}` (not a hardcoded link) |
| Link goes to wrong URL | Set `NEXT_PUBLIC_APP_URL` on Vercel Production + redeploy |
| “Email not confirmed” on login | Use `/auth/verify-email` to resend |
| Rate limited | Wait 60s between resends; Supabase/Resend rate limits apply |
