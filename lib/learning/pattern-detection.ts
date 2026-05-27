import { parseMistakeTags } from "@/lib/trade-form-config"
import { getSignedPnL } from "@/lib/trade-utils"
import type { DetectedBehaviorPattern, LearningTradeRow } from "@/lib/learning/types"

const IMPULSIVE = new Set(["FOMO", "Revenge", "Euphoric", "Anxious", "Fearful"])

function sortChronologically(trades: LearningTradeRow[]): LearningTradeRow[] {
  return [...trades].sort(
    (a, b) =>
      new Date(a.trade_date || a.created_at).getTime() -
      new Date(b.trade_date || b.created_at).getTime(),
  )
}

function countMatches(trades: LearningTradeRow[], predicate: (trade: LearningTradeRow) => boolean) {
  return trades.filter(predicate).length
}

function lossRate(trades: LearningTradeRow[]): number {
  if (trades.length === 0) return 0
  return Math.round((trades.filter((t) => t.result === "LOSS").length / trades.length) * 100)
}

export function detectRecurringBehaviors(trades: LearningTradeRow[]): DetectedBehaviorPattern[] {
  if (trades.length < 2) return []
  const sorted = sortChronologically(trades)
  const patterns: DetectedBehaviorPattern[] = []

  const fomoEntries = sorted.filter((t) => t.emotion === "FOMO")
  if (fomoEntries.length >= 2) {
    patterns.push({
      key: "fomo_entries",
      label: "FOMO entries",
      category: "emotion",
      severity: "warning",
      count: fomoEntries.length,
      message: `FOMO detected on ${fomoEntries.length} trades (${lossRate(fomoEntries)}% loss rate).`,
    })
  }

  const earlyConfirmation = sorted.filter((t) => {
    const tags = parseMistakeTags(t.mistake_tags)
    return (
      tags.some((tag) => /no confirmation|early|before m15|late entry/i.test(tag)) ||
      (t.confirmation_timeframe === "M15" && t.result === "LOSS" && !t.confirmation_signal)
    )
  })
  if (earlyConfirmation.length >= 2) {
    patterns.push({
      key: "early_m15_entry",
      label: "Before M15 confirmation",
      category: "execution",
      severity: "warning",
      count: earlyConfirmation.length,
      message: "Repeated entries before M15 confirmation close.",
    })
  }

  const revenge = sorted.filter((t) => t.emotion === "Revenge" || /revenge/i.test(t.mistake_tags || ""))
  if (revenge.length >= 2) {
    patterns.push({
      key: "revenge_trading",
      label: "Revenge trading",
      category: "emotion",
      severity: "warning",
      count: revenge.length,
      message: `Revenge pattern on ${revenge.length} trades.`,
    })
  }

  const overtradingDays = new Map<string, number>()
  for (const trade of sorted) {
    const day = (trade.trade_date || trade.created_at).slice(0, 10)
    overtradingDays.set(day, (overtradingDays.get(day) || 0) + 1)
  }
  const heavyDays = [...overtradingDays.values()].filter((count) => count >= 4).length
  if (heavyDays >= 2) {
    patterns.push({
      key: "overtrading",
      label: "Overtrading",
      category: "discipline",
      severity: "warning",
      count: heavyDays,
      message: "Multiple days with 4+ trades — overtrading risk.",
    })
  }

  const counterHtf = sorted.filter((t) => /counter/i.test((t.mistake_tags || "").toLowerCase()))
  if (counterHtf.length >= 2) {
    patterns.push({
      key: "counter_htf_bias",
      label: "Against HTF bias",
      category: "execution",
      severity: "warning",
      count: counterHtf.length,
      message: "Repeated entries against higher-timeframe bias.",
    })
  }

  for (let index = 1; index < sorted.length; index += 1) {
    const prev = sorted[index - 1]
    const current = sorted[index]
    if (prev.result === "WIN" && IMPULSIVE.has(current.emotion)) {
      patterns.push({
        key: "emotional_after_wins",
        label: "Emotional trading after wins",
        category: "emotion",
        severity: "warning",
        count: countMatches(sorted.slice(index), (t) => IMPULSIVE.has(t.emotion)),
        message: "Impulsive emotion appeared after a winning trade.",
      })
      break
    }
  }

  const earlyExits = sorted.filter((t) => {
    const tags = parseMistakeTags(t.mistake_tags)
    return tags.some((tag) => /cut winner|moved tp|scaled out early|fear/i.test(tag))
  })
  if (earlyExits.length >= 2) {
    patterns.push({
      key: "cut_winners_early",
      label: "Cutting winners early",
      category: "execution",
      severity: "insight",
      count: earlyExits.length,
      message: "Winners closed early — let HTF-aligned trades breathe.",
    })
  }

  return patterns.sort((a, b) => b.count - a.count).slice(0, 8)
}

export function buildEmotionalTrends(trades: LearningTradeRow[]) {
  const counts = new Map<string, number>()
  for (const trade of trades) {
    const emotion = trade.emotion?.trim()
    if (!emotion) continue
    counts.set(emotion, (counts.get(emotion) || 0) + 1)
  }
  return [...counts.entries()]
    .map(([emotion, count]) => ({
      emotion,
      count,
      trend: IMPULSIVE.has(emotion) ? "risky" : "stable",
    }))
    .sort((a, b) => b.count - a.count)
}

export function buildMistakeHeatmap(trades: LearningTradeRow[]) {
  const grouped = new Map<string, { count: number; losses: number }>()
  for (const trade of trades) {
    for (const tag of parseMistakeTags(trade.mistake_tags)) {
      const current = grouped.get(tag) || { count: 0, losses: 0 }
      current.count += 1
      if (trade.result === "LOSS") current.losses += 1
      grouped.set(tag, current)
    }
  }
  return [...grouped.entries()]
    .map(([label, stats]) => ({
      label,
      count: stats.count,
      lossRate: stats.count ? Math.round((stats.losses / stats.count) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

export function buildWinRateByPair(trades: LearningTradeRow[]) {
  const grouped = new Map<string, { wins: number; total: number; pnl: number }>()
  for (const trade of trades) {
    const current = grouped.get(trade.pair) || { wins: 0, total: 0, pnl: 0 }
    current.total += 1
    if (trade.result === "WIN") current.wins += 1
    current.pnl += getSignedPnL(trade.pnl, trade.result)
    grouped.set(trade.pair, current)
  }
  return [...grouped.entries()]
    .map(([pair, stats]) => ({
      pair,
      trades: stats.total,
      winRate: stats.total ? Math.round((stats.wins / stats.total) * 100) : 0,
      pnl: Math.round(stats.pnl * 100) / 100,
    }))
    .sort((a, b) => b.trades - a.trades)
}
