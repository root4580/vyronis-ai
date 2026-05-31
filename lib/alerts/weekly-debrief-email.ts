import { getAppBaseUrl } from "@/lib/env"
import { getDashboardTabHref } from "@/lib/dashboard-nav"
import { sendResendEmail } from "@/lib/alerts/resend-config"

export type WeeklyDebriefEmailInput = {
  to: string
  weekLabel: string
  tradeCount: number
}

export async function sendWeeklyDebriefReadyEmail(
  input: WeeklyDebriefEmailInput,
): Promise<{ sent: boolean; skippedReason?: string }> {
  const base = getAppBaseUrl()
  const debriefUrl = `${base}${getDashboardTabHref("journal")}#weekly-debrief-panel`
  const subject = `Vyronis · Weekly debrief ready · ${input.weekLabel}`

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;color:#e8eef4;background:#0a0f14;padding:24px;border-radius:12px;">
      <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#22d3ee;">Weekly debrief</p>
      <h1 style="margin:0 0 12px;font-size:20px;color:#fff;">Your week is ready to review</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#94a3b8;">
        ${input.tradeCount} trade${input.tradeCount === 1 ? "" : "s"} logged for ${input.weekLabel}. Open your weekly debrief for execution grades, leaks, and next-week focus.
      </p>
      <a href="${debriefUrl}" style="display:inline-block;margin-top:12px;padding:10px 18px;background:#22d3ee;color:#0a0f14;font-weight:600;font-size:13px;text-decoration:none;border-radius:8px;">Read weekly debrief</a>
    </div>
  `.trim()

  return sendResendEmail({ to: input.to, subject, html })
}
