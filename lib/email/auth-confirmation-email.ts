import { sendResendEmail } from "@/lib/alerts/resend-config"

export type AuthConfirmationEmailInput = {
  to: string
  confirmUrl: string
  from?: string
}

export async function sendAuthConfirmationEmail(
  input: AuthConfirmationEmailInput,
): Promise<{ sent: boolean; skippedReason?: string }> {
  const subject = "Confirm your Vyronis HQ account"
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;color:#e8eef4;background:#0a0f14;padding:24px;border-radius:12px;">
      <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#22d3ee;">Vyronis HQ</p>
      <h1 style="margin:0 0 12px;font-size:22px;color:#fff;">Welcome aboard</h1>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#94a3b8;">
        Confirm your email to activate your prop trading command center — War Room, alerts, coach, and journal.
      </p>
      <a href="${input.confirmUrl}" style="display:inline-block;padding:12px 24px;background:#22d3ee;color:#041014;font-weight:600;font-size:14px;text-decoration:none;border-radius:10px;">
        Confirm email
      </a>
      <p style="margin:20px 0 0;font-size:11px;line-height:1.5;color:#64748b;">
        Works on any device — open in Safari or Chrome. If you did not create an account, ignore this email.
      </p>
    </div>
  `.trim()

  return sendResendEmail({
    to: input.to,
    subject,
    html,
    from: input.from,
  })
}
