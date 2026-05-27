import { parseMistakeTags } from "@/lib/trade-form-config"
import { resolveStoredSetupScore } from "@/lib/trade-coach/setup-score-engine"
import { getSignedPnL } from "@/lib/trade-utils"
import type { BehaviorTrade, LeakEngineInput } from "@/lib/behavior/types"

const IMPULSIVE_EMOTIONS = new Set(["FOMO", "Revenge", "Euphoric", "Anxious", "Fearful", "Greed"])

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

export type LeakAnalysisContext = {
  trades: BehaviorTrade[]
  byDay: Map<string, BehaviorTrade[]>
  chronological: BehaviorTrade[]
}

export function getTradeDayKey(trade: Pick<BehaviorTrade, "trade_date" | "created_at">): string {
  if (trade.trade_date) return trade.trade_date.split("T")[0]
  return trade.created_at.split("T")[0]
}

export function getTradeTimestamp(trade: Pick<BehaviorTrade, "trade_date" | "created_at">): number {
  return new Date(trade.trade_date || trade.created_at).getTime()
}

export function isLossTrade(trade: Pick<BehaviorTrade, "pnl" | "result">): boolean {
  return getSignedPnL(trade.pnl, trade.result) < 0
}

export function hasMistakeTag(trade: BehaviorTrade, pattern: RegExp): boolean {
  return parseMistakeTags(trade.mistake_tags).some((tag) => pattern.test(tag))
}

export function isImpulsiveEmotion(emotion: string): boolean {
  return IMPULSIVE_EMOTIONS.has(emotion)
}

export function isCounterTrendTrade(trade: Pick<BehaviorTrade, "direction" | "confirmation_signal">): boolean {
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

export function hadPriorLossSameDay(
  trade: BehaviorTrade,
  context: LeakAnalysisContext,
): boolean {
  const dayTrades = context.byDay.get(trade.dayKey) ?? []
  for (const prior of dayTrades) {
    if (prior.timestamp >= trade.timestamp) continue
    if (isLossTrade(prior)) return true
  }
  return false
}

export function getConsecutiveLossesBefore(
  trade: BehaviorTrade,
  context: LeakAnalysisContext,
): number {
  const index = context.chronological.findIndex((row) => row.id === trade.id)
  if (index <= 0) return 0

  let streak = 0
  for (let i = index - 1; i >= 0; i--) {
    const row = context.chronological[i]
    if (isLossTrade(row)) {
      streak++
      continue
    }
    if (row.result === "BREAKEVEN" || row.result === "BE") continue
    break
  }
  return streak
}

export function normalizeSessionLabel(session: string | null | undefined): string | null {
  if (!session?.trim()) return null
  const value = session.trim()
  if (/london/i.test(value)) return "London"
  if (/new york|ny/i.test(value)) return "New York"
  if (/asia/i.test(value)) return "Asia"
  return value
}

export function mapTradeToBehaviorTrade(
  trade: LeakEngineInput["trades"][number],
): BehaviorTrade {
  const timestamp = getTradeTimestamp(trade)
  const resolved = resolveStoredSetupScore({
    direction: trade.direction,
    result: trade.result,
    emotion: trade.emotion,
    emotion_after: trade.emotion_after,
    setup: trade.setup || "",
    strategy_name: null,
    risk_percent: trade.risk_percent,
    rule_followed: trade.rule_followed,
    session: trade.session,
    trade_date: trade.trade_date,
    confirmation_signal: trade.confirmation_signal,
    mistake_tags: trade.mistake_tags,
    setup_score: null,
    setup_classification: trade.setup_classification,
    setup_score_breakdown: null,
    setup_coaching_insights: null,
  })

  return {
    id: trade.id,
    direction: trade.direction,
    result: trade.result,
    pnl: trade.pnl,
    emotion: trade.emotion,
    emotion_after: trade.emotion_after,
    session: normalizeSessionLabel(trade.session),
    pair: trade.pair,
    setup: trade.setup || "",
    setup_classification: resolved.classification,
    risk_percent: trade.risk_percent,
    rule_followed: trade.rule_followed,
    confirmation_signal: trade.confirmation_signal,
    mistake_tags: trade.mistake_tags,
    trade_date: trade.trade_date ?? null,
    created_at: trade.created_at,
    timestamp,
    dayKey: getTradeDayKey(trade),
    hourOfDay: new Date(timestamp).getHours(),
  }
}

export function buildLeakAnalysisContext(
  input: LeakEngineInput,
): LeakAnalysisContext {
  const cutoff =
    Date.now() -
    (input.lookbackDays ?? 90) * 24 * 60 * 60 * 1000

  const trades = input.trades
    .map(mapTradeToBehaviorTrade)
    .filter((trade) => trade.timestamp >= cutoff)
    .sort((a, b) => a.timestamp - b.timestamp)

  const byDay = new Map<string, BehaviorTrade[]>()
  for (const trade of trades) {
    const bucket = byDay.get(trade.dayKey) ?? []
    bucket.push(trade)
    byDay.set(trade.dayKey, bucket)
  }

  for (const bucket of byDay.values()) {
    bucket.sort((a, b) => a.timestamp - b.timestamp)
  }

  return {
    trades,
    byDay,
    chronological: trades,
  }
}
