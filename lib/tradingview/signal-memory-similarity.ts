import { parseMistakeTags } from "@/lib/trade-form-config"
import { compareSetupToHistory } from "@/lib/intelligence/setup-similarity-engine"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"
import type {
  TradingViewMemoryMatch,
  TradingViewMemorySimilarity,
} from "@/lib/tradingview/types"
import type { SignalMemoryTrade } from "@/lib/tradingview/why-engine"

const IMPULSIVE_EMOTIONS = new Set([
  "fomo",
  "revenge",
  "euphoric",
  "anxious",
  "tilted",
  "impulsive",
])

const IMPULSIVE_TAG_HINTS = /early|chase|fomo|impulsive|no confirmation|revenge/i

function isImpulsiveTrade(trade: SignalMemoryTrade): boolean {
  const emotion = String(trade.emotion || "").trim().toLowerCase()
  if (IMPULSIVE_EMOTIONS.has(emotion)) return true
  const tags = parseMistakeTags(trade.mistake_tags).join(" ")
  return IMPULSIVE_TAG_HINTS.test(tags)
}

function isHighConfidenceTrade(trade: SignalMemoryTrade): boolean {
  if (trade.result === "WIN" && (trade.discipline_score ?? 0) >= 72) return true
  if ((trade.discipline_score ?? 0) >= 80) return true
  if (trade.result === "WIN" && trade.rule_followed === true && (trade.risk_reward ?? 0) >= 1.5) {
    return true
  }
  return false
}

function toHistoricalTrades(trades: SignalMemoryTrade[]) {
  return trades.map((t) => ({
    ...t,
    created_at: "",
    emotion: t.emotion ?? "",
    session: t.session ?? "",
  }))
}

function pickBestMatch(
  trades: SignalMemoryTrade[],
  planned: PreTradePlannedContext,
  kind: TradingViewMemoryMatch["kind"],
  filter: (t: SignalMemoryTrade) => boolean,
): TradingViewMemoryMatch | null {
  const pool = trades.filter(filter)
  if (pool.length === 0) return null

  const similarity = compareSetupToHistory({
    planned,
    trades: toHistoricalTrades(pool),
    minScore: 35,
  })
  const top = similarity.topMatches[0]
  if (!top) return null

  return {
    trade_id: top.tradeId,
    pair: top.pair,
    result: top.result,
    kind,
    similarity_score: top.similarityScore,
    summary: top.summary,
  }
}

export function analyzeSignalMemorySimilarity(input: {
  planned: PreTradePlannedContext
  trades: SignalMemoryTrade[]
}): TradingViewMemorySimilarity {
  const { planned, trades } = input
  const warnings: string[] = []

  if (trades.length === 0) {
    return {
      historical_confidence: 50,
      overall_similarity: 0,
      matches: [],
      warnings: ["Log completed trades to unlock personalized memory comparisons."],
      narrative: null,
    }
  }

  const allSimilarity = compareSetupToHistory({
    planned,
    trades: toHistoricalTrades(trades),
    minScore: 38,
  })

  const winner = pickBestMatch(trades, planned, "winner", (t) => t.result === "WIN")
  const loser = pickBestMatch(trades, planned, "loser", (t) => t.result === "LOSS" || t.pnl < 0)
  const impulsive = pickBestMatch(trades, planned, "impulsive", isImpulsiveTrade)
  const highConfidence = pickBestMatch(
    trades,
    planned,
    "high_confidence",
    isHighConfidenceTrade,
  )

  const matches: TradingViewMemoryMatch[] = []
  const seen = new Set<string>()
  for (const match of [winner, impulsive, loser, highConfidence]) {
    if (!match || seen.has(match.trade_id)) continue
    seen.add(match.trade_id)
    matches.push(match)
  }

  const similarOutcomes = allSimilarity.topMatches.slice(0, 6)
  const winCount = similarOutcomes.filter((m) => m.result === "WIN").length
  const lossCount = similarOutcomes.filter((m) => m.result === "LOSS").length
  const historical_confidence =
    similarOutcomes.length === 0
      ? 50
      : Math.round((winCount / similarOutcomes.length) * 100)

  if (impulsive && impulsive.similarity_score >= 52) {
    warnings.push(
      `Similar to a past impulsive ${impulsive.pair} entry (${impulsive.similarity_score}% match) — slow down before clicking.`,
    )
  }
  if (loser && loser.similarity_score >= 55 && historical_confidence < 55) {
    warnings.push(
      `Historical confidence is low (${historical_confidence}%) — similar profiles often lost.`,
    )
  }
  if (winner && loser && winner.similarity_score >= 50 && loser.similarity_score >= 50) {
    warnings.push("Mixed journal history on this profile — execution and timing decide the edge.")
  }

  let narrative: string | null = null
  if (winner && impulsive) {
    narrative = `This resembles your ${winner.pair} winner (${winner.similarity_score}% similarity) but also your impulsive ${impulsive.pair} entry (${impulsive.similarity_score}% similarity).`
  } else if (winner && loser) {
    narrative = `This resembles your winning ${winner.pair} trade (${winner.similarity_score}%) and your ${loser.pair} loss (${loser.similarity_score}%).`
  } else if (winner) {
    narrative = `Resembles your ${winner.pair} winner (${winner.similarity_score}% similarity).`
  } else if (impulsive) {
    narrative = `Resembles your impulsive ${impulsive.pair} entry (${impulsive.similarity_score}% similarity).`
  } else if (loser) {
    narrative = `Resembles your ${loser.pair} loss (${loser.similarity_score}% similarity).`
  } else if (allSimilarity.matchCount > 0) {
    narrative = allSimilarity.narrative
  }

  return {
    historical_confidence,
    overall_similarity: allSimilarity.overallScore,
    matches,
    warnings: [...new Set(warnings)].slice(0, 4),
    narrative,
  }
}

export function scoreEmotionalRiskFromHistory(trades: SignalMemoryTrade[]): number {
  const recent = trades.slice(0, 8)
  if (recent.length === 0) return 35

  let risk = 28
  const impulsiveCount = recent.filter(isImpulsiveTrade).length
  const recentLosses = recent.filter((t) => t.result === "LOSS" || t.pnl < 0).length

  risk += impulsiveCount * 14
  risk += recentLosses * 8
  if (impulsiveCount >= 2) risk += 12

  return Math.max(0, Math.min(100, risk))
}
