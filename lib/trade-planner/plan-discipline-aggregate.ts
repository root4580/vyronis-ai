import {
  buildTradeActualForDeviation,
  computePlanDiscipline,
  disciplineGradeLabel,
  type PlanDisciplineGrade,
  type PlanDisciplineResult,
} from "@/lib/trade-planner/deviation-engine"
import type { MatchableTradePlan } from "@/lib/trade-planner/plan-match"

export type PlanDisciplineTradeRow = {
  id: string
  plan_id: string | null
  pair: string
  direction: string
  result: string
  pnl: number
  trade_date: string | null
  created_at: string
  entry_price?: number | null
  stop_loss?: number | null
  take_profit?: number | null
  risk_percent?: number | null
  risk_reward?: number | null
}

export type PlanDisciplineAggregate = {
  linkedTradeCount: number
  weekTradeCount: number
  monthTradeCount: number
  weekAverageScore: number | null
  monthAverageScore: number | null
  weekGrade: PlanDisciplineGrade | null
  monthGrade: PlanDisciplineGrade | null
  trendDelta: number | null
  recentScores: { tradeId: string; pair: string; score: number; grade: PlanDisciplineGrade; date: string }[]
}

function gradeFromScore(score: number): PlanDisciplineGrade {
  if (score >= 80) return "A"
  if (score >= 60) return "B"
  if (score >= 40) return "C"
  return "D"
}

function averageScore(scores: number[]): number | null {
  if (scores.length === 0) return null
  return Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length)
}

function isWithinDays(isoDate: string, days: number, now = new Date()): boolean {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return false
  const ms = days * 24 * 60 * 60 * 1000
  return now.getTime() - date.getTime() <= ms
}

function tradeDateKey(trade: PlanDisciplineTradeRow): string {
  return trade.trade_date || trade.created_at.split("T")[0] || trade.created_at
}

export function computePlanDisciplineForTrade(
  trade: PlanDisciplineTradeRow,
  plan: MatchableTradePlan,
): PlanDisciplineResult {
  return computePlanDiscipline(
    plan,
    buildTradeActualForDeviation({
      pair: trade.pair,
      direction: trade.direction,
      entryPrice: trade.entry_price ?? null,
      stopLoss: trade.stop_loss ?? null,
      takeProfit: trade.take_profit ?? null,
      lots: plan.recommendedLots,
      riskPercent: trade.risk_percent ?? null,
      riskReward: trade.risk_reward ?? null,
      accountSizeForRisk: plan.accountSize,
    }),
  )
}

export function buildPlanDisciplineAggregate(input: {
  trades: PlanDisciplineTradeRow[]
  plansById: Map<string, MatchableTradePlan>
  now?: Date
}): PlanDisciplineAggregate {
  const now = input.now ?? new Date()
  const scored: {
    tradeId: string
    pair: string
    score: number
    grade: PlanDisciplineGrade
    date: string
    isWeek: boolean
    isMonth: boolean
  }[] = []

  for (const trade of input.trades) {
    if (!trade.plan_id) continue
    const plan = input.plansById.get(trade.plan_id)
    if (!plan) continue

    const discipline = computePlanDisciplineForTrade(trade, plan)
    const dateKey = tradeDateKey(trade)
    scored.push({
      tradeId: trade.id,
      pair: trade.pair,
      score: discipline.score,
      grade: discipline.grade,
      date: dateKey,
      isWeek: isWithinDays(`${dateKey}T12:00:00`, 7, now),
      isMonth: isWithinDays(`${dateKey}T12:00:00`, 30, now),
    })
  }

  const weekScores = scored.filter((row) => row.isWeek).map((row) => row.score)
  const monthScores = scored.filter((row) => row.isMonth).map((row) => row.score)
  const weekAverageScore = averageScore(weekScores)
  const monthAverageScore = averageScore(monthScores)

  const priorWeekScores = scored
    .filter((row) => isWithinDays(`${row.date}T12:00:00`, 14, now) && !row.isWeek)
    .map((row) => row.score)
  const priorWeekAverage = averageScore(priorWeekScores)
  const trendDelta =
    weekAverageScore != null && priorWeekAverage != null
      ? weekAverageScore - priorWeekAverage
      : null

  return {
    linkedTradeCount: scored.length,
    weekTradeCount: weekScores.length,
    monthTradeCount: monthScores.length,
    weekAverageScore,
    monthAverageScore,
    weekGrade: weekAverageScore != null ? gradeFromScore(weekAverageScore) : null,
    monthGrade: monthAverageScore != null ? gradeFromScore(monthAverageScore) : null,
    trendDelta,
    recentScores: scored
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
      .map(({ tradeId, pair, score, grade, date }) => ({ tradeId, pair, score, grade, date })),
  }
}

export function aggregateHeadline(aggregate: PlanDisciplineAggregate): string {
  if (aggregate.linkedTradeCount === 0) {
    return "Link a plan to your next trade to start tracking discipline."
  }
  if (aggregate.weekAverageScore == null) {
    return `${aggregate.linkedTradeCount} linked trade(s) — log more this week for a trend.`
  }
  const grade = aggregate.weekGrade ?? "C"
  return `Your plan discipline this week: ${grade} (${aggregate.weekAverageScore}/100) — ${disciplineGradeLabel(grade).toLowerCase()}.`
}
