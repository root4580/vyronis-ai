import { createHash, randomBytes, timingSafeEqual } from "crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { computeSetupScore } from "@/lib/trade-coach/setup-score-engine"
import type { SetupScoreTradeInput } from "@/lib/trade-coach/setup-score-engine"
import { suggestJournalTags } from "@/lib/journal/csv-import"
import { normalizeMt5WebhookTrade } from "@/lib/mt5/trade-ingest"
import type {
  Mt5TradeWebhookBatchResult,
  Mt5TradeWebhookPayload,
  Mt5TradeWebhookResult,
} from "@/lib/mt5/types"
import { DEFAULT_USER_SETTINGS } from "@/lib/user-settings"
import {
  createPipelineReport,
  finalizePipelineReport,
  logPipelineStage,
} from "@/lib/mt5/pipeline-log"
import { runMt5PostIngestPipeline } from "@/lib/mt5/post-ingest-pipeline"
import { recordMt5Sync } from "@/lib/mt5/sync-status"

export class Mt5WebhookError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message)
    this.name = "Mt5WebhookError"
  }
}

export class Mt5WebhookTableMissingError extends Error {
  constructor(message = "Run supabase/023-mt5-trade-webhook.sql in Supabase first.") {
    super(message)
    this.name = "Mt5WebhookTableMissingError"
  }
}

function isMissingTableError(message: string): boolean {
  return /mt5_webhook|import_source|does not exist|PGRST205/i.test(message)
}

export function generateMt5ApiKey(): string {
  return randomBytes(32).toString("hex")
}

function safeCompareSecret(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest()
  const b = createHash("sha256").update(expected).digest()
  return timingSafeEqual(a, b)
}

export type Mt5WebhookUserContext = {
  user_id: string
  max_risk_per_trade: number
}

export async function resolveUserByMt5ApiKey(
  supabase: SupabaseClient,
  apiKey: string,
): Promise<Mt5WebhookUserContext> {
  const trimmed = apiKey.trim()
  if (!trimmed) {
    throw new Mt5WebhookError("Missing API key.", 401)
  }

  const { data, error } = await supabase
    .from("user_settings")
    .select("user_id, max_risk_per_trade, mt5_webhook_api_key, mt5_webhook_enabled")
    .eq("mt5_webhook_api_key", trimmed)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error.message)) throw new Mt5WebhookTableMissingError()
    throw new Mt5WebhookError("Could not validate API key.", 500)
  }

  if (!data?.mt5_webhook_api_key || !safeCompareSecret(trimmed, data.mt5_webhook_api_key)) {
    throw new Mt5WebhookError("Invalid API key.", 401)
  }

  if (!data.mt5_webhook_enabled) {
    await supabase
      .from("user_settings")
      .update({ mt5_webhook_enabled: true, updated_at: new Date().toISOString() })
      .eq("user_id", data.user_id)
  }

  return {
    user_id: data.user_id,
    max_risk_per_trade: data.max_risk_per_trade ?? DEFAULT_USER_SETTINGS.max_risk_per_trade,
  }
}

async function fetchExistingTradeId(
  supabase: SupabaseClient,
  userId: string,
  ticket: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("trades")
    .select("id")
    .eq("user_id", userId)
    .eq("import_source", "mt5_webhook")
    .eq("external_ticket", ticket)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error.message)) throw new Mt5WebhookTableMissingError()
    throw new Mt5WebhookError(error.message, 500)
  }

  return data?.id ?? null
}

async function assertResearchStrategy(
  supabase: SupabaseClient,
  userId: string,
  strategyId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("research_strategies")
    .select("id")
    .eq("user_id", userId)
    .eq("id", strategyId)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error.message)) throw new Mt5WebhookTableMissingError()
    throw new Mt5WebhookError(error.message, 500)
  }

  if (!data?.id) {
    throw new Mt5WebhookError("Invalid research_strategy_id for this user.", 400)
  }
}

