import { timingSafeEqual, createHash } from "crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createPreTradeSession } from "@/lib/trade-coach/server-service"
import { sendTradingViewAlertEmail } from "@/lib/email/tradingview-alert-email"
import { buildTradingViewSignalAnalysis } from "@/lib/tradingview/signal-composite-analysis"
import { gradeMeetsMinimum } from "@/lib/tradingview/signal-war-room-grader"
import { buildPlannedContextFromSignal } from "@/lib/tradingview/planned-context-mapper"
import { normalizeAlertPayload } from "@/lib/tradingview/signal-normalizer"
import type {
  TradingViewAlertPayload,
  TradingViewSignalAnalysis,
  TradingViewWebhookResult,
} from "@/lib/tradingview/types"

export type TradingViewIngestChartVisionContext = {
  userId: string
  signalId: string
  coachSessionId: string
  normalized: ReturnType<typeof normalizeAlertPayload>
  analysis: TradingViewSignalAnalysis
  maxRiskPerTrade: number
  image_url?: string | null
  screenshot_url?: string | null
}
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
  constructor(message = "Run supabase/RUN-TRADINGVIEW-SIGNALS.sql in Supabase SQL Editor, then retry.") {
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

type WebhookUserContext = {
  user_id: string
  max_risk_per_trade: number
  preferred_session: string | null
}

function mapWebhookUserRow(
  row: {
    user_id: string
    max_risk_per_trade: number | null
    preferred_session: string | null
    tradingview_webhook_secret: string | null
    tradingview_webhook_enabled: boolean | null
  },
  providedSecret: string,
): WebhookUserContext {
  const trimmed = providedSecret.trim()
  if (!row.tradingview_webhook_enabled) {
    throw new TradingViewWebhookError("TradingView webhook is disabled in Account Settings.", 400)
  }
  if (!row.tradingview_webhook_secret || !safeCompareSecret(trimmed, row.tradingview_webhook_secret)) {
    throw new TradingViewWebhookError("Invalid webhook secret.", 401)
  }
  return {
    user_id: row.user_id,
    max_risk_per_trade: row.max_risk_per_trade ?? DEFAULT_USER_SETTINGS.max_risk_per_trade,
    preferred_session: row.preferred_session ?? null,
  }
}

async function resolveUserBySecret(
  supabase: SupabaseClient,
  secret: string,
): Promise<WebhookUserContext> {
  const trimmed = secret.trim()
  const { data, error } = await supabase
    .from("user_settings")
    .select("user_id, max_risk_per_trade, preferred_session, tradingview_webhook_secret, tradingview_webhook_enabled")
    .eq("tradingview_webhook_enabled", true)
    .eq("tradingview_webhook_secret", trimmed)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error.message)) throw new TradingViewTableMissingError()
    throw new TradingViewWebhookError(
      `Could not validate webhook secret. ${error.message} (check SUPABASE_SERVICE_ROLE_KEY on Vercel).`,
      500,
    )
  }

  if (!data) {
    throw new TradingViewWebhookError("Invalid webhook secret.", 401)
  }

  return mapWebhookUserRow(data, trimmed)
}

/** Authenticated test alerts — avoid secret index lookup (service role must still be configured). */
async function resolveUserByUserId(
  supabase: SupabaseClient,
  userId: string,
  secret: string,
  skipSecretValidation = false,
): Promise<WebhookUserContext> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("user_id, max_risk_per_trade, preferred_session, tradingview_webhook_secret, tradingview_webhook_enabled")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error.message)) throw new TradingViewTableMissingError()
    throw new TradingViewWebhookError(
      `Could not load webhook settings. ${error.message}`,
      500,
    )
  }

  if (!data) {
    throw new TradingViewWebhookError("User settings not found.", 404)
  }

  if (skipSecretValidation) {
    if (!data.tradingview_webhook_enabled) {
      throw new TradingViewWebhookError("TradingView webhook is disabled in Account Settings.", 400)
    }
    return {
      user_id: data.user_id,
      max_risk_per_trade: data.max_risk_per_trade ?? DEFAULT_USER_SETTINGS.max_risk_per_trade,
      preferred_session: data.preferred_session ?? null,
    }
  }

  return mapWebhookUserRow(data, secret)
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

