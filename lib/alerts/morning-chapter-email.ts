import { getAppBaseUrl } from "@/lib/env"
import { getPracticeRoomHref } from "@/lib/dashboard-nav"
import { sendResendEmail } from "@/lib/alerts/resend-config"

export type MorningChapterEmailInput = {
  to: string
  traderFirstName: string
  chapterNumber: number
  openingMessage: string
  tradesUsedLabel?: string | null
}

export async function sendMorningChapterEmail(
  input: MorningChapterEmailInput,
): Promise<{ sent: boolean; skippedReason?: string }> {
  const base = getAppBaseUrl()
  const hqUrl = `${base}/hq`
  const practiceUrl = `${base}${getPracticeRoomHref()}`
  const name = input.traderFirstName.trim() || "Trader"

  const subject = `Good morning ${name} — Chapter ${input.chapterNumber} begins today`

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;color:#e8eef4;background:#0a0f14;padding:24px;border-radius:12px;">
      <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#a78bfa;">Vyronis morning briefing</p>
      <h1 style="margin:0 0 12px;font-size:20px;color:#fff;">Chapter ${input.chapterNumber}</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#cbd5e1;white-space:pre-line;">${input.openingMessage}</p>
      ${
        input.tradesUsedLabel
          ? `<p style="margin:0 0 16px;font-size:13px;color:#94a3b8;">This week: ${input.tradesUsedLabel}</p>`
          : ""
      }
      <p style="margin:0 0 8px;font-size:11px;color:#64748b;">Your edge is intact. The market is ready.</p>
      <a href="${hqUrl}" style="display:inline-block;margin-top:8px;margin-right:8px;padding:10px 18px;background:#22d3ee;color:#0a0f14;font-weight:600;font-size:13px;text-decoration:none;border-radius:8px;">Open HQ</a>
      <a href="${practiceUrl}" style="display:inline-block;margin-top:8px;padding:10px 18px;background:#7c3aed;color:#fff;font-weight:600;font-size:13px;text-decoration:none;border-radius:8px;">Practice Room</a>
    </div>
  `.trim()

  return sendResendEmail({ to: input.to, subject, html })
}
