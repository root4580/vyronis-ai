import { EMOTION_OPTIONS } from "@/lib/trade-form-config"
import { getTradeDisplayMistakeTags } from "@/lib/mistake-tags"
import { formatRiskReward, getTradeRiskReward } from "@/lib/trade-form-utils"

export type TradeDetailInsight = {
  id: string
  type: "positive" | "warning" | "neutral"
  message: string
}

export type TradeDetailTrade = {
  pair: string
  direction: string
  result: string
  pnl: number
  emotion: string
  emotion_after?: string | null
  strategy_name: string | null
  risk_percent: number | null
  rule_followed: boolean | null
  session: string | null
  trade_date: string | null
  created_at: string
  confirmation_signal: string | null
  mistake_tags?: string | null
  trade_notes?: string | null
  risk_reward?: number | null
  entry_price?: number | null
  stop_loss?: number | null
  take_profit?: number | null
}

const STABLE_EMOTIONS = new Set(["Calm", "Confident", "Disciplined"])
const IMPULSIVE_EMOTIONS = new Set(["FOMO", "Revenge", "Euphoric", "Anxious", "Fearful"])

const BEARISH_SIGNALS = new Set([
  "Head and Shoulders",
  "Double Top",
  "Triple Top",
  "Bearish Engulfing",
  "Evening Star",
  "Shooting Star",
  "Bear Flag",
  "Descending Triangle",
  "Resistance Rejection",
])

const BULLISH_SIGNALS = new Set([
  "Inverse Head and Shoulders",
  "Double Bottom",
  "Triple Bottom",
  "Bullish Engulfing",
  "Morning Star",
  "Hammer",
  "Bull Flag",
  "Ascending Triangle",
  "Support Rejection",
])

function isCounterTrend(trade: TradeDetailTrade): boolean {
  const signal = trade.confirmation_signal
  if (!signal) return false

  const bearish =
    BEARISH_SIGNALS.has(signal) ||
    signal.toLowerCase().includes("bearish") ||
    signal.toLowerCase().includes("resistance")
  const bullish =
    BULLISH_SIGNALS.has(signal) ||
    signal.toLowerCase().includes("bullish") ||
    signal.toLowerCase().includes("support") ||
    signal.toLowerCase().includes("hammer")

  if (trade.direction === "BUY" && bearish && !bullish) return true
  if (trade.direction === "SELL" && bullish && !bearish) return true
  return false
}

export function getEmotionDisplay(value: string | null | undefined): { emoji: string; label: string } {
  if (!value) return { emoji: "—", label: "Not logged" }
  const match = EMOTION_OPTIONS.find((option) => option.value === value)
  return match ? { emoji: match.emoji, label: match.label } : { emoji: "•", label: value }
}

export function calculateTradeDisciplineScore(
  trade: TradeDetailTrade,
  maxRiskPerTrade = 1,
): number {
  let score = 52

  if (trade.rule_followed === true) score += 18
  if (trade.rule_followed === false) score -= 22

  const mistakeTags = getTradeDisplayMistakeTags(trade)
  score -= Math.min(24, mistakeTags.length * 4)
  score -= Math.min(20, mistakeTags.filter((tag) => tag.dangerous).length * 8)

  if (STABLE_EMOTIONS.has(trade.emotion)) score += 14
  if (IMPULSIVE_EMOTIONS.has(trade.emotion)) score -= 16

  const risk = trade.risk_percent ?? 0
  if (risk > 0 && risk <= maxRiskPerTrade) score += 10
  if (risk > maxRiskPerTrade) score -= Math.min(18, (risk - maxRiskPerTrade) * 12)

  if (trade.confirmation_signal) score += 6
  if (isCounterTrend(trade)) score -= 10

  if (trade.result === "WIN" && trade.rule_followed !== false && mistakeTags.length === 0) score += 6
  if (trade.result === "LOSS" && IMPULSIVE_EMOTIONS.has(trade.emotion)) score -= 8

  return Math.max(0, Math.min(100, Math.round(score)))
}

