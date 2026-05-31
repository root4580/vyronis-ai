/** Resend test sender — works without custom domain verification. */
export const RESEND_TEST_FROM = "onboarding@resend.dev"

export function getResendFromAddress(): string {
  return (
    process.env.EMAIL_FROM?.trim() ||
    process.env.RESEND_FROM_EMAIL?.trim() ||
    process.env.RESEND_ALERT_FROM?.trim() ||
    RESEND_TEST_FROM
  )
}

export function getResendConfig(): { apiKey: string; from: string } | null {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) return null
  return { apiKey, from: getResendFromAddress() }
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim())
}

type EmailPayload = {
  to: string
  subject: string
  html: string
}

function logSkippedEmail(payload: EmailPayload, reason: string): void {
  if (process.env.NODE_ENV !== "development") return

  console.info("[email:skipped]", reason, {
    to: payload.to,
    subject: payload.subject,
    htmlPreview: payload.html.slice(0, 240),
  })
}

export async function sendResendEmail(
  input: EmailPayload,
): Promise<{ sent: boolean; skippedReason?: string }> {
  const config = getResendConfig()
  if (!config) {
    logSkippedEmail(input, "RESEND_API_KEY not set — email skipped")
    return { sent: false, skippedReason: "RESEND_API_KEY not set" }
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    console.error("Resend email failed:", response.status, body)
    return { sent: false, skippedReason: `Resend error ${response.status}` }
  }

  return { sent: true }
}
