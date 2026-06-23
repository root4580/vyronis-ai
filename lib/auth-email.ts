import { sanitizeRedirectPath } from "@/lib/auth-routes"
import { APP_HOME_PATH } from "@/lib/branding"
import { getAppBaseUrl } from "@/lib/env"

export const AUTH_RESEND_COOLDOWN_MS = 60_000

/** Canonical app origin for auth email redirectTo (production-safe). */
export function getAuthSiteOrigin(): string {
  return getAppBaseUrl()
}

/** OAuth/email callback; optional post-login path via `next`. */
export function getAuthCallbackUrl(nextPath?: string | null): string {
  const origin = getAuthSiteOrigin()
  const next = sanitizeRedirectPath(nextPath, APP_HOME_PATH)
  if (next === APP_HOME_PATH) {
    return `${origin}/auth/callback`
  }
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`
}

export function getSignupEmailRedirectUrl(): string {
  return getAuthCallbackUrl()
}

/** Supabase appends ?code= to this URL; must be in Auth redirect allow list. */
export function getPasswordResetRedirectUrl(): string {
  return `${getAuthSiteOrigin()}/auth/reset-password`
}

export function getVerifyEmailPageUrl(email?: string): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : getAuthSiteOrigin()
  const base = `${origin}/auth/verify-email`
  if (!email?.trim()) return base
  return `${base}?email=${encodeURIComponent(email.trim())}`
}

export type ResendCooldown = {
  allowed: boolean
  secondsRemaining: number
}

export function getResendCooldown(lastSentAtMs: number | null, nowMs = Date.now()): ResendCooldown {
  if (!lastSentAtMs) {
    return { allowed: true, secondsRemaining: 0 }
  }

  const elapsed = nowMs - lastSentAtMs
  if (elapsed >= AUTH_RESEND_COOLDOWN_MS) {
    return { allowed: true, secondsRemaining: 0 }
  }

  return {
    allowed: false,
    secondsRemaining: Math.ceil((AUTH_RESEND_COOLDOWN_MS - elapsed) / 1000),
  }
}

export function readResendTimestamp(storageKey: string): number | null {
  if (typeof window === "undefined") return null
  const raw = window.localStorage.getItem(storageKey)
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

export function writeResendTimestamp(storageKey: string, atMs = Date.now()): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(storageKey, String(atMs))
}
