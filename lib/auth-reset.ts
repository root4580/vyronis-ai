/** Build Supabase auth redirect URLs for email flows (client or server). */
export function getAuthSiteOrigin(): string {
  // Prefer canonical production URL so reset/sign-up emails work from preview deploys too.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (appUrl) return appUrl.replace(/\/$/, "")

  if (typeof window !== "undefined") {
    return window.location.origin
  }

  const devRedirect = process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL?.trim()
  if (devRedirect) {
    return devRedirect.replace(/\/auth\/callback$/, "")
  }

  return "http://localhost:3000"
}

/**
 * Recovery emails exchange the code at /auth/callback, then land on reset-password.
 * Add this URL (and /auth/callback) to Supabase → Authentication → Redirect URLs.
 */
export function getPasswordResetRedirectUrl(): string {
  const origin = getAuthSiteOrigin()
  const next = encodeURIComponent("/auth/reset-password")
  return `${origin}/auth/callback?next=${next}`
}
