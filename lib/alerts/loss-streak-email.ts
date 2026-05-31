/*
 * Email-safe token hex (mirrors app/globals.css — CSS var() not supported in clients)
 * --surface-page    → #0f1117
 * --surface-card    → #13161f
 * --color-accent    → #22d3ee
 * --color-profit    → #10b981
 * --color-loss      → #ef4444
 * --warning         → #f59e0b
 * --text-primary    → #e6e6e6
 * --text-secondary  → #9ca3af
 * --text-muted      → #4b5563
 */

import { getAppBaseUrl } from "@/lib/env"
import { getDashboardTabHref } from "@/lib/dashboard-nav"
import { sendResendEmail } from "@/lib/alerts/resend-config"

export type LossStreakEmailInput = {
  to: string
  streak: number
}

export async function sendLossStreakAlertEmail(
  input: LossStreakEmailInput,
): Promise<{ sent: boolean; skippedReason?: string }> {
  const base = getAppBaseUrl()
  const journalUrl = `${base}${getDashboardTabHref("journal")}`
  const subject = `Vyronis · ${input.streak} consecutive losses — pause and reset`

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;color:#e8eef4;background:#0a0f14;padding:24px;border-radius:12px;">
      <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#f87171;">Loss streak alert</p>
      <h1 style="margin:0 0 12px;font-size:20px;color:#fff;">${input.streak} consecutive losses</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#94a3b8;">
        Your journal shows ${input.streak} losses in a row. Funded accounts rarely survive revenge sizing after streaks — step away, reset, and return with A+ discipline only.
      </p>
      <a href="${journalUrl}" style="display:inline-block;margin-top:12px;padding:10px 18px;background:#22d3ee;color:#0a0f14;font-weight:600;font-size:13px;text-decoration:none;border-radius:8px;">Open journal in Vyronis</a>
    </div>
  `.trim()

  return sendResendEmail({ to: input.to, subject, html })
}
