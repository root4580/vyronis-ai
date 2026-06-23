import { isResendConfigured } from "@/lib/alerts/resend-config"
import { buildTokenHashCallbackUrl, getPasswordResetRedirectUrl } from "@/lib/auth-email"
import { sendPasswordResetEmail } from "@/lib/email/password-reset-email"
import { createServiceRoleClient } from "@/lib/supabase/admin"

export type PasswordResetDeliveryResult = {
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

export async function deliverPasswordResetEmail(
  email: string,
): Promise<PasswordResetDeliveryResult> {
  const trimmed = email.trim().toLowerCase()
  if (!trimmed || !trimmed.includes("@")) {
    return { sent: false, via: "none", error: "Invalid email address." }
  }

  if (!isResendConfigured()) {
    return {
      sent: false,
      via: "none",
      error:
        "Email delivery not configured. Add RESEND_API_KEY on Vercel and verify vyronishq.com.",
    }
  }

  const admin = createServiceRoleClient()
  const redirectTo = getPasswordResetRedirectUrl()

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: trimmed,
    options: { redirectTo },
  })

  if (error) {
    console.error("[auth/password-reset] generateLink failed", error.message)
    return { sent: false, via: "none", error: error.message }
  }

  const tokenHash = data.properties?.hashed_token?.trim()
  const resetUrl = tokenHash ? buildTokenHashCallbackUrl(tokenHash, "recovery") : null

  if (!resetUrl) {
    return { sent: false, via: "none", error: "Could not generate reset link." }
  }

  const result = await sendPasswordResetEmail({
    to: trimmed,
    resetUrl,
    from: authEmailFrom(),
  })

  if (!result.sent) {
    return {
      sent: false,
      via: "none",
      error: result.skippedReason ?? "Resend could not send the email.",
    }
  }

  console.info("[auth/password-reset] sent via Resend", { email: trimmed })
  return { sent: true, via: "resend" }
}