function buildTradeInsertPayload(
  trade: ReturnType<typeof normalizeMt5WebhookTrade>,
  user: Mt5WebhookUserContext,
  rawPayload: Record<string, unknown>,
  researchStrategyId: string | null,
) {
  const suggestions = suggestJournalTags(trade)

  const setupInput: SetupScoreTradeInput = {
    direction: trade.direction,
    result: trade.result,
    emotion: suggestions.emotion,
    setup: suggestions.setup,
    strategy_name: null,
    risk_percent: user.max_risk_per_trade,
    rule_followed: true,
    session: trade.session,
    trade_date: trade.trade_date,
    mistake_tags: suggestions.mistake_tags.join(","),
    stop_loss: trade.stop_loss,
    take_profit: trade.take_profit,
    risk_reward: trade.risk_reward,
  }

  const setupScore = computeSetupScore({
    trade: setupInput,
    maxRiskPerTrade: user.max_risk_per_trade,
  })

  return {
    user_id: user.user_id,
    pair: trade.pair,
    direction: trade.direction,
    result: trade.result,
    pnl: trade.pnl,
    emotion: suggestions.emotion,
    setup: suggestions.setup,
    strategy_name: researchStrategyId ? "MT5 EA" : null,
    risk_percent: user.max_risk_per_trade,
    rule_followed: true,
    trade_date: trade.trade_date,
    session: trade.session,
    stop_loss: trade.stop_loss,
    take_profit: trade.take_profit,
    risk_reward: trade.risk_reward,
    emotion_after: trade.result === "LOSS" ? "Anxious" : trade.result === "WIN" ? "Calm" : null,
    mistake_tags: suggestions.mistake_tags.length ? suggestions.mistake_tags.join(",") : null,
    trade_notes: trade.trade_notes ?? suggestions.trade_notes,
    setup_score: setupScore.score,
    setup_classification: setupScore.classification,
    setup_score_breakdown: setupScore.breakdown,
    setup_coaching_insights: setupScore.insights,
    import_source: "mt5_webhook" as const,
    external_ticket: trade.external_ticket,
    research_strategy_id: researchStrategyId,
    magic_number: trade.magic_number,
    broker: trade.broker,
    account_login: trade.account_login,
    opened_at: trade.opened_at,
    closed_at: trade.closed_at,
    entry_price: trade.entry_price ?? null,
    lots: trade.lots,
    commission: trade.commission,
    swap: trade.swap,
    raw_payload: rawPayload,
  }
}

