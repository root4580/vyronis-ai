import type { SupabaseClient } from "@supabase/supabase-js"
import { sendScannerAlertEmail } from "@/lib/email/scanner-alert-email"
import type { Mt5ScannerWebhookPayload, ScannerSignalGrade } from "@/lib/scanner/types"

export async function resolveUserEmail(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  if (typeof supabase.auth.admin?.getUserById !== "function") return null
  const { data, error } = await supabase.auth.admin.getUserById(userId)
  if (error || !data.user?.email) return null
  return data.user.email
}

export async function maybeSendScannerSetupAlert(
  supabase: SupabaseClient,
  userId: string,
  raw: Mt5ScannerWebhookPayload,
  grade: ScannerSignalGrade,
  pair: string,
  direction: "BUY" | "SELL",
  isDuplicate: boolean,
): Promise<{ sent: boolean; skippedReason?: string }> {
  if (isDuplicate) {
    return { sent: false, skippedReason: "Duplicate setup — alert already sent." }
  }

  if (grade !== "A+ Sniper" && grade !== "A Strong") {
    return { sent: false, skippedReason: "Grade below A — no alert." }
  }

  const email = await resolveUserEmail(supabase, userId)
  if (!email) {
    return { sent: false, skippedReason: "No account email." }
  }

  return sendScannerAlertEmail({
    to: email,
    pair,
    direction,
    grade,
    score: Math.round(Number(raw.score) || 0),
    session: raw.session ?? "Unknown",
    zoneType: raw.zone_type ?? "FVG",
    riskReward: Number(raw.risk_reward) || 0,
    weeklyBias: raw.weekly_bias ?? raw.daily_bias ?? "Neutral",
    dailyBias: raw.daily_bias ?? "Neutral",
    h4Bias: raw.h4_bias ?? "Neutral",
    entry: raw.entry ?? null,
    stopLoss: raw.stop_loss ?? null,
    takeProfit: raw.take_profit ?? null,
    confirmationType: raw.confirmation_type ?? undefined,
  })
}
