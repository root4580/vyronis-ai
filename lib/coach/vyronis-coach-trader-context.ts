import { getRecentLossStreak, type TradeRiskGuardHistoryTrade } from "@/lib/trade-risk-guard"
import { getSignedPnL } from "@/lib/trade-utils"
import { getWeekRange } from "@/lib/ai/weekly-debrief-engine"
import { getTradeTimestamp } from "@/lib/user-settings"
import type { UserSettingsForm } from "@/lib/user-settings"
import type { PatternMemoryResult } from "@/lib/trade-coach/pattern-memory"

export type VyronisCoachTraderContext = {
  account_size: string
  account_type: string
  max_risk: string
  daily_loss_limit: string
  preferred_session: string
  streak: string
  streak_direction: string
  win_rate: string
  top_mistake: string
  top_mistake_frequency: string
  emotion_pattern: string
  htf_accuracy: string
  discipline_score: string
  week_pnl: string
  consecutive_losses: string
  pattern_1_description: string
  pattern_2_description: string
  pattern_3_description: string
  recent_mistakes: string
  strongest_habit: string
  worst_session: string
  best_setup_type: string
}

function winRateLast30(trades: TradeRiskGuardHistoryTrade[]): string {
  const slice = trades.slice(0, 30)
  if (slice.length === 0) return "N/A"
  const wins = slice.filter((t) => t.result === "WIN").length
  return `${Math.round((wins / slice.length) * 100)}%`
}

function weekPnL(trades: TradeRiskGuardHistoryTrade[]): string {
  const { start, end } = getWeekRange(new Date(), 0)
  const startMs = start.getTime()
  const endMs = end.getTime()
  const total = trades
    .filter((t) => {
      const ts = getTradeTimestamp(t)
      return ts >= startMs && ts <= endMs
    })
    .reduce((sum, t) => sum + getSignedPnL(t.pnl, t.result), 0)
  return total >= 0 ? `+$${total.toFixed(0)}` : `-$${Math.abs(total).toFixed(0)}`
}

function topMistake(patternMemory: PatternMemoryResult): { label: string; frequency: string } {
  const mistake = patternMemory.patterns.find((p) => p.category === "mistake")
  if (!mistake) return { label: "None logged yet", frequency: "0" }
  const match = mistake.message.match(/(\d+)/)
  const count = match?.[1] ?? "0"
  const total = patternMemory.tradeCount || 1
  const pct = Math.round((Number(count) / total) * 100)
  return { label: mistake.message.replace(/\d+.*/, "").trim() || mistake.message, frequency: String(pct) }
}

function emotionPattern(trades: TradeRiskGuardHistoryTrade[]): string {
  const counts = new Map<string, number>()
  for (const trade of trades.slice(0, 20)) {
    const key = trade.emotion?.trim() || "Unknown"
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
  return top ? `${top[0]} (${top[1]} of last 20)` : "Insufficient data"
}

function streakLabel(trades: TradeRiskGuardHistoryTrade[]): { streak: string; direction: string } {
  const sorted = [...trades].sort(
    (a, b) => getTradeTimestamp(b) - getTradeTimestamp(a),
  )
  if (sorted.length === 0) return { streak: "0", direction: "neutral" }

  const first = sorted[0]
  const direction = first.result === "WIN" ? "wins" : first.result === "LOSS" ? "losses" : "BE"
  let count = 1
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].result === first.result) count += 1
    else break
  }
  return { streak: String(count), direction }
}

export function buildVyronisCoachTraderContext(input: {
  settings?: UserSettingsForm
  historicalTrades?: TradeRiskGuardHistoryTrade[]
  patternMemory?: PatternMemoryResult
  disciplineScore?: number | null
}): VyronisCoachTraderContext {
  const trades = input.historicalTrades ?? []
  const patterns = input.patternMemory?.patterns ?? []
  const mistake = topMistake(input.patternMemory ?? { patterns: [], tradeCount: 0, hasEnoughData: false, coachLinkedCount: 0, emptyMessage: "" })
  const streak = streakLabel(trades)
  const positive = patterns.filter((p) => p.severity === "positive")
  const warnings = patterns.filter((p) => p.severity === "warning")

  return {
    account_size: input.settings?.starting_balance
      ? `$${Number(input.settings.starting_balance).toLocaleString()}`
      : "Not set",
    account_type: input.settings?.prop_firm_size || "Not set",
    max_risk: input.settings?.max_risk_per_trade
      ? `${input.settings.max_risk_per_trade}%`
      : "1%",
    daily_loss_limit: input.settings?.daily_drawdown_limit
      ? `${input.settings.daily_drawdown_limit}%`
      : "Not set",
    preferred_session: input.settings?.preferred_session || "London",
    streak: streak.streak,
    streak_direction: streak.direction,
    win_rate: winRateLast30(trades),
    top_mistake: mistake.label,
    top_mistake_frequency: mistake.frequency,
    emotion_pattern: emotionPattern(trades),
    htf_accuracy: input.patternMemory?.hasEnoughData
      ? `${Math.max(0, 100 - (warnings.filter((p) => p.category === "countertrend").length * 15))}/100`
      : "Insufficient data",
    discipline_score: String(input.disciplineScore ?? 70),
    week_pnl: weekPnL(trades),
    consecutive_losses: String(getRecentLossStreak(trades)),
    pattern_1_description: patterns[0]?.message ?? "Insufficient journal data",
    pattern_2_description: patterns[1]?.message ?? "Log 10+ trades to unlock pattern memory.",
    pattern_3_description: patterns[2]?.message ?? "Log 10+ trades to unlock pattern memory.",
    recent_mistakes: warnings
      .slice(0, 3)
      .map((p) => p.message)
      .join("; ") || "None in recent sample",
    strongest_habit: positive[0]?.message ?? "Rules acknowledged when logged",
    worst_session:
      patterns.find((p) => p.category === "session")?.message ?? "Not enough session data",
    best_setup_type:
      patterns.find((p) => p.id === "strongest_setup" || p.category === "strategy")?.message ??
      "Not enough setup data",
  }
}