export type TradingViewIngestOutcome = {
  result: TradingViewWebhookResult
  chartVision?: TradingViewIngestChartVisionContext
}

export type TradingViewIngestOptions = {
  /** In-app test alert: use session client + skip secret DB lookup */
  trustedUserId?: string
  skipSecretValidation?: boolean
}

export async function ingestTradingViewAlert(
  supabase: SupabaseClient,
  payload: TradingViewAlertPayload,
  rawPayload: Record<string, unknown>,
  options?: TradingViewIngestOptions,
): Promise<TradingViewIngestOutcome> {
  if (!payload.secret?.trim() && !options?.skipSecretValidation) {
    throw new TradingViewWebhookError("Missing webhook secret.", 401)
  }

  const user = options?.trustedUserId
    ? await resolveUserByUserId(
        supabase,
        options.trustedUserId,
        payload.secret?.trim() ?? "",
        options.skipSecretValidation,
      )
    : await resolveUserBySecret(supabase, payload.secret!.trim())
  const normalized = normalizeAlertPayload(payload)

  if (!normalized.symbol || normalized.symbol === "UNKNOWN") {
    throw new TradingViewWebhookError("Missing or invalid symbol.", 400)
  }
  if (!payload.direction?.trim()) {
    throw new TradingViewWebhookError("Missing direction.", 400)
  }

  const isVyronisTestAlert = rawPayload.source === "vyronis_test_alert"
  if (
    !isVyronisTestAlert &&
    (await isDuplicateAlert(supabase, user.user_id, normalized.symbol, normalized.direction))
  ) {
    return {
      result: {
        ok: true,
        duplicate: true,
        message: "Duplicate alert skipped (15 min window).",
      },
    }
  }

  const analysis = await buildTradingViewSignalAnalysis(supabase, user.user_id, {
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

  let emailSent = false
  if (gradeMeetsMinimum(analysis.setup_grade) && typeof supabase.auth.admin?.getUserById === "function") {
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(
      user.user_id,
    )
    const email = authUser?.user?.email
    if (!authError && email) {
      const result = await sendTradingViewAlertEmail({
        to: email,
        symbol: normalized.symbol,
        direction: normalized.direction,
        setupGrade: analysis.setup_grade,
        setupVerdict: analysis.setup_verdict,
        verdictSummary: analysis.verdict_summary,
        alignmentScore: analysis.confidence_score,
        strategyName: normalized.strategy_name,
        coachSessionId: session.id,
      })
      emailSent = result.sent
    }
  }

  return {
    result: {
      ok: true,
      signalId: signal.id,
      coachSessionId: session.id,
      user_id: user.user_id,
      setup_grade: analysis.setup_grade,
      setup_verdict: analysis.setup_verdict,
      email_sent: emailSent,
      chart_vision_scheduled: true,
      message: analysis.meets_minimum_grade
        ? `Grade ${analysis.setup_grade} — ${analysis.verdict_summary}${emailSent ? " Email sent." : ""} Chart vision runs in the background.`
        : `Grade ${analysis.setup_grade} (below your B+ rule) — ${analysis.verdict_summary} Chart vision runs in the background.`,
    },
    chartVision: {
      userId: user.user_id,
      signalId: signal.id,
      coachSessionId: session.id,
      normalized,
      analysis,
      maxRiskPerTrade: user.max_risk_per_trade,
      image_url: payload.image_url,
      screenshot_url: payload.screenshot_url,
    },
  }
}

export function generateWebhookSecret(): string {
  return createHash("sha256")
    .update(`${Date.now()}-${Math.random()}-vyronis`)
    .digest("hex")
    .slice(0, 48)
}
