import { parseMistakeTags } from "@/lib/trade-form-config"
import { getSignedPnL } from "@/lib/trade-utils"
import type {
  LearningFeedbackRow,
  LearningTradeRow,
  TradeMemoryRecord,
} from "@/lib/learning/types"

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

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

function resolveRr(trade: LearningTradeRow): number | null {
  if (trade.risk_reward != null && Number.isFinite(trade.risk_reward)) {
    return Number(trade.risk_reward)
  }
  return null
}

function isCounterTrend(trade: LearningTradeRow): boolean {
  const signal = trade.confirmation_signal
  if (!signal) return false
  const bearish =
    BEARISH_SIGNALS.has(signal) ||
    /bearish|resistance|double top|head and shoulders|evening star|shooting star/i.test(signal)
  const bullish =
    BULLISH_SIGNALS.has(signal) ||
    /bullish|support|double bottom|inverse head|morning star|hammer/i.test(signal)
  if (trade.direction === "BUY" && bearish) return true
  if (trade.direction === "SELL" && bullish) return true
  return false
}

export function scoreHtfAlignment(trade: LearningTradeRow): number {
  if (isCounterTrend(trade)) return 28
  if (!trade.confirmation_signal?.trim()) return 52
  if (!trade.higher_timeframe?.trim()) return 62
  return 84
}

export function buildAiVerdict(trade: LearningTradeRow, feedback?: LearningFeedbackRow): string {
  if (feedback?.coaching_summary?.trim()) return feedback.coaching_summary.slice(0, 280)
  if (trade.result === "WIN") return "Executed with favorable outcome."
  if (trade.result === "LOSS") return "Loss logged — review mistakes and emotional state."
  return "Breakeven — execution preserved capital."
}

export function buildTradeMemoryRecord(input: {
  userId: string
  trade: LearningTradeRow
  feedback?: LearningFeedbackRow
  sessionId?: string | null
  aiSummary?: string
}): TradeMemoryRecord {
  const { trade, feedback, userId } = input
  const mistakes = [
    ...parseMistakeTags(trade.mistake_tags),
    ...(trade.rule_followed === false ? ["Ignored rules"] : []),
    ...(isCounterTrend(trade) ? ["Counter HTF bias"] : []),
    ...(trade.emotion === "FOMO" ? ["FOMO entry"] : []),
    ...(trade.emotion === "Revenge" ? ["Revenge trade"] : []),
  ]
  const uniqueMistakes = [...new Set(mistakes.map((item) => item.trim()).filter(Boolean))]

  return {
    user_id: userId,
    trade_id: String(trade.id),
    session_id: input.sessionId ?? feedback?.session_id ?? null,
    pair: trade.pair,
    direction: trade.direction,
    timeframe: trade.entry_timeframe || trade.confirmation_timeframe || null,
    setup_type: trade.setup || null,
    result: trade.result,
    rr_achieved: resolveRr(trade),
    emotion_before: trade.emotion || null,
    emotion_after: trade.emotion_after || null,
    mistakes: uniqueMistakes,
    screenshot_url: trade.screenshot_url || null,
    ai_verdict: buildAiVerdict(trade, feedback),
    ai_summary:
      input.aiSummary ||
      `${trade.pair} ${trade.direction} ${trade.result} — ${trade.setup || "Unclassified setup"}.`,
    coaching_feedback: {
      discipline_score: feedback?.discipline_score ?? null,
      feedback_points: feedback?.feedback_points ?? [],
    },
    htf_alignment_score: scoreHtfAlignment(trade),
    session: trade.session || null,
    strategy_name: trade.strategy_name || null,
    metadata: {
      pnl: getSignedPnL(trade.pnl, trade.result),
      trade_date: trade.trade_date,
    },
  }
}

export function buildTradeMemoryRecords(
  userId: string,
  trades: LearningTradeRow[],
  feedbackByTrade: Map<string, LearningFeedbackRow>,
  sessionIdByTrade?: Map<string, string>,
): TradeMemoryRecord[] {
  return trades.map((trade) =>
    buildTradeMemoryRecord({
      userId,
      trade,
      feedback: feedbackByTrade.get(String(trade.id)),
      sessionId: sessionIdByTrade?.get(String(trade.id)) ?? feedbackByTrade.get(String(trade.id))?.session_id,
    }),
  )
}
