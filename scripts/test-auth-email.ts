/**
 * Auth email utility tests — run: npm run test:auth
 */
import assert from "node:assert/strict"
import {
  AUTH_RESEND_COOLDOWN_MS,
  getAuthCallbackUrl,
  getAuthSiteOrigin,
  getPasswordResetRedirectUrl,
  getResendCooldown,
  getSignupEmailRedirectUrl,
  buildTokenHashCallbackUrl,
  getVerifyEmailPageUrl,
} from "../lib/auth-email"
import { formatAuthError, isEmailNotConfirmedError } from "../lib/auth-errors"

process.env.NEXT_PUBLIC_APP_URL = "https://vyronishq.com"

assert.equal(getAuthSiteOrigin(), "https://vyronishq.com")
assert.equal(getSignupEmailRedirectUrl(), "https://vyronishq.com/auth/callback")
assert.equal(getPasswordResetRedirectUrl(), "https://vyronishq.com/auth/callback?type=recovery")
assert.equal(getAuthCallbackUrl("/analytics"), "https://vyronishq.com/auth/callback?next=%2Fanalytics")

const cooldown = getResendCooldown(Date.now() - 30_000, Date.now())
assert.equal(cooldown.allowed, false)
assert.ok(cooldown.secondsRemaining > 0 && cooldown.secondsRemaining <= 31)

const ready = getResendCooldown(Date.now() - AUTH_RESEND_COOLDOWN_MS - 1, Date.now())
assert.equal(ready.allowed, true)

assert.match(
  formatAuthError("Email not confirmed"),
  /Confirm your email/i,
)
assert.equal(isEmailNotConfirmedError("Email not confirmed"), true)

assert.match(getVerifyEmailPageUrl("a@b.com"), /verify-email\?email=a%40b.com/)

assert.match(
  buildTokenHashCallbackUrl("abc123", "signup"),
  /^https:\/\/vyronishq\.com\/auth\/callback\?token_hash=abc123&type=signup$/,
)

console.log("✓ auth email tests passed")
