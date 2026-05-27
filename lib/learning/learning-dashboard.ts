import { buildMistakeAnalysis } from "@/lib/mistake-analysis"
import { generatePatternMemory } from "@/lib/trade-coach/pattern-memory"
import type { PatternMemoryFeedback, PatternMemorySession } from "@/lib/trade-coach/pattern-memory"
import type { PlannedVsActualComparison } from "@/lib/trade-coach/types"
import {
  buildEmotionalTrends,
  buildMistakeHeatmap,
  buildWinRateByPair,
  detectRecurringBehaviors,
} from "@/lib/learning/pattern-detection"
import { identifyWinningPatterns } from "@/lib/learning/winning-patterns"
import { scoreHtfAlignment } from "@/lib/learning/trade-memory-engine"
import type {
  EmotionalPatternRecord,
  LearningDashboardData,
  LearningFeedbackRow,
  LearningMemorySnapshot,
  LearningTradeRow,
  SetupStatisticsRecord,
  TradeMemoryRecord,
} from "@/lib/learning/types"
import { buildSetupStatistics } from "@/lib/learning/winning-patterns"

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

export function buildLearningDashboard(input: {
  trades: LearningTradeRow[]
  feedback: LearningFeedbackRow[]
  memories?: TradeMemoryRecord[]
  setupStats?: SetupStatisticsRecord[]
  emotionalPatterns?: EmotionalPatternRecord[]
  maxRiskPerTrade?: number
  sessions?: PatternMemorySession[]
}): LearningDashboardData {
  const { trades, feedback } = input
  const mistakeAnalysis = buildMistakeAnalysis(trades)
  const recurringPatterns = detectRecurringBehaviors(trades)
  const winningPatterns = identifyWinningPatterns(trades)
  const setupStats = input.setupStats?.length ? input.setupStats : buildSetupStatistics(trades)

  const feedbackScores = feedback.map((row) => row.discipline_score).filter((score) => score > 0)
  const avgDiscipline =
    feedbackScores.length > 0
      ? Math.round(feedbackScores.reduce((sum, score) => sum + score, 0) / feedbackScores.length)
      : mistakeAnalysis.disciplineScore

  const aligned = trades.filter((trade) => scoreHtfAlignment(trade) >= 70)
  const htfAlignmentAccuracy = trades.length
    ? Math.round((aligned.length / trades.length) * 100)
    : 0

  const patternMemory = generatePatternMemory({
    trades,
    feedback: feedback.map((row) => ({
      trade_id: row.trade_id,
      discipline_score: row.discipline_score,
      planned_vs_actual: (row.planned_vs_actual || []) as unknown as PlannedVsActualComparison[],
    })) as PatternMemoryFeedback[],
    sessions: input.sessions || [],
    maxRiskPerTrade: input.maxRiskPerTrade ?? 1,
  })

  const bestSetup =
    winningPatterns.find((item) => item.key === "best_setup") ||
    (setupStats[0]
      ? {
          key: "best_setup",
          label: "Best setup type",
          value: setupStats[0].setup_type,
          winRate: setupStats[0].win_rate,
          tradeCount: setupStats[0].trade_count,
          message: `${setupStats[0].setup_type} leads your stats.`,
        }
      : null)

  return {
    disciplineScore: clamp(avgDiscipline),
    emotionalStability: clamp(mistakeAnalysis.emotionalConsistencyScore),
    bestSetupType: bestSetup,
    mistakeHeatmap: buildMistakeHeatmap(trades),
    winRateByPair: buildWinRateByPair(trades),
    htfAlignmentAccuracy,
    recurringPatterns: recurringPatterns.length
      ? recurringPatterns
      : patternMemory.patterns.slice(0, 5).map((p) => ({
          key: p.id,
          label: p.category,
          category: "discipline" as const,
          severity: p.severity,
          count: p.score,
          message: p.message,
        })),
    winningPatterns,
    tradeMemoryCount: input.memories?.length ?? trades.length,
  }
}

export function buildLearningMemorySnapshot(input: {
  trades: LearningTradeRow[]
  feedback: LearningFeedbackRow[]
  memories?: TradeMemoryRecord[]
  setupStats?: SetupStatisticsRecord[]
  emotionalPatterns?: EmotionalPatternRecord[]
  maxRiskPerTrade?: number
  sessions?: PatternMemorySession[]
}): LearningMemorySnapshot {
  const dashboard = buildLearningDashboard(input)
  const patternMemory = generatePatternMemory({
    trades: input.trades,
    feedback: input.feedback.map((row) => ({
      trade_id: row.trade_id,
      discipline_score: row.discipline_score,
      planned_vs_actual: (row.planned_vs_actual || []) as unknown as PlannedVsActualComparison[],
    })) as PatternMemoryFeedback[],
    sessions: input.sessions || [],
    maxRiskPerTrade: input.maxRiskPerTrade ?? 1,
  })

  return {
    dashboard,
    patterns: patternMemory.patterns,
    emotionalPatterns:
      input.emotionalPatterns ||
      dashboard.recurringPatterns.map((pattern) => ({
        pattern_key: pattern.key,
        label: pattern.label,
        category: pattern.category,
        severity: pattern.severity,
        occurrence_count: pattern.count,
        loss_count: 0,
        win_count: 0,
        trend: "stable",
        last_seen_at: new Date().toISOString(),
      })),
    setupStatistics: input.setupStats || buildSetupStatistics(input.trades),
    recentMemories: (input.memories || []).slice(0, 8),
  }
}

export function buildWeeklyReviewAdvice(input: {
  trades: LearningTradeRow[]
  dashboard: LearningDashboardData
}): string[] {
  const advice: string[] = []
  const emotionalTrends = buildEmotionalTrends(input.trades)

  if (input.dashboard.disciplineScore < 60) {
    advice.push("Cap daily trades and require a written plan before every entry next week.")
  }
  if (input.dashboard.htfAlignmentAccuracy < 65) {
    advice.push("Only take trades aligned with Weekly/Daily bias — skip countertrend setups.")
  }
  if (input.dashboard.recurringPatterns.some((p) => p.key === "fomo_entries")) {
    advice.push("Wait for M15 confirmation close — no FOMO entries after displacement candles.")
  }
  if (input.dashboard.recurringPatterns.some((p) => p.key === "revenge_trading")) {
    advice.push("After two losses, stop trading for the session.")
  }
  if (input.dashboard.bestSetupType) {
    advice.push(`Double down on ${input.dashboard.bestSetupType.value} during your best session.`)
  }
  if (emotionalTrends[0]?.trend === "risky") {
    advice.push(`Reduce size when feeling ${emotionalTrends[0].emotion}.`)
  }
  if (advice.length === 0) {
    advice.push("Maintain current process — journal every trade and review HTF charts first.")
  }
  return advice.slice(0, 5)
}
