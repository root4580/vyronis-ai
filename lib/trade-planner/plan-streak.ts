import {
  buildTradeActualForDeviation,
  computePlanDiscipline,
  type PlanDisciplineGrade,
} from "@/lib/trade-planner/deviation-engine"
import type { MatchableTradePlan } from "@/lib/trade-planner/plan-match"
import type { PlanDisciplineTradeRow } from "@/lib/trade-planner/plan-discipline-aggregate"

export type PlanStreakDotState = "on" | "off" | "unlinked"

export type PlanStreakResult = {
  streakCount: number
  dots: PlanStreakDotState[]
}

const FOLLOW_THRESHOLD = 60
const MAX_DOTS = 10

function tradeSortKey(trade: PlanDisciplineTradeRow): string {
  return trade.created_at || trade.trade_date || ""
}

function scoreForTrade(
  trade: PlanDisciplineTradeRow,
  plansById: Map<string, MatchableTradePlan>,
): number | null {
  if (!trade.plan_id) return null
  const plan = plansById.get(trade.plan_id)
  if (!plan) return null
  return computePlanDiscipline(
    plan,
    buildTradeActualForDeviation({
      pair: trade.pair,
      direction: trade.direction,
      entryPrice: trade.entry_price ?? null,
      stopLoss: trade.stop_loss ?? null,
      takeProfit: trade.take_profit ?? null,
      riskPercent: trade.risk_percent ?? null,
      riskReward: trade.risk_reward ?? null,
      accountSizeForRisk: plan.accountSize,
    }),
  ).score
}

export function computePlanStreak(input: {
  trades: PlanDisciplineTradeRow[]
  plansById: Map<string, MatchableTradePlan>
}): PlanStreakResult {
  const sorted = [...input.trades].sort((a, b) => tradeSortKey(b).localeCompare(tradeSortKey(a)))

  let streakCount = 0
  let streakLocked = false

  for (const trade of sorted) {
    if (streakLocked) break
    if (!trade.plan_id) {
      streakLocked = true
      continue
    }
    const score = scoreForTrade(trade, input.plansById)
    if (score == null || score < FOLLOW_THRESHOLD) {
      streakLocked = true
      continue
    }
    streakCount += 1
  }

  const dots: PlanStreakDotState[] = sorted.slice(0, MAX_DOTS).map((trade) => {
    if (!trade.plan_id) return "unlinked"
    const score = scoreForTrade(trade, input.plansById)
    if (score == null || score < FOLLOW_THRESHOLD) return "off"
    return "on"
  })

  return { streakCount, dots }
}

export function disciplineGradeBoxClass(grade: PlanDisciplineGrade | null): string {
  switch (grade) {
    case "A":
      return "border-profit/20 bg-profit/10 text-profit"
    case "B":
      return "border-[var(--color-accent-border)] bg-[var(--color-accent-bg)] text-text-accent"
    case "C":
      return "border-[var(--warning-border)] bg-[var(--warning-bg)] text-warning-foreground"
    case "D":
      return "border-loss/20 bg-loss/10 text-loss"
    default:
      return "border-[var(--border-subtle)] bg-white/[0.03] text-text-muted"
  }
}
