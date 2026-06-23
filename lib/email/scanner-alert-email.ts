import { getAppBaseUrl } from "@/lib/env"
import { isResendConfigured, sendResendEmail } from "@/lib/alerts/resend-config"
import type { ScannerSignalGrade } from "@/lib/scanner/types"

export type ScannerAlertEmailInput = {
  to: string
  pair: string
  direction: "BUY" | "SELL"
  grade: ScannerSignalGrade
  score: number
  session: string
  zoneType: string
  riskReward: number
  weeklyBias: string
  dailyBias: string
  h4Bias: string
  entry?: number | null
  stopLoss?: number | null
  takeProfit?: number | null
  confirmationType?: string
}

export function isScannerAlertEmailConfigured(): boolean {
  return isResendConfigured()
}

function formatPrice(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return value.toFixed(value > 10 ? 2 : 5)
}

export async function sendScannerAlertEmail(
  input: ScannerAlertEmailInput,
): Promise<{ sent: boolean; skippedReason?: string }> {
  const isAPlus = input.grade === "A+ Sniper"
  const subject = isAPlus
    ? `🔥 A+ SNIPER: ${input.pair} ${input.direction}`
    : `⚡ A SETUP: ${input.pair} ${input.direction}`

  const scannerUrl = `${getAppBaseUrl()}/scanner`
  const dirColor = input.direction === "BUY" ? "#10b981" : "#ef4444"

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;color:#e8eef4;background:#0a0f14;padding:24px;border-radius:12px;">
      <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${isAPlus ? "#f59e0b" : "#22d3ee"};">
        Precision Flow · ${isAPlus ? "A+ Sniper" : "A Strong"}
      </p>
      <h1 style="margin:0 0 8px;font-size:22px;color:#fff;">${input.pair}</h1>
      <p style="margin:0 0 16px;font-size:16px;font-weight:700;color:${dirColor};">${input.direction} · Score ${input.score}</p>
      <table style="width:100%;font-size:13px;line-height:1.6;color:#94a3b8;margin-bottom:16px;">
        <tr><td style="padding:4px 0;color:#64748b;">Session</td><td style="text-align:right;color:#e2e8f0;">${input.session}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;">Zone</td><td style="text-align:right;color:#e2e8f0;">${input.zoneType}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;">R:R</td><td style="text-align:right;color:#e2e8f0;">1:${input.riskReward.toFixed(1)}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;">Bias W/D/H4</td><td style="text-align:right;color:#e2e8f0;">${input.weeklyBias} / ${input.dailyBias} / ${input.h4Bias}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;">Entry</td><td style="text-align:right;color:#e2e8f0;">${formatPrice(input.entry)}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;">Stop</td><td style="text-align:right;color:#e2e8f0;">${formatPrice(input.stopLoss)}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;">Target</td><td style="text-align:right;color:#e2e8f0;">${formatPrice(input.takeProfit)}</td></tr>
      </table>
      ${input.confirmationType ? `<p style="margin:0 0 16px;font-size:12px;color:#cbd5e1;">${input.confirmationType}</p>` : ""}
      <p style="margin:0 0 8px;font-size:11px;color:#64748b;">Quality over quantity — review before entry.</p>
      <a href="${scannerUrl}" style="display:inline-block;margin-top:12px;padding:10px 18px;background:#22d3ee;color:#0a0f14;font-weight:600;font-size:13px;text-decoration:none;border-radius:8px;">Open Scanner</a>
    </div>
  `.trim()

  return sendResendEmail({ to: input.to, subject, html })
}
