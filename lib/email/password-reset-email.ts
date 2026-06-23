import { sendResendEmail } from "@/lib/alerts/resend-config"

export type PasswordResetEmailInput = {
  to: string
  resetUrl: string
  from?: string
}

export async function sendPasswordResetEmail(
  input: PasswordResetEmailInput,
): Promise<{ sent: boolean; skippedReason?: string }> {
  const subject = "Reset your Vyronis HQ password"
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;color:#e8eef4;background:#0a0f14;padding:24px;border-radius:12px;">
      <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#22d3ee;">Vyronis HQ</p>
      <h1 style="margin:0 0 12px;font-size:22px;color:#fff;">Reset your password</h1>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#94a3b8;">
        We received a request to reset your password. This link expires in about one hour.
      </p>
      <a href="${input.resetUrl}" style="display:inline-block;padding:12px 24px;background:#22d3ee;color:#041014;font-weight:600;font-size:14px;text-decoration:none;border-radius:10px;">
        Set new password
      </a>
      <p style="margin:20px 0 0;font-size:11px;line-height:1.5;color:#64748b;">
        Open in Safari or Chrome on your phone. If you did not request this, ignore this email.
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