export function buildTradeDetailInsights(
  trade: TradeDetailTrade,
  maxRiskPerTrade = 1,
): TradeDetailInsight[] {
  const insights: TradeDetailInsight[] = []
  const mistakeTags = getTradeDisplayMistakeTags(trade)
  const labels = new Set(mistakeTags.map((tag) => tag.label))
  const riskReward = getTradeRiskReward(trade)

  const hasEarlyEntry =
    labels.has("Early Entry") ||
    labels.has("No Confirmation")

  if (hasEarlyEntry) {
    insights.push({
      id: "early-entry",
      type: "warning",
      message: "Entered early before confirmation.",
    })
  }

  if (STABLE_EMOTIONS.has(trade.emotion)) {
    insights.push({
      id: "calm-execution",
      type: trade.result === "WIN" ? "positive" : "neutral",
      message:
        trade.result === "WIN"
          ? "Calm emotional state improved execution."
          : "Calm mindset kept the process controlled despite the outcome.",
    })
  }

  if (isCounterTrend(trade) || labels.has("Counter Trend")) {
    insights.push({
      id: "counter-trend",
      type: "warning",
      message: "Counter-trend trade reduced probability.",
    })
  }

  if (trade.emotion === "FOMO" || labels.has("FOMO")) {
    insights.push({
      id: "fomo",
      type: "warning",
      message: "FOMO entry increased risk of chasing price.",
    })
  }

  if (trade.emotion === "Revenge" || labels.has("Revenge Trade")) {
    insights.push({
      id: "revenge",
      type: "warning",
      message: "Revenge mindset likely compromised trade selection.",
    })
  }

  if ((trade.risk_percent ?? 0) > maxRiskPerTrade || labels.has("Overrisk")) {
    insights.push({
      id: "overrisk",
      type: "warning",
      message: `Risk at ${(trade.risk_percent ?? 0).toFixed(1)}% exceeded the ${maxRiskPerTrade}% discipline threshold.`,
    })
  }

  if (trade.rule_followed === false || labels.has("Ignored rules")) {
    insights.push({
      id: "rules",
      type: "warning",
      message: "Plan deviation detected — rules were not fully followed.",
    })
  }

  if (trade.emotion_after && STABLE_EMOTIONS.has(trade.emotion_after) && IMPULSIVE_EMOTIONS.has(trade.emotion)) {
    insights.push({
      id: "emotion-recovery",
      type: "positive",
      message: "Emotional state recovered after the trade closed.",
    })
  }

  if (trade.result === "WIN" && trade.rule_followed !== false && mistakeTags.length === 0) {
    insights.push({
      id: "clean-win",
      type: "positive",
      message: "Clean process trade — strong alignment with your playbook.",
    })
  }

  if (riskReward !== null && riskReward >= 2 && trade.result === "WIN") {
    insights.push({
      id: "rr-win",
      type: "positive",
      message: `Reward-to-risk of ${formatRiskReward(riskReward)} validated the setup quality.`,
    })
  }

  if (riskReward !== null && riskReward < 1.5) {
    insights.push({
      id: "rr-low",
      type: "neutral",
      message: `Risk-reward of ${formatRiskReward(riskReward)} left limited margin for error.`,
    })
  }

  if (trade.trade_notes && trade.trade_notes.length > 40) {
    insights.push({
      id: "journaling",
      type: "positive",
      message: "Detailed journaling supports faster pattern recognition over time.",
    })
  }

  if (insights.length === 0) {
    insights.push({
      id: "baseline",
      type: "neutral",
      message: "Trade logged successfully — keep tagging mistakes to unlock deeper AI feedback.",
    })
  }

  return insights.slice(0, 5)
}

export function buildTradeDetailAnalysis(
  trade: TradeDetailTrade,
  maxRiskPerTrade = 1,
) {
  const riskReward = getTradeRiskReward(trade)
  return {
    disciplineScore: calculateTradeDisciplineScore(trade, maxRiskPerTrade),
    insights: buildTradeDetailInsights(trade, maxRiskPerTrade),
    riskReward,
  }
}
