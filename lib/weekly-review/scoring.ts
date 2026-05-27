import type { WeeklyDebriefTrade } from "@/lib/ai/weekly-debrief-types"
import { getTradeTimestamp } from "@/lib/ai/weekly-debrief-engine"
import type { WeeklyReviewScores } from "@/lib/weekly-review/types"

const STABLE_EMOTIONS = new Set(["Calm", "Confident", "Disciplined"])
const IMPULSIVE_EMOTIONS = new Set(["FOMO", "Revenge", "Euphoric", "Anxious", "Fearful"])

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

export function calculateConsistencyScore(trades: WeeklyDebriefTrade[]): number {
  if (trades.length === 0) return 0
  if (trades.length === 1) return 65

  const rulesScore =
    (trades.filter((trade) => trade.rule_followed !== false).length / trades.length) * 35

  const stableCount = trades.filter((trade) => STABLE_EMOTIONS.has(trade.emotion)).length
  const emotionScore = (stableCount / trades.length) * 25

  const sorted = [...trades].sort((a, b) => getTradeTimestamp(a) - getTradeTimestamp(b))
  const results = sorted.map((trade) => trade.result)
  let alternations = 0
  for (let i = 1; i < results.length; i++) {
    if (results[i] !== results[i - 1] && results[i] !== "BREAKEVEN" && results[i - 1] !== "BREAKEVEN") {
      alternations++
    }
  }
  const streakScore = Math.max(0, 40 - (alternations / Math.max(1, results.length - 1)) * 40)

  return clamp(Math.round(rulesScore + emotionScore + streakScore))
}

export function buildVyronisReviewScores(input: {
  disciplineScore: number
  emotionalStabilityScore: number
  executionScore: number
  consistencyScore: number
}): WeeklyReviewScores {
  const discipline = clamp(input.disciplineScore)
  const emotionalStability = clamp(input.emotionalStabilityScore)
  const execution = clamp(input.executionScore)
  const consistency = clamp(input.consistencyScore)

  const overall = clamp(
    Math.round(
      discipline * 0.28 +
        emotionalStability * 0.24 +
        execution * 0.26 +
        consistency * 0.22,
    ),
  )

  return {
    discipline,
    emotionalStability,
    execution,
    consistency,
    overall,
  }
}

export function scoreTone(score: number): "excellent" | "solid" | "caution" | "critical" {
  if (score >= 80) return "excellent"
  if (score >= 65) return "solid"
  if (score >= 50) return "caution"
  return "critical"
}

export function countBehavioralTrades(trades: WeeklyDebriefTrade[]) {
  const fomoTrades = trades.filter(
    (trade) => trade.emotion === "FOMO" || trade.emotion_after === "FOMO",
  )
  const revengeTrades = trades.filter((trade) => trade.emotion === "Revenge")
  const impulsiveTrades = trades.filter((trade) => IMPULSIVE_EMOTIONS.has(trade.emotion))

  return { fomoTrades, revengeTrades, impulsiveTrades }
}
