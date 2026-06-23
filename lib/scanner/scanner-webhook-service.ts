import type { SupabaseClient } from "@supabase/supabase-js"
import { Mt5WebhookError } from "@/lib/mt5/webhook-server-service"
import { resolveUserByMt5ApiKey } from "@/lib/mt5/webhook-server-service"
import { recordMt5Ping } from "@/lib/mt5/ping-service"
import { maybeSendScannerSetupAlert } from "@/lib/scanner/scanner-alert-service"
import type {
  Mt5ScannerWebhookPayload,
  ScannerSignalGrade,
  ScannerSignalStatus,
  ScannerWebhookResult,
} from "@/lib/scanner/types"

function isMissingScannerTable(message: string): boolean {
  return /scanner_signals|does not exist|PGRST205/i.test(message)
}

function normalizePair(pair: string): string {
  const clean = pair.replace(/[.\s]/g, "").toUpperCase()
  if (clean.length === 6) {
    return `${clean.slice(0, 3)}/${clean.slice(3)}`
  }
  return pair
}

function normalizeGrade(grade: string): ScannerSignalGrade | "Skip" {
  const g = grade.trim()
  if (g === "A+ Sniper" || g === "A+") return "A+ Sniper"
  if (g === "A Strong" || g === "A") return "A Strong"
  if (g === "B Watchlist" || g === "B") return "B Watchlist"
  return "Skip"
}

function gradeToStatus(
  grade: ScannerSignalGrade | "Skip",
  explicit?: ScannerSignalStatus,
): ScannerSignalStatus | null {
  if (grade === "Skip" || grade === "B Watchlist") return null
  if (explicit === "active" || explicit === "watchlist" || explicit === "expired") {
    return explicit === "watchlist" ? null : explicit
  }
  if (grade === "A+ Sniper" || grade === "A Strong") return "active"
  return null
}

function parseDetectedAt(value?: string): string {
  if (value?.trim()) {
    const parsed = Date.parse(value.replace(/\./g, "-"))
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString()
  }
  return new Date().toISOString()
}

export async function ingestMt5ScannerSignal(
  supabase: SupabaseClient,
  userId: string,
  raw: Mt5ScannerWebhookPayload,
): Promise<ScannerWebhookResult> {
  const setupId = raw.setup_id?.trim()
  if (!setupId) throw new Mt5WebhookError("Missing setup_id.", 400)

  const grade = normalizeGrade(raw.grade ?? "")
  const status = gradeToStatus(grade, raw.status)
  if (!status) {
    throw new Mt5WebhookError("Skip grade ignored.", 422)
  }

  const pair = normalizePair(raw.pair ?? "")
  if (!pair) throw new Mt5WebhookError("Missing pair.", 400)

  const direction = raw.direction?.toUpperCase()
  if (direction !== "BUY" && direction !== "SELL") {
    throw new Mt5WebhookError("Invalid direction.", 400)
  }

  const score = Number(raw.score)
  if (!Number.isFinite(score)) throw new Mt5WebhookError("Missing score.", 400)

  const riskReward = Number(raw.risk_reward)
  if (!Number.isFinite(riskReward)) throw new Mt5WebhookError("Missing risk_reward.", 400)

  const row = {
    user_id: userId,
    setup_id: setupId,
    pair,
    direction,
    grade,
    score: Math.round(score),
    weekly_bias: raw.weekly_bias ?? raw.daily_bias ?? "Neutral",
    daily_bias: raw.daily_bias ?? "Neutral",
    h4_bias: raw.h4_bias ?? "Neutral",
    zone_type: raw.zone_type ?? "FVG",
    confirmation_type: raw.confirmation_type ?? "None",
    risk_reward: riskReward,
    session: raw.session ?? "Unknown",
    sweep: raw.sweep ?? null,
    choch: raw.choch ?? null,
    status,
    entry_price: raw.entry ?? null,
    stop_loss: raw.stop_loss ?? null,
    take_profit: raw.take_profit ?? null,
    detected_at: parseDetectedAt(raw.detected_at),
    raw_payload: raw as unknown as Record<string, unknown>,
    updated_at: new Date().toISOString(),
  }

  const { data: existing } = await supabase
    .from("scanner_signals")
    .select("id")
    .eq("user_id", userId)
    .eq("setup_id", setupId)
    .maybeSingle()

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from("scanner_signals")
      .update(row)
      .eq("id", existing.id)

    if (updateError) {
      if (isMissingScannerTable(updateError.message)) {
        throw new Mt5WebhookError("Run supabase/047-scanner-signals.sql first.", 503)
      }
      throw new Mt5WebhookError(updateError.message, 500)
    }

    await recordMt5Ping(
      supabase,
      userId,
      { ping: true, ea_version: "scanner-v1.31" },
      `A+ Scanner signal ${grade} · ${pair}.`,
    )

    return {
      setup_id: setupId,
      signal_id: existing.id,
      duplicate: true,
      status,
      email_skipped: "Duplicate setup.",
    }
  }

  const { data, error } = await supabase
    .from("scanner_signals")
    .insert(row)
    .select("id")
    .single()

  if (error) {
    if (isMissingScannerTable(error.message)) {
      throw new Mt5WebhookError("Run supabase/047-scanner-signals.sql first.", 503)
    }
    throw new Mt5WebhookError(error.message, 500)
  }

  await recordMt5Ping(
    supabase,
    userId,
    { ping: true, ea_version: "scanner-v1.31" },
    `A+ Scanner signal ${grade} · ${pair}.`,
  )

  const emailResult = await maybeSendScannerSetupAlert(
    supabase,
    userId,
    raw,
    grade,
    pair,
    direction,
    false,
  )

  return {
    setup_id: setupId,
    signal_id: data.id,
    duplicate: false,
    status,
    email_sent: emailResult.sent,
    email_skipped: emailResult.skippedReason,
  }
}

export { resolveUserByMt5ApiKey }