async function upsertTrade(
  supabase: SupabaseClient,
  user: Mt5WebhookUserContext,
  payload: Mt5TradeWebhookPayload,
  report: ReturnType<typeof createPipelineReport>,
): Promise<Mt5TradeWebhookResult> {
  const normalizeStarted = Date.now()
  const normalized = normalizeMt5WebhookTrade(payload)
  const ticket = normalized.external_ticket
  report.ticket = ticket
  report.trade_date = normalized.trade_date

  logPipelineStage(report, "normalize", "ok", {
    ms: Date.now() - normalizeStarted,
    detail: `${normalized.pair} ${normalized.direction} ${normalized.result} pnl=${normalized.pnl}`,
  })

  const existingId = await fetchExistingTradeId(supabase, user.user_id, ticket)

  const researchStrategyId = payload.research_strategy_id?.trim() || null
  if (researchStrategyId) {
    await assertResearchStrategy(supabase, user.user_id, researchStrategyId)
  }

  const insertPayload = buildTradeInsertPayload(
    normalized,
    user,
    payload as unknown as Record<string, unknown>,
    researchStrategyId,
  )

  const saveStarted = Date.now()
  let tradeId: string | undefined
  let duplicate = false
  let message = "Trade saved."

  if (existingId) {
    if (payload.replace) {
      const { error } = await supabase
        .from("trades")
        .update(insertPayload)
        .eq("id", existingId)
        .eq("user_id", user.user_id)

      if (error) {
        if (isMissingTableError(error.message)) throw new Mt5WebhookTableMissingError()
        logPipelineStage(report, "supabase_save", "error", { error: error.message })
        throw new Mt5WebhookError(error.message, 500)
      }

      tradeId = existingId
      message = "Existing trade updated by ticket."
      logPipelineStage(report, "supabase_save", "ok", {
        ms: Date.now() - saveStarted,
        detail: `updated trade_id=${tradeId}`,
      })
    } else {
      duplicate = true
      tradeId = existingId
      message = "Duplicate ticket skipped."
      logPipelineStage(report, "supabase_save", "skipped", {
        detail: `existing trade_id=${existingId}`,
      })
    }
  } else {
    const { data, error } = await supabase
      .from("trades")
      .insert([insertPayload])
      .select("id")
      .single()

    if (error) {
      if (/duplicate key|unique constraint|23505/i.test(error.message)) {
        const dupId = await fetchExistingTradeId(supabase, user.user_id, ticket)
        duplicate = true
        tradeId = dupId ?? undefined
        message = "Duplicate ticket skipped."
        logPipelineStage(report, "supabase_save", "skipped", {
          detail: "unique constraint — treated as duplicate",
        })
      } else {
        if (isMissingTableError(error.message)) throw new Mt5WebhookTableMissingError()
        logPipelineStage(report, "supabase_save", "error", { error: error.message })
        throw new Mt5WebhookError(error.message, 500)
      }
    } else {
      tradeId = data.id
      logPipelineStage(report, "supabase_save", "ok", {
        ms: Date.now() - saveStarted,
        detail: `inserted trade_id=${tradeId}`,
      })
    }
  }

  report.trade_id = tradeId

  if (normalized.trade_date) {
    logPipelineStage(report, "journal_calendar", "ok", {
      detail: `trade_date=${normalized.trade_date} (journal query includes mt5_webhook)`,
    })
  } else {
    logPipelineStage(report, "journal_calendar", "error", {
      error: "Missing trade_date — trade may not appear on the expected calendar day",
    })
  }

  const baseResult: Mt5TradeWebhookResult = {
    ok: true,
    duplicate,
    trade_id: tradeId,
    ticket,
    result: normalized.result,
    trade_date: normalized.trade_date,
    message,
    pipeline: report,
  }

  if (!tradeId || duplicate) {
    logPipelineStage(report, "intelligence_sync", "skipped", {
      detail: duplicate ? "duplicate ticket — no re-analysis" : "no trade_id",
    })
    logPipelineStage(report, "setup_score", "skipped", { detail: "ingest only on new/updated trade" })
    logPipelineStage(report, "ai_insight", "skipped", { detail: "ingest only on new/updated trade" })
    logPipelineStage(report, "discipline_metrics", "skipped", {
      detail: "ingest only on new/updated trade",
    })
    baseResult.pipeline = finalizePipelineReport(report)
    await recordMt5Sync(supabase, user.user_id, {
      status: duplicate ? "duplicate" : "ok",
      ticket,
      message,
    })
    return baseResult
  }

  baseResult.pipeline = await runMt5PostIngestPipeline(supabase, user.user_id, tradeId, report)
  await recordMt5Sync(supabase, user.user_id, {
    status: "ok",
    ticket,
    message: duplicate ? message : "Trade saved with AI analysis.",
  })
  return baseResult
}

export async function ingestMt5Trade(
  supabase: SupabaseClient,
  user: Mt5WebhookUserContext,
  payload: Mt5TradeWebhookPayload,
): Promise<Mt5TradeWebhookResult> {
  const report = createPipelineReport()
  logPipelineStage(report, "auth", "ok", {
    detail: `user_id=${user.user_id}`,
  })
  const result = await upsertTrade(supabase, user, payload, report)
  return result
}

export async function ingestMt5TradeBatch(
  supabase: SupabaseClient,
  user: Mt5WebhookUserContext,
  trades: Mt5TradeWebhookPayload[],
): Promise<Mt5TradeWebhookBatchResult> {
  const results: Mt5TradeWebhookResult[] = []
  const errors: Array<{ ticket?: string; message: string }> = []
  let imported = 0
  let duplicates = 0

  console.log(`[MT5 Pipeline] batch ingest user_id=${user.user_id} count=${trades.length}`)

  for (const trade of trades) {
    try {
      const report = createPipelineReport()
      logPipelineStage(report, "auth", "ok", { detail: `user_id=${user.user_id}` })
      const result = await upsertTrade(supabase, user, trade, report)
      results.push(result)
      if (result.duplicate) duplicates += 1
      else imported += 1
    } catch (error) {
      errors.push({
        ticket: String(trade.ticket),
        message: error instanceof Error ? error.message : "Ingest failed",
      })
    }
  }

  return {
    ok: true,
    imported,
    duplicates,
    errors,
    results,
  }
}
