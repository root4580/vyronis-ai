import { getCalendarDateKey } from "@/lib/journal/trade-date-parser"
import { parseMistakeTags } from "@/lib/trade-form-config"
import { getSignedPnL } from "@/lib/trade-utils"
import type { JournalCalendarTrade } from "@/lib/journal/calendar-analytics"

const IMPULSIVE = new Set([
  "fomo",
  "revenge",
  "euphoric",
  "anxious",
  "tilted",
  "impulsive",
  "frustrated",
])

export type DailyIntelligenceScores = {
  emotionalScore: number | null
  executionScore: number | null
  /** True when no trades — discipline / no-touch day */
  disciplineDay: boolean
}

export type EnrichedJournalDay = {
  emotionalScore: number | null
  executionScore: number | null
  disciplineDay: boolean
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

function emotionScoreForTrade(emotion: string | null | undefined): number {
  const e = (emotion || "").toLowerCase()
  if (!e) return 65
  if (IMPULSIVE.has(e)) return 32
  if (e === "calm" || e === "confident" || e === "disciplined") return 88
  return 58
}

function executionScoreForTrade(trade: JournalCalendarTrade): number {
  let score = 62
  if (trade.rule_followed === true) score += 18
  if (trade.rule_followed === false) score -= 22

  const stored = trade.setup_score
  if (typeof stored === "number") {
    score = clamp(score * 0.4 + stored * 0.6)
  }

  const tags = parseMistakeTags(trade.mistake_tags)
  if (tags.length > 0) score -= Math.min(25, tags.length * 8)

  const rr = trade.risk_reward
  if (rr != null && rr >= 2) score += 8

  return clamp(score)
}

function scoreDay(trades: JournalCalendarTrade[]): DailyIntelligenceScores {
  if (trades.length === 0) {
    return { emotionalScore: null, executionScore: null, disciplineDay: true }
  }

  const emotional =
    trades.reduce((s, t) => s + emotionScoreForTrade(t.emotion), 0) / trades.length
  const execution =
    trades.reduce((s, t) => s + executionScoreForTrade(t), 0) / trades.length

  return {
    emotionalScore: clamp(emotional),
    executionScore: clamp(execution),
    disciplineDay: false,
  }
}

/** Per calendar day (YYYY-MM-DD) intelligence scores from journal trades */
export function buildDailyIntelligenceMap(
  trades: JournalCalendarTrade[],
): Map<string, DailyIntelligenceScores> {
  const byDate = new Map<string, JournalCalendarTrade[]>()

  for (const trade of trades) {
    const key = getCalendarDateKey(trade)
    if (!key) continue
    const list = byDate.get(key) ?? []
    list.push(trade)
    byDate.set(key, list)
  }

  const out = new Map<string, DailyIntelligenceScores>()
  for (const [date, dayTrades] of byDate) {
    out.set(date, scoreDay(dayTrades))
  }
  return out
}

export function getDailyScores(
  map: Map<string, DailyIntelligenceScores>,
  date: string,
  tradeCount: number,
): DailyIntelligenceScores {
  if (tradeCount === 0) {
    return { emotionalScore: null, executionScore: null, disciplineDay: true }
  }
  return (
    map.get(date) ?? {
      emotionalScore: null,
      executionScore: null,
      disciplineDay: false,
    }
  )
}

export function scoreLabel(score: number | null): string {
  if (score == null) return "—"
  if (score >= 75) return "Strong"
  if (score >= 55) return "Fair"
  return "Weak"
}
