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
import { isResendConfigured, sendResendEmail } from "@/lib/alerts/resend-config"
import { setupVerdictLabel } from "@/lib/tradingview/signal-war-room-grader"
import type { SetupGrade } from "@/lib/strategy-brain/types"
import type { TradingViewSetupVerdict } from "@/lib/tradingview/types"

export type TradingViewAlertEmailInput = {
  to: string
  symbol: string
  direction: string
  setupGrade: SetupGrade
  setupVerdict: TradingViewSetupVerdict
  verdictSummary: string
  alignmentScore: number
  strategyName?: string | null
  coachSessionId?: string | null
}

export function isTradingViewAlertEmailConfigured(): boolean {
  return isResendConfigured()
}

export async function sendTradingViewAlertEmail(
  input: TradingViewAlertEmailInput,
): Promise<{ sent: boolean; skippedReason?: string }> {
  const base = getAppBaseUrl()
  const journalUrl = input.coachSessionId
    ? `${base}${getDashboardTabHref("journal")}&coach=${input.coachSessionId}`
    : `${base}${getDashboardTabHref("journal")}`

  const verdictLabel = setupVerdictLabel(input.setupVerdict)
  const subject = `Vyronis · ${input.symbol} ${input.direction} · Grade ${input.setupGrade} · ${verdictLabel}`

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;color:#e8eef4;background:#0a0f14;padding:24px;border-radius:12px;">
      <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#22d3ee;">TradingView setup detected</p>
      <h1 style="margin:0 0 12px;font-size:20px;color:#fff;">${input.symbol} · ${input.direction}</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#94a3b8;">
        <strong style="color:#f8fafc;">Grade ${input.setupGrade}</strong> · ${verdictLabel} · ${input.alignmentScore}/100
        ${input.strategyName ? `<br/>Strategy: ${input.strategyName}` : ""}
      </p>
      <p style="margin:0 0 20px;font-size:13px;line-height:1.55;color:#cbd5e1;">${input.verdictSummary}</p>
      <p style="margin:0 0 8px;font-size:11px;color:#64748b;">AI coach only — you place every trade on MT5.</p>
      <a href="${journalUrl}" style="display:inline-block;margin-top:12px;padding:10px 18px;background:#22d3ee;color:#0a0f14;font-weight:600;font-size:13px;text-decoration:none;border-radius:8px;">Open in Vyronis</a>
    </div>
  `.trim()

  return sendResendEmail({ to: input.to, subject, html })
}
