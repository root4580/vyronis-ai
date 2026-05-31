import {
  hasPositiveWinRate,
  MIN_EMOTION_INSIGHT_TRADES,
  MIN_GROUP_INSIGHT_TRADES,
  MIN_JOURNAL_INSIGHT_TRADES,
} from "@/lib/analytics/insight-thresholds"
import { getSignedPnL } from "@/lib/trade-utils"
import { scoreHtfAlignment } from "@/lib/learning/trade-memory-engine"
import type { LearningTradeRow, SetupStatisticsRecord, WinningPatternInsight } from "@/lib/learning/types"

function groupBy<T extends LearningTradeRow>(
  trades: T[],
  field: (trade: T) => string,
): Map<string, T[]> {
  const grouped = new Map<string, T[]>()
  for (const trade of trades) {
    const key = field(trade).trim() || "Unassigned"
    grouped.set(key, [...(grouped.get(key) || []), trade])
  }
  return grouped
}

function winRate(trades: LearningTradeRow[]): number {
  if (trades.length === 0) return 0
  return Math.round((trades.filter((t) => t.result === "WIN").length / trades.length) * 100)
}

function avgRr(trades: LearningTradeRow[]): number | null {
  const values = trades.map((t) => t.risk_reward).filter((v): v is number => v != null && Number.isFinite(v))
  if (values.length === 0) return null
  return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 100) / 100
}

export function buildSetupStatistics(trades: LearningTradeRow[]): SetupStatisticsRecord[] {
  const grouped = groupBy(trades, (trade) => trade.setup || "Unassigned")

  return [...grouped.entries()].map(([setup_type, rows]) => {
    const wins = rows.filter((t) => t.result === "WIN")
    const losses = rows.filter((t) => t.result === "LOSS")
    const breakevens = rows.filter((t) => t.result === "BREAKEVEN")
    const aligned = rows.filter((t) => scoreHtfAlignment(t) >= 70)

    const sessionStats = groupBy(rows, (t) => t.session || "Unassigned")
    const emotionStats = groupBy(rows, (t) => t.emotion || "Unassigned")

    const bestSession = [...sessionStats.entries()]
      .filter(([, items]) => items.length >= MIN_GROUP_INSIGHT_TRADES && hasPositiveWinRate(winRate(items)))
      .sort((a, b) => winRate(b[1]) - winRate(a[1]))[0]?.[0]

    const bestEmotion = [...emotionStats.entries()]
      .filter(
        ([, items]) =>
          items.length >= MIN_EMOTION_INSIGHT_TRADES && hasPositiveWinRate(winRate(items)),
      )
      .sort((a, b) => winRate(b[1]) - winRate(a[1]))[0]?.[0]

    return {
      setup_type,
      trade_count: rows.length,
      win_count: wins.length,
      loss_count: losses.length,
      breakeven_count: breakevens.length,
      win_rate: winRate(rows),
      total_pnl: rows.reduce((sum, t) => sum + getSignedPnL(t.pnl, t.result), 0),
      avg_rr: avgRr(rows),
      best_session: bestSession || null,
      best_emotion: bestEmotion || null,
      htf_alignment_accuracy: rows.length ? Math.round((aligned.length / rows.length) * 100) : 0,
    }
  })
}

export function identifyWinningPatterns(trades: LearningTradeRow[]): WinningPatternInsight[] {
  if (trades.length < MIN_JOURNAL_INSIGHT_TRADES) return []
  const insights: WinningPatternInsight[] = []

  const setupStats = buildSetupStatistics(trades)
    .filter(
      (item) =>
        item.trade_count >= MIN_GROUP_INSIGHT_TRADES && hasPositiveWinRate(item.win_rate),
    )
    .sort((a, b) => b.win_rate - a.win_rate || b.total_pnl - a.total_pnl)
  if (setupStats[0]) {
    insights.push({
      key: "best_setup",
      label: "Highest win-rate setup",
      value: setupStats[0].setup_type,
      winRate: setupStats[0].win_rate,
      tradeCount: setupStats[0].trade_count,
      message: `${setupStats[0].setup_type} wins ${setupStats[0].win_rate}% of the time.`,
    })
  }

  const sessionGroups = groupBy(trades, (t) => t.session || "Unassigned")
  const bestSession = [...sessionGroups.entries()]
    .filter(
      ([, rows]) =>
        rows.length >= MIN_GROUP_INSIGHT_TRADES && hasPositiveWinRate(winRate(rows)),
    )
    .sort((a, b) => winRate(b[1]) - winRate(a[1]))[0]
  if (bestSession) {
    insights.push({
      key: "best_session",
      label: "Best trading session",
      value: bestSession[0],
      winRate: winRate(bestSession[1]),
      tradeCount: bestSession[1].length,
      message: `${bestSession[0]} is your strongest session.`,
    })
  }

  const pairGroups = groupBy(trades, (t) => t.pair)
  const bestPair = [...pairGroups.entries()]
    .filter(
      ([, rows]) =>
        rows.length >= MIN_GROUP_INSIGHT_TRADES && hasPositiveWinRate(winRate(rows)),
    )
    .sort((a, b) => winRate(b[1]) - winRate(a[1]))[0]
  if (bestPair) {
    insights.push({
      key: "best_pair",
      label: "Best pair",
      value: bestPair[0],
      winRate: winRate(bestPair[1]),
      tradeCount: bestPair[1].length,
      message: `${bestPair[0]} shows ${winRate(bestPair[1])}% win rate.`,
    })
  }

  const emotionGroups = groupBy(trades, (t) => t.emotion || "Unassigned")
  const bestEmotion = [...emotionGroups.entries()]
    .filter(
      ([, rows]) =>
        rows.length >= MIN_EMOTION_INSIGHT_TRADES && hasPositiveWinRate(winRate(rows)),
    )
    .sort((a, b) => winRate(b[1]) - winRate(a[1]))[0]
  if (bestEmotion) {
    insights.push({
      key: "best_emotion",
      label: "Best emotional state",
      value: bestEmotion[0],
      winRate: winRate(bestEmotion[1]),
      tradeCount: bestEmotion[1].length,
      message: `You perform best when feeling ${bestEmotion[0]}.`,
    })
  }

  const rrBuckets = trades.filter((t) => t.risk_reward != null && t.risk_reward >= 2)
  if (rrBuckets.length >= MIN_GROUP_INSIGHT_TRADES && hasPositiveWinRate(winRate(rrBuckets))) {
    insights.push({
      key: "best_rr_profile",
      label: "Best RR profile",
      value: "2R+ planned trades",
      winRate: winRate(rrBuckets),
      tradeCount: rrBuckets.length,
      message: `Trades planned for 2R+ win ${winRate(rrBuckets)}% of the time.`,
    })
  }

  const aligned = trades.filter((t) => scoreHtfAlignment(t) >= 75)
  if (aligned.length >= MIN_GROUP_INSIGHT_TRADES && hasPositiveWinRate(winRate(aligned))) {
    insights.push({
      key: "htf_alignment",
      label: "HTF-aligned setups",
      value: "Strong HTF confluence",
      winRate: winRate(aligned),
      tradeCount: aligned.length,
      message: `HTF-aligned trades win ${winRate(aligned)}% vs overall ${winRate(trades)}%.`,
    })
  }

  return insights.slice(0, 6)
}
