import { getAppBaseUrl } from "@/lib/env"
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

function getResendConfig(): { apiKey: string; from: string } | null {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    process.env.RESEND_ALERT_FROM?.trim() ||
    ""
  if (!apiKey || !from) return null
  return { apiKey, from }
}

export function isTradingViewAlertEmailConfigured(): boolean {
  return getResendConfig() !== null
}

export async function sendTradingViewAlertEmail(
  input: TradingViewAlertEmailInput,
): Promise<{ sent: boolean; skippedReason?: string }> {
  const config = getResendConfig()
  if (!config) {
    return { sent: false, skippedReason: "RESEND_API_KEY or RESEND_FROM_EMAIL not set" }
  }

  const base = getAppBaseUrl()
  const journalUrl = input.coachSessionId
    ? `${base}/?tab=journal&coach=${input.coachSessionId}`
    : `${base}/?tab=journal`

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

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.from,
      to: [input.to],
      subject,
      html,
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    console.error("Resend TradingView alert email failed:", response.status, body)
    return { sent: false, skippedReason: `Resend error ${response.status}` }
  }

  return { sent: true }
}
