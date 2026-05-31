import type { TradeFormState } from "@/lib/trade-form-config"
import { createInitialTradeForm } from "@/lib/trade-form-config"
import { extractResponsesFromMessages } from "@/lib/trade-coach/pre-trade-flow"
import type {
  PlannedCoachSessionItem,
  PreTradePlannedContext,
  TradeCoachSessionWithMessages,
} from "@/lib/trade-coach/types"

export function buildPlannedContextFromForm(
  form: TradeFormState,
  maxRiskPerTrade?: number,
): PreTradePlannedContext {
  return {
    pair: form.pair || undefined,
    direction: form.direction || undefined,
    setup: form.setup || undefined,
    strategy_name: form.strategy_name || null,
    risk_percent: form.risk_percent || undefined,
    session: form.session || undefined,
    entry_price: form.entry_price || undefined,
    stop_loss: form.stop_loss || undefined,
    take_profit: form.take_profit || undefined,
    emotion: form.emotion || undefined,
    rule_followed: form.rule_followed,
    trade_date: form.trade_date || undefined,
    confirmation_signal: form.confirmation_signal || null,
    higher_timeframe: form.higher_timeframe || undefined,
    entry_timeframe: form.entry_timeframe || undefined,
    confirmation_timeframe: form.confirmation_timeframe || undefined,
    chart_url: form.screenshot_url || undefined,
    max_risk_per_trade: maxRiskPerTrade,
  }
}

export function buildEmptyPlannedContext(): PreTradePlannedContext {
  return {
    trade_date: new Date().toISOString().split("T")[0],
  }
}

export function buildPlanSummary(
  context: PreTradePlannedContext,
  responses: Record<string, string> = {},
): string {
  if (context.coach_analysis?.summary) {
    return context.coach_analysis.summary
  }

  if (context.chart_analysis?.summary) {
    return context.chart_analysis.summary
  }

  const thesis = responses.setup_thesis?.trim()
  if (thesis) {
    return thesis.length > 160 ? `${thesis.slice(0, 157)}...` : thesis
  }

  const execution = responses.execution_plan?.trim()
  if (execution) {
    return execution.length > 160 ? `${execution.slice(0, 157)}...` : execution
  }

  const pair = context.pair || "Trade"
  const direction = context.direction || "plan"
  return `${pair} ${direction} pre-trade check-in saved.`
}

export function buildPlannedCoachSessionItem(
  session: {
    id: string
    status: PlannedCoachSessionItem["status"]
    planned_context: PreTradePlannedContext
    created_at: string
    updated_at: string
  },
  responses: Record<string, string> = {},
): PlannedCoachSessionItem {
  const context = session.planned_context || {}
  const risk =
    responses.planned_risk?.trim() ||
    (context.risk_percent ? `${context.risk_percent}%` : null)
  const emotion = responses.emotional_state?.trim() || context.emotion || null

  return {
    id: session.id,
    status: session.status,
    pair: context.pair ?? null,
    direction: context.direction ?? null,
    risk,
    emotion,
    plan_summary: buildPlanSummary(context, responses),
    confidence_score: context.coach_analysis?.confidenceScore ?? null,
    should_take_trade: context.coach_analysis?.shouldTakeTrade ?? null,
    signal_source: context.signal_source ?? "manual",
    strategy_name: context.strategy_name ?? null,
    timeframe: context.entry_timeframe ?? null,
    ai_recommendation: context.coach_analysis
      ? context.coach_analysis.shouldTakeTrade === "yes"
        ? "TAKE"
        : context.coach_analysis.shouldTakeTrade === "no"
          ? "SKIP"
          : "CAUTION"
      : null,
    trade_plan_id: context.trade_plan_id ?? null,
    tradingview_signal_id: context.tradingview_signal_id ?? null,
    trade_date: context.trade_date ?? null,
    created_at: session.created_at,
    updated_at: session.updated_at,
  }
}

export function buildTradeFormFromPlannedSession(
  session: TradeCoachSessionWithMessages,
): TradeFormState {
  const context = session.planned_context || {}
  const responses = extractResponsesFromMessages(session.messages)
  const base = createInitialTradeForm()

  const plannedRisk = responses.planned_risk?.replace("%", "").trim()

  return {
    ...base,
    pair: context.pair || base.pair,
    direction: context.direction || base.direction,
    risk_percent: plannedRisk || context.risk_percent || base.risk_percent,
    emotion: responses.emotional_state || context.emotion || base.emotion,
    stop_loss: responses.planned_sl || context.stop_loss || "",
    take_profit: responses.planned_tp || context.take_profit || "",
    entry_price: context.entry_price || "",
    rule_followed: responses.rule_check?.toLowerCase() !== "no",
    setup: context.setup || base.setup,
    strategy_name: context.strategy_name || "",
    session: context.session || "",
    confirmation_signal: context.confirmation_signal || "",
    trade_date: context.trade_date || base.trade_date,
    screenshot_url: session.m15_screenshot_url || session.h1_screenshot_url || session.screenshot_url || session.chart_url || context.chart_url || "",
    higher_timeframe: context.higher_timeframe || "",
    entry_timeframe: context.entry_timeframe || "",
    confirmation_timeframe: context.confirmation_timeframe || "",
    trade_notes: context.mtf_analysis?.summary || context.chart_analysis?.summary || "",
  }
}
