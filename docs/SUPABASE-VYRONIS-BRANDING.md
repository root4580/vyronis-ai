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

### Reset password

**Subject:**
```
Reset your Vyronis AI password
```

**Body (HTML):**
```html
<h2>Reset your password</h2>
<p>You requested a password reset for your Vyronis AI trading journal.</p>
<p><a href="{{ .ConfirmationURL }}">Set a new password</a></p>
<p>This link expires in about one hour. If you did not request this, you can ignore this email.</p>
<p>— Vyronis AI · Trading Intelligence</p>
```

### Confirm signup

**Subject:**
```
Confirm your Vyronis AI account
```

**Body (HTML):**
```html
<h2>Welcome to Vyronis AI</h2>
<p>Confirm your email to start journaling trades and tracking your edge.</p>
<p><a href="{{ .ConfirmationURL }}">Confirm email</a></p>
<p>— Vyronis AI · Trading Intelligence</p>
```

### Magic link (if enabled)

**Subject:**
```
Sign in to Vyronis AI
```

**Body (HTML):**
```html
<h2>Sign in to Vyronis AI</h2>
<p><a href="{{ .ConfirmationURL }}">Continue to your dashboard</a></p>
<p>This link expires soon. If you did not request it, ignore this email.</p>
<p>— Vyronis AI</p>
```

---

## 4. Custom SMTP (recommended for Gmail delivery)

Default Supabase mail often lands in spam and is rate-limited (~4/hour on free tier).

**Authentication → SMTP Settings → Enable Custom SMTP**

Example with [Resend](https://resend.com):

| Field | Example |
|-------|---------|
| **Sender email** | `noreply@yourdomain.com` (verified domain) |
| **Sender name** | `Vyronis AI` |
| **Host** | `smtp.resend.com` |
| **Port** | `465` |
| **User / Password** | From Resend API keys |

Until you add a domain, Resend’s onboarding domain can work for testing.

---

## 5. What stays “Supabase” (developers only)

- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, etc.
- SQL migrations in `supabase/*.sql`
- Developer toasts (“Run migration in Supabase”) — not shown to end users in normal flow

Users only see **Vyronis AI** in the app and in emails after steps 3–4.
