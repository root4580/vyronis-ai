import type { PreTradePlannedContext } from "@/lib/trade-coach/types"
import { formatRiskReward } from "@/lib/trade-planner/trade-plan-engine"
import type { PlanDisciplineResult } from "@/lib/trade-planner/deviation-engine"
import type { MatchableTradePlan } from "@/lib/trade-planner/plan-match"
import { formatPnL } from "@/lib/trade-utils"

export function buildCoachContextFromPlanDeviation(input: {
  plan: MatchableTradePlan
  trade: {
    pair: string
    direction: string
    result: string
    pnl: number
    entryPrice?: number | null
    stopLoss?: number | null
    takeProfit?: number | null
    riskPercent?: number | null
    emotion?: string | null
    tradeDate?: string | null
  }
  discipline: PlanDisciplineResult
  maxRiskPerTrade?: number
}): PreTradePlannedContext {
  const { plan, trade, discipline, maxRiskPerTrade } = input
  const worst = discipline.worstDeviations
    .map((field) => `${field.field}: ${field.note}`)
    .join(" · ")
  const deviationSummary =
    worst ||
    discipline.fields
      .filter((field) => field.severity !== "green" && field.severity !== "na")
      .slice(0, 2)
      .map((field) => `${field.field} — ${field.note}`)
      .join(" · ")

  return {
    pair: trade.pair || plan.pair,
    direction: trade.direction || plan.direction,
    entry_price: trade.entryPrice != null ? String(trade.entryPrice) : String(plan.entryPrice),
    stop_loss: trade.stopLoss != null ? String(trade.stopLoss) : String(plan.stopLoss),
    take_profit: trade.takeProfit != null ? String(trade.takeProfit) : String(plan.takeProfit),
    risk_percent: trade.riskPercent != null ? String(trade.riskPercent) : String(plan.riskPercent),
    emotion: trade.emotion || undefined,
    trade_date: trade.tradeDate || new Date().toISOString().split("T")[0],
    rule_followed: discipline.score >= 70,
    setup: `Post-trade plan review — discipline ${discipline.grade} (${discipline.score}/100) · planned ${formatRiskReward(plan.rr)} · actual ${formatPnL(trade.pnl, trade.result)}`,
    confirmation_signal: deviationSummary || "Plan-linked trade logged — review deviations with Coach.",
    max_risk_per_trade: maxRiskPerTrade,
  }
}
