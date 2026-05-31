import { calculatePips } from "@/lib/trade-planner/trade-plan-engine"
import type { MatchableTradePlan } from "@/lib/trade-planner/plan-match"
import type { PlanDisciplineResult } from "@/lib/trade-planner/deviation-engine"
import { formatPnL } from "@/lib/trade-utils"

export type PlanWhatIfInput = {
  plan: MatchableTradePlan
  trade: {
    result: string
    pnl: number
    direction: string
    entryPrice: number | null
    stopLoss: number | null
    takeProfit: number | null
  }
  discipline: PlanDisciplineResult
}

export type PlanWhatIfResult = {
  actualPnl: number
  actualResult: string
  plannedWinPnl: number | null
  plannedLossPnl: number | null
  followPlanPnl: number | null
  pnlDelta: number | null
  headline: string
  detail: string
}

function normalizeResult(result: string): string {
  return result.trim().toUpperCase()
}

function signedPnl(pnl: number, result: string): number {
  const normalized = normalizeResult(result)
  if (normalized === "LOSS") return -Math.abs(pnl)
  if (normalized === "WIN") return Math.abs(pnl)
  return 0
}

export function computePlanWhatIf(input: PlanWhatIfInput): PlanWhatIfResult {
  const { plan, trade, discipline } = input
  const actualPnl = signedPnl(trade.pnl, trade.result)
  const result = normalizeResult(trade.result)

  const plannedWinPnl =
    plan.riskAmount > 0 && plan.rr != null && plan.rr > 0
      ? Number((plan.riskAmount * plan.rr).toFixed(2))
      : null
  const plannedLossPnl = plan.riskAmount > 0 ? Number((-plan.riskAmount).toFixed(2)) : null

  let followPlanPnl: number | null = null
  if (result === "WIN" && plannedWinPnl != null) followPlanPnl = plannedWinPnl
  else if (result === "LOSS" && plannedLossPnl != null) followPlanPnl = plannedLossPnl
  else if (result === "BREAKEVEN") followPlanPnl = 0

  const pnlDelta = followPlanPnl != null ? Number((followPlanPnl - actualPnl).toFixed(2)) : null

  const slField = discipline.fields.find((field) => field.field === "Stop loss")
  const tpField = discipline.fields.find((field) => field.field === "Take profit")
  const slPips =
    trade.entryPrice != null && trade.stopLoss != null
      ? calculatePips(plan.pair, trade.entryPrice, trade.stopLoss)
      : null
  const planSlPips = calculatePips(plan.pair, plan.entryPrice, plan.stopLoss)

  let headline = "Plan vs actual outcome"
  let detail = "Compare what you planned versus what you logged."

  if (followPlanPnl != null && pnlDelta != null) {
    const plannedLabel = formatPnL(followPlanPnl, result === "LOSS" ? "LOSS" : result === "WIN" ? "WIN" : "BREAKEVEN")
    const actualLabel = formatPnL(actualPnl, trade.result)

    if (Math.abs(pnlDelta) < 1) {
      headline = "Outcome aligned with plan sizing"
      detail = `Actual ${actualLabel} matches plan-sized ${plannedLabel} at ${plan.rr != null ? `1:${plan.rr.toFixed(2)}` : "your planned R:R"}.`
    } else if (pnlDelta > 0) {
      headline = "Plan-sized exit would have earned more"
      detail = `You logged ${actualLabel}, but following your plan exactly (${plannedLabel} at plan risk) would have been $${Math.abs(pnlDelta).toFixed(2)} better.`
    } else {
      headline = "Actual result differed from plan-sized outcome"
      detail = `You logged ${actualLabel}. A plan-perfect ${result === "WIN" ? "win" : result === "LOSS" ? "loss" : "result"} at planned risk would have been ${plannedLabel} (${Math.abs(pnlDelta).toFixed(2)} difference).`
    }
  }

  if (slField?.severity === "red" || slField?.severity === "amber") {
    if (slPips != null && planSlPips > 0 && slPips < planSlPips * 0.85) {
      detail += " Your stop was tighter than plan — you may have been stopped before the planned invalidation."
    } else if (slPips != null && planSlPips > 0 && slPips > planSlPips * 1.15) {
      detail += " Your stop was wider than plan — you risked more dollars per pip than intended."
    }
  }

  if (tpField?.severity === "red" || tpField?.severity === "amber") {
    detail += " Take profit differed from plan — consider targeting liquidity / FVG levels you marked pre-trade."
  }

  if (discipline.score < 70) {
    detail += ` Discipline ${discipline.grade} (${discipline.score}/100) — review the largest deviations before the next session.`
  }

  return {
    actualPnl,
    actualResult: trade.result,
    plannedWinPnl,
    plannedLossPnl,
    followPlanPnl,
    pnlDelta,
    headline,
    detail: detail.trim(),
  }
}
