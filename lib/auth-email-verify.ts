import type { EmailOtpType, SupabaseClient } from "@supabase/supabase-js"

const EMAIL_VERIFICATION_TYPES: EmailOtpType[] = [
  "signup",
  "email",
  "magiclink",
  "invite",
]

function verificationTypeOrder(preferred?: string | null): EmailOtpType[] {
  const normalized = preferred?.trim().toLowerCase()
  if (!normalized) return EMAIL_VERIFICATION_TYPES

  const preferredType = EMAIL_VERIFICATION_TYPES.find((type) => type === normalized)
  if (!preferredType) return EMAIL_VERIFICATION_TYPES

  return [
    preferredType,
    ...EMAIL_VERIFICATION_TYPES.filter((type) => type !== preferredType),
  ]
}

export async function verifyEmailTokenHash(
  supabase: SupabaseClient,
  tokenHash: string,
  preferredType?: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  let lastMessage = "We could not verify this link."

  for (const type of verificationTypeOrder(preferredType)) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    })

    if (!error && data.session?.user) {
      return { ok: true }
    }

    lastMessage = error?.message ?? lastMessage
    const lower = lastMessage.toLowerCase()
    if (lower.includes("expired") || lower.includes("already been used")) {
      break
    }
  }

  return { ok: false, message: lastMessage }
}

export async function exchangeAuthCodeForSession(
  supabase: SupabaseClient,
  code: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (!error && data.session?.user) {
    return { ok: true }
  }

  const message = error?.message ?? "We could not verify this link."
  return { ok: false, message }
}

export function mapVerificationErrorMessage(message: string): string {
  const lower = message.toLowerCase()

  if (lower.includes("pkce") || lower.includes("code verifier")) {
    return "Open the verification link on the same phone or browser where you signed up, or tap Resend verification email and use the newest link."
  }
  if (lower.includes("expired")) {
    return "This link has expired. Request a new verification email."
  }
  if (lower.includes("already been used") || lower.includes("already used")) {
    return "This link was already used. Sign in, or request a new verification email."
  }

  return "We could not verify this link. Request a new verification email and use the latest link."
}
