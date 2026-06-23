import { isResendConfigured } from "@/lib/alerts/resend-config"
import { buildTokenHashCallbackUrl, getSignupEmailRedirectUrl } from "@/lib/auth-email"
import { sendAuthConfirmationEmail } from "@/lib/email/auth-confirmation-email"
import { createServiceRoleClient } from "@/lib/supabase/admin"

export type ConfirmationDeliveryResult = {
  sent: boolean
  error?: string
  via: "resend" | "none"
}

function authEmailFrom(): string | undefined {
  return (
    process.env.AUTH_EMAIL_FROM?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    undefined
  )
}

export async function deliverSignupConfirmationEmail(
  email: string,
  password?: string,
): Promise<ConfirmationDeliveryResult> {
  const trimmed = email.trim().toLowerCase()
  if (!trimmed || !trimmed.includes("@")) {
    return { sent: false, via: "none", error: "Invalid email address." }
  }

  if (!isResendConfigured()) {
    return {
      sent: false,
      via: "none",
      error:
        "Email delivery not configured. Add RESEND_API_KEY on Vercel and verify vyronishq.com, or enable Supabase → Authentication → SMTP (Resend).",
    }
  }

  const admin = createServiceRoleClient()
  const redirectTo = getSignupEmailRedirectUrl()

  const { data, error } = password
    ? await admin.auth.admin.generateLink({
        type: "signup",
        email: trimmed,
        password,
        options: { redirectTo },
      })
    : await admin.auth.admin.generateLink({
        type: "magiclink",
        email: trimmed,
        options: { redirectTo },
      })

  if (error) {
    console.error("[auth/confirmation] generateLink failed", error.message)
    return { sent: false, via: "none", error: error.message }
  }

  const tokenHash = data.properties?.hashed_token?.trim()
  const verificationType = data.properties?.verification_type?.trim() || (password ? "signup" : "magiclink")

  const confirmUrl = tokenHash
    ? buildTokenHashCallbackUrl(tokenHash, verificationType)
    : null

  if (!confirmUrl) {
    return { sent: false, via: "none", error: "Could not generate confirmation link." }
  }

  const from = authEmailFrom()
  const result = await sendAuthConfirmationEmail({
    to: trimmed,
    confirmUrl,
    from,
  })

  if (!result.sent) {
    return {
      sent: false,
      via: "none",
      error: result.skippedReason ?? "Resend could not send the email.",
    }
  }

  console.info("[auth/confirmation] sent via Resend", { email: trimmed })
  return { sent: true, via: "resend" }
}
