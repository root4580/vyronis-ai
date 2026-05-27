import { timingSafeEqual, createHash } from "crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createPreTradeSession } from "@/lib/trade-coach/server-service"
import { analyzeTradingViewSignal } from "@/lib/tradingview/signal-analysis-engine"
import { buildPlannedContextFromSignal } from "@/lib/tradingview/planned-context-mapper"
import { normalizeAlertPayload } from "@/lib/tradingview/signal-normalizer"
import type { TradingViewAlertPayload, TradingViewWebhookResult } from "@/lib/tradingview/types"
import { DEFAULT_USER_SETTINGS } from "@/lib/user-settings"

export class TradingViewWebhookError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message)
    this.name = "TradingViewWebhookError"
  }
}

export class TradingViewTableMissingError extends Error {
  constructor(message = "Run supabase/013-tradingview-signals.sql in Supabase first.") {
    super(message)
    this.name = "TradingViewTableMissingError"
  }
}

const DEDUPE_WINDOW_MS = 15 * 60 * 1000

function isMissingTableError(message: string): boolean {
  return /tradingview_signals|tradingview_webhook|does not exist|PGRST205/i.test(message)
}

function safeCompareSecret(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest()
  const b = createHash("sha256").update(expected).digest()
  return timingSafeEqual(a, b)
}

async function resolveUserBySecret(
  supabase: SupabaseClient,
  secret: string,
): Promise<{ user_id: string; max_risk_per_trade: number; preferred_session: string | null }> {
  const trimmed = secret.trim()
  const { data, error } = await supabase
    .from("user_settings")
    .select("user_id, max_risk_per_trade, preferred_session, tradingview_webhook_secret, tradingview_webhook_enabled")
    .eq("tradingview_webhook_enabled", true)
    .eq("tradingview_webhook_secret", trimmed)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error.message)) throw new TradingViewTableMissingError()
    throw new TradingViewWebhookError("Could not validate webhook secret.", 500)
  }

  if (!data?.tradingview_webhook_secret || !safeCompareSecret(trimmed, data.tradingview_webhook_secret)) {
    throw new TradingViewWebhookError("Invalid webhook secret.", 401)
  }

  return {
    user_id: data.user_id,
    max_risk_per_trade: data.max_risk_per_trade ?? DEFAULT_USER_SETTINGS.max_risk_per_trade,
    preferred_session: data.preferred_session ?? null,
  }
}

async function isDuplicateAlert(
  supabase: SupabaseClient,
  userId: string,
  symbol: string,
  direction: string,
): Promise<boolean> {
  const since = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString()
  const { data, error } = await supabase
    .from("tradingview_signals")
    .select("id")
    .eq("user_id", userId)
    .eq("symbol", symbol)
    .eq("direction", direction)
    .gte("received_at", since)
    .not("status", "eq", "ignored")
    .limit(1)

  if (error) {
    if (isMissingTableError(error.message)) throw new TradingViewTableMissingError()
    throw new TradingViewWebhookError(error.message, 500)
  }

  return Boolean(data?.length)
}

export async function ingestTradingViewAlert(
  supabase: SupabaseClient,
  payload: TradingViewAlertPayload,
  rawPayload: Record<string, unknown>,
): Promise<TradingViewWebhookResult> {
  if (!payload.secret?.trim()) {
    throw new TradingViewWebhookError("Missing webhook secret.", 401)
  }

  const user = await resolveUserBySecret(supabase, payload.secret.trim())
  const normalized = normalizeAlertPayload(payload)

  if (!normalized.symbol || normalized.symbol === "UNKNOWN") {
    throw new TradingViewWebhookError("Missing or invalid symbol.", 400)
  }
  if (!payload.direction?.trim()) {
    throw new TradingViewWebhookError("Missing direction.", 400)
  }

  if (await isDuplicateAlert(supabase, user.user_id, normalized.symbol, normalized.direction)) {
    return { ok: true, duplicate: true, message: "Duplicate alert skipped (15 min window)." }
  }

  const analysis = analyzeTradingViewSignal({
    symbol: normalized.symbol,
    direction: normalized.direction,
    timeframe: normalized.timeframe,
    strategy_name: normalized.strategy_name,
    entry_zone: normalized.entry_zone,
    entry_price: normalized.entry_price,
    stop_loss: normalized.stop_loss,
    take_profit: normalized.take_profit,
    confidence: normalized.confidence,
    message: normalized.message,
    preferred_session: user.preferred_session,
  })

  const { data: signal, error: signalError } = await supabase
    .from("tradingview_signals")
    .insert({
      user_id: user.user_id,
      symbol: normalized.symbol,
      timeframe: normalized.timeframe,
      direction: normalized.direction,
      strategy_name: normalized.strategy_name,
      entry_zone: normalized.entry_zone,
      stop_loss: normalized.stop_loss,
      take_profit: normalized.take_profit,
      confidence: normalized.confidence,
      message: normalized.message,
      chart_url: normalized.chart_url,
      raw_payload: rawPayload,
      status: "analyzed",
      ai_analysis: analysis,
      ai_confidence_score: analysis.confidence_score,
      ai_recommendation: analysis.recommendation,
      external_alert_id: normalized.external_alert_id,
      analyzed_at: new Date().toISOString(),
    })
    .select("id")
    .single()

  if (signalError || !signal) {
    if (isMissingTableError(signalError?.message || "")) throw new TradingViewTableMissingError()
    throw new TradingViewWebhookError(signalError?.message || "Could not store signal.", 500)
  }

  const plannedContext = buildPlannedContextFromSignal({
    signalId: signal.id,
    symbol: normalized.symbol,
    direction: normalized.direction,
    timeframe: normalized.timeframe,
    strategy_name: normalized.strategy_name,
    entry_zone: normalized.entry_zone,
    entry_price: normalized.entry_price,
    stop_loss: normalized.stop_loss,
    take_profit: normalized.take_profit,
    message: normalized.message,
    chart_url: normalized.chart_url,
    analysis,
    maxRiskPerTrade: user.max_risk_per_trade,
  })

  const session = await createPreTradeSession(supabase, user.user_id, plannedContext)

  const { error: linkError } = await supabase
    .from("tradingview_signals")
    .update({
      coach_session_id: session.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", signal.id)

  if (linkError) {
    throw new TradingViewWebhookError(linkError.message, 500)
  }

  return {
    ok: true,
    signalId: signal.id,
    coachSessionId: session.id,
    message: "Alert ingested and planned trade card created.",
  }
}

export function generateWebhookSecret(): string {
  return createHash("sha256")
    .update(`${Date.now()}-${Math.random()}-vyronis`)
    .digest("hex")
    .slice(0, 48)
}
