# Vyronis branding on Supabase Auth

Supabase stays your **backend** (database + auth). Users never need to see “Supabase” — only **Vyronis AI**.

Do these once in the [Supabase Dashboard](https://supabase.com/dashboard) for project `jjdxodqipdjfkjanjywf` (or your project).

---

## 1. Rename the Supabase project (optional)

**Settings → General → Project name** → `Vyronis AI`

This only changes the name in the Supabase dashboard (for you), not emails.

---

## 2. Auth URL configuration

**Authentication → URL Configuration**

| Field | Value |
|-------|--------|
| **Site URL** | `https://vyronis-ai.vercel.app` |
| **Redirect URLs** | `https://vyronis-ai.vercel.app/auth/callback` |
| | `http://localhost:3000/auth/callback` |

---

## 3. Email templates (user-facing Vyronis branding)

**Authentication → Email Templates**

Use the production HTML templates in the repo (dark theme, mobile-friendly):

| Template | File |
|----------|------|
| **Confirm signup** | `supabase/email-templates/confirm-signup.html` |
| **Reset password** | `supabase/email-templates/reset-password.html` |

**Subjects:**

- Confirm signup: `Confirm your Vyronis AI account`
- Reset password: `Reset your Vyronis AI password`

Copy the full HTML from each file into the matching Supabase template editor. Supabase variables like `{{ .ConfirmationURL }}` must stay unchanged.

For Resend SMTP and URL configuration, see **`docs/SUPABASE-RESEND-SETUP.md`**.

### Magic link (if enabled)

**Subject:** `Sign in to Vyronis AI`

**Body (HTML):**
```html
<h2>Sign in to Vyronis AI</h2>
<p><a href="{{ .ConfirmationURL }}">Continue to your dashboard</a></p>
<p>This link expires soon. If you did not request it, ignore this email.</p>
<p>— Vyronis AI</p>
```

---

## 4. Custom SMTP (required for production)

Default Supabase mail often lands in spam and is rate-limited (~4/hour on free tier).

**Full Resend setup:** **`docs/SUPABASE-RESEND-SETUP.md`**

Quick reference:

| Field | Value |
|-------|--------|
| **Sender name** | `Vyronis AI` |
| **Host** | `smtp.resend.com` |
| **Port** | `465` |
| **User** | `resend` |
| **Password** | Resend API key |

---

## 5. What stays “Supabase” (developers only)

- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, etc.
- SQL migrations in `supabase/*.sql`
- Developer toasts (“Run migration in Supabase”) — not shown to end users in normal flow

Users only see **Vyronis AI** in the app and in emails after steps 3–4.
