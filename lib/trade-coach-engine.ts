export type CoachInsightType = "warning" | "success" | "insight" | "info" | "tip"

export type CoachInsightCategory =
  | "winrate"
  | "emotion"
  | "session"
  | "setup"
  | "direction"
  | "streak"
  | "fomo"
  | "discipline"

export type CoachInsight = {
  id: string
  type: CoachInsightType
  category: CoachInsightCategory
  message: string
  priority: number
}

export type CoachAnalysis = {
  insights: CoachInsight[]
  allInsights: CoachInsight[]
  activeWarnings: CoachInsight[]
  summary: string
  overallWinRate: number
  tradeCount: number
  hasData: boolean
  confidenceScore: number
  topWeakness: string | null
  topStrength: string | null
}

export type CoachTrade = {
  direction: string
  result: string
  pnl: number
  emotion: string
  setup: string
  rule_followed: boolean | null
  session: string | null
  confirmation_signal: string | null
  created_at: string
  trade_date: string | null
}

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

const EMOTIONAL_STATES = new Set(["FOMO", "Revenge", "Fearful", "Anxious", "Euphoric", "Greed"])

function getTradeTimestamp(trade: CoachTrade): number {
  const date = trade.trade_date || trade.created_at
  return new Date(date).getTime()
}

function sortTradesChronologically(trades: CoachTrade[]): CoachTrade[] {
  return [...trades].sort((a, b) => getTradeTimestamp(a) - getTradeTimestamp(b))
}

function winRate(trades: CoachTrade[]): number {
  if (trades.length === 0) return 0
  return Math.round((trades.filter((t) => t.result === "WIN").length / trades.length) * 100)
}

function isWin(trade: CoachTrade): boolean {
  return trade.result === "WIN"
}

function isLoss(trade: CoachTrade): boolean {
  return trade.result === "LOSS"
}

function getSetupTier(setup: string): "A+" | "B" | "C" | "other" {
  const value = setup.toLowerCase()
  if (value.includes("a+")) return "A+"
  if (value.includes("b setup") || value === "b") return "B"
  if (value.includes("c setup") || value === "c") return "C"
  return "other"
}

function normalizeSessionName(session: string | null): string {
  if (!session) return "Unknown Session"
  if (session.toLowerCase().includes("london")) return "London session"
  if (session.toLowerCase().includes("new york") || session.toLowerCase().includes("ny")) return "New York session"
  if (session.toLowerCase().includes("asia")) return "Asia session"
  if (session.toLowerCase().includes("sydney")) return "Sydney session"
  return session
}

function isCounterTrendTrade(trade: CoachTrade): boolean | null {
  const signal = trade.confirmation_signal
  if (!signal) return null

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
  if (trade.direction === "BUY" && bullish && !bearish) return false
  if (trade.direction === "SELL" && bearish && !bullish) return false

  return null
}

function analyzeSessionLosses(trades: CoachTrade[]): CoachInsight | null {
  const bySession = new Map<string, { losses: number; total: number }>()

  for (const trade of trades) {
    const session = normalizeSessionName(trade.session)
    const current = bySession.get(session) || { losses: 0, total: 0 }
    current.total += 1
    if (isLoss(trade)) current.losses += 1
    bySession.set(session, current)
  }

  let worstSession = ""
  let worstLossRate = -1

  for (const [session, stats] of bySession.entries()) {
    if (stats.total < 2 || stats.losses === 0) continue
    const lossRate = stats.losses / stats.total
    if (lossRate > worstLossRate) {
      worstLossRate = lossRate
      worstSession = session
    }
  }

  if (!worstSession || worstLossRate < 0.5) return null

  const stats = bySession.get(worstSession)!
  return {
    id: "session-losses",
    type: "warning",
    category: "session",
    message: `Most losses happen during ${worstSession} (${stats.losses} of ${stats.total} trades lost).`,
    priority: 85,
  }
}

function analyzeBestEmotion(trades: CoachTrade[]): CoachInsight | null {
  const byEmotion = new Map<string, CoachTrade[]>()

  for (const trade of trades) {
    const emotion = trade.emotion || "Unknown"
    const group = byEmotion.get(emotion) || []
    group.push(trade)
    byEmotion.set(emotion, group)
  }

  let bestEmotion = ""
  let bestRate = -1

  for (const [emotion, group] of byEmotion.entries()) {
    if (group.length < 2) continue
    const rate = winRate(group)
    if (rate > bestRate) {
      bestRate = rate
      bestEmotion = emotion
    }
  }

  if (!bestEmotion || bestRate < 50) return null

  return {
    id: "best-emotion",
    type: "success",
    category: "emotion",
    message: `${bestEmotion} emotional state has your highest win rate at ${bestRate}%.`,
    priority: 72,
  }
}

function analyzeSetupQuality(trades: CoachTrade[]): CoachInsight | null {
  const aPlus = trades.filter((t) => getSetupTier(t.setup) === "A+")
  const bSetup = trades.filter((t) => getSetupTier(t.setup) === "B")

  if (aPlus.length < 2 || bSetup.length < 2) return null

  const aRate = winRate(aPlus)
  const bRate = winRate(bSetup)
  const diff = aRate - bRate

  if (diff < 10) return null

  return {
    id: "setup-quality",
    type: "insight",
    category: "setup",
    message: `A+ setups outperform B setups by ${diff}% (${aRate}% vs ${bRate}% win rate).`,
    priority: 78,
  }
}

function analyzeCounterTrend(trades: CoachTrade[]): CoachInsight | null {
  const withTrend: CoachTrade[] = []
  const counterTrend: CoachTrade[] = []

  for (const trade of trades) {
    const counter = isCounterTrendTrade(trade)
    if (counter === true) counterTrend.push(trade)
    else if (counter === false) withTrend.push(trade)
  }

  if (counterTrend.length < 2 || withTrend.length < 2) return null

  const counterRate = winRate(counterTrend)
  const withTrendRate = winRate(withTrend)
  const diff = withTrendRate - counterRate

  if (diff < 12) return null

  return {
    id: "counter-trend",
    type: "warning",
    category: "direction",
    message: `Counter-trend trades reduce consistency (${counterRate}% WR vs ${withTrendRate}% with-trend).`,
    priority: 80,
  }
}

function analyzeStreaks(trades: CoachTrade[]): CoachInsight | null {
  const sorted = sortTradesChronologically(trades)
  if (sorted.length < 3) return null

  const lastResult = sorted[sorted.length - 1].result
  if (lastResult !== "WIN" && lastResult !== "LOSS") return null

  let currentStreak = 0
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].result === lastResult) currentStreak += 1
    else if (sorted[i].result === "WIN" || sorted[i].result === "LOSS") break
  }

  if (lastResult === "LOSS" && currentStreak >= 3) {
    return {
      id: "loss-streak",
      type: "warning",
      category: "streak",
      message: `${currentStreak} consecutive losses detected — consider stepping away to reset.`,
      priority: 92,
    }
  }

  if (lastResult === "WIN" && currentStreak >= 4) {
    return {
      id: "win-streak",
      type: "success",
      category: "streak",
      message: `${currentStreak} consecutive wins — stay disciplined and avoid overconfidence.`,
      priority: 68,
    }
  }

  return null
}

function analyzeFomoAfterWins(trades: CoachTrade[]): CoachInsight | null {
  const sorted = sortTradesChronologically(trades)
  let fomoAfterWins = 0
  let winStreak = 0

  for (const trade of sorted) {
    if (trade.emotion === "FOMO" && winStreak >= 2) {
      fomoAfterWins += 1
    }

    if (isWin(trade)) {
      winStreak += 1
    } else if (isLoss(trade)) {
      winStreak = 0
    }
  }

  if (fomoAfterWins === 0) return null

  return {
    id: "fomo-after-wins",
    type: "warning",
    category: "fomo",
    message: `FOMO detected after consecutive wins (${fomoAfterWins} trade${fomoAfterWins > 1 ? "s" : ""}).`,
    priority: 88,
  }
}

function analyzeFomoPattern(trades: CoachTrade[]): CoachInsight | null {
  const fomoTrades = trades.filter((t) => t.emotion === "FOMO")
  if (fomoTrades.length < 2) return null

  const nonFomo = trades.filter((t) => t.emotion !== "FOMO")
  if (nonFomo.length < 2) return null

  const fomoRate = winRate(fomoTrades)
  const baselineRate = winRate(nonFomo)

  if (fomoRate >= baselineRate - 5) return null

  return {
    id: "fomo-pattern",
    type: "insight",
    category: "fomo",
    message: `FOMO trades win only ${fomoRate}% of the time vs ${baselineRate}% on non-FOMO entries.`,
    priority: 82,
  }
}

function analyzeDiscipline(trades: CoachTrade[]): CoachInsight | null {
  const brokenRules = trades.filter((t) => t.rule_followed === false)
  if (brokenRules.length < 2) return null

  const brokenLosses = brokenRules.filter(isLoss).length
  const brokenLossShare = Math.round((brokenLosses / Math.max(1, trades.filter(isLoss).length)) * 100)

  if (brokenLossShare >= 40) {
    return {
      id: "discipline-losses",
      type: "warning",
      category: "discipline",
      message: `Rule breaks account for ${brokenLossShare}% of your losses — tighten execution.`,
      priority: 86,
    }
  }

  const disciplineRate = Math.round((trades.filter((t) => t.rule_followed !== false).length / trades.length) * 100)

  if (disciplineRate >= 85) {
    return {
      id: "discipline-strong",
      type: "success",
      category: "discipline",
      message: `Discipline consistency is strong at ${disciplineRate}% rule adherence.`,
      priority: 65,
    }
  }

  return {
    id: "discipline-review",
    type: "insight",
    category: "discipline",
    message: `${brokenRules.length} trades broke your rules — review before the next session.`,
    priority: 74,
  }
}

function analyzeWinRateTrend(trades: CoachTrade[]): CoachInsight | null {
  if (trades.length < 6) return null

  const sorted = sortTradesChronologically(trades)
  const recent = sorted.slice(-Math.min(10, sorted.length))
  const overall = winRate(trades)
  const recentRate = winRate(recent)
  const diff = recentRate - overall

  if (Math.abs(diff) < 12) return null

  if (diff < 0) {
    return {
      id: "winrate-drop",
      type: "warning",
      category: "winrate",
      message: `Win rate dropped to ${recentRate}% over your last ${recent.length} trades (overall ${overall}%).`,
      priority: 76,
    }
  }

  return {
    id: "winrate-improve",
    type: "success",
    category: "winrate",
    message: `Recent form is improving — ${recentRate}% win rate over last ${recent.length} trades.`,
    priority: 70,
  }
}

function analyzeEmotionalRisk(trades: CoachTrade[]): CoachInsight | null {
  const emotional = trades.filter((t) => EMOTIONAL_STATES.has(t.emotion))
  if (emotional.length < 2) return null

  const emotionalLossRate = Math.round((emotional.filter(isLoss).length / emotional.length) * 100)
  const calmTrades = trades.filter((t) => ["Calm", "Confident", "Disciplined"].includes(t.emotion))

  if (calmTrades.length < 2) {
    return {
      id: "emotional-risk",
      type: "insight",
      category: "emotion",
      message: `Emotional entries lose ${emotionalLossRate}% of the time — reset before re-entering.`,
      priority: 77,
    }
  }

  const calmRate = winRate(calmTrades)
  if (emotionalLossRate <= 100 - calmRate) return null

  return {
    id: "emotional-vs-calm",
    type: "warning",
    category: "emotion",
    message: `Calm/Confident trades win ${calmRate}% vs ${100 - emotionalLossRate}% on emotional entries.`,
    priority: 79,
  }
}

function analyzeDirectionBias(trades: CoachTrade[]): CoachInsight | null {
  const buys = trades.filter((t) => t.direction === "BUY")
  const sells = trades.filter((t) => t.direction === "SELL")

  if (buys.length < 2 || sells.length < 2) return null

  const buyRate = winRate(buys)
  const sellRate = winRate(sells)
  const diff = Math.abs(buyRate - sellRate)

  if (diff < 15) return null

  const weaker = buyRate < sellRate ? "BUY" : "SELL"
  const weakerRate = Math.min(buyRate, sellRate)
  const strongerRate = Math.max(buyRate, sellRate)

  return {
    id: "direction-bias",
    type: "insight",
    category: "direction",
    message: `${weaker} trades underperform at ${weakerRate}% vs ${strongerRate}% on the opposite side.`,
    priority: 71,
  }
}

function analyzeRevengeTrading(trades: CoachTrade[]): CoachInsight | null {
  const revengeTrades = trades.filter((t) => t.emotion === "Revenge")
  if (revengeTrades.length < 1) return null

  const revengeLossRate = Math.round((revengeTrades.filter(isLoss).length / revengeTrades.length) * 100)

  return {
    id: "revenge-trading",
    type: "warning",
    category: "emotion",
    message: `Revenge trading detected (${revengeTrades.length} trade${revengeTrades.length > 1 ? "s" : ""}) — ${revengeLossRate}% ended in losses.`,
    priority: 94,
  }
}

function computeConfidenceScore(trades: CoachTrade[], insights: CoachInsight[]): number {
  if (trades.length === 0) return 0

  const disciplineRate = trades.filter((t) => t.rule_followed !== false).length / trades.length
  const calmRate =
    trades.filter((t) => ["Calm", "Confident", "Disciplined"].includes(t.emotion)).length / trades.length
  const warningPenalty = Math.min(35, insights.filter((i) => i.type === "warning").length * 8)
  const winRateScore = winRate(trades) * 0.35
  const processScore = (disciplineRate * 25 + calmRate * 25)

  return Math.round(Math.max(0, Math.min(100, winRateScore + processScore - warningPenalty)))
}

function deriveTopWeakness(trades: CoachTrade[], insights: CoachInsight[]): string | null {
  const warning = insights.find((i) => i.type === "warning")
  if (warning) return warning.message.split(" — ")[0].split(".")[0]

  const revenge = trades.filter((t) => t.emotion === "Revenge").length
  const fomo = trades.filter((t) => t.emotion === "FOMO").length
  if (revenge > 0) return "Revenge trading after losses"
  if (fomo > 0) return "FOMO entries outside your plan"
  if (trades.filter((t) => t.rule_followed === false).length >= 2) return "Rule breaks during execution"

  return null
}

function deriveTopStrength(trades: CoachTrade[], insights: CoachInsight[]): string | null {
  const success = insights.find((i) => i.type === "success")
  if (success) return success.message.split(".")[0]

  const disciplineRate = Math.round(
    (trades.filter((t) => t.rule_followed !== false).length / Math.max(1, trades.length)) * 100,
  )
  if (disciplineRate >= 80) return `Strong discipline at ${disciplineRate}% rule adherence`

  const bestEmotion = analyzeBestEmotion(trades)
  if (bestEmotion) return bestEmotion.message.split(".")[0]

  if (winRate(trades) >= 55) return `Solid ${winRate(trades)}% win rate execution`

  return null
}

export function generateCoachAnalysis(trades: CoachTrade[]): CoachAnalysis {
  const tradeCount = trades.length
  const overallWinRate = winRate(trades)

  if (tradeCount === 0) {
    return {
      hasData: false,
      tradeCount: 0,
      overallWinRate: 0,
      confidenceScore: 0,
      topWeakness: null,
      topStrength: null,
      summary: "Log trades to activate your AI trading psychology engine.",
      insights: [
        {
          id: "empty-start",
          type: "info",
          category: "winrate",
          message: "Start logging trades to receive personalized coaching insights.",
          priority: 100,
        },
        {
          id: "empty-tip",
          type: "tip",
          category: "discipline",
          message: "Track emotion, session, and setup quality for sharper pattern detection.",
          priority: 90,
        },
      ],
      allInsights: [],
      activeWarnings: [],
    }
  }

  if (tradeCount < 3) {
    const starterInsights = [
      {
        id: "few-trades",
        type: "info" as const,
        category: "winrate" as const,
        message: `Only ${tradeCount} trade${tradeCount > 1 ? "s" : ""} logged — aim for at least 5 to unlock pattern analysis.`,
        priority: 100,
      },
      {
        id: "few-trades-tip",
        type: "tip" as const,
        category: "discipline" as const,
        message: "Include session, emotion, and setup on every trade for accurate coaching.",
        priority: 85,
      },
    ]
    return {
      hasData: false,
      tradeCount,
      overallWinRate,
      confidenceScore: Math.round(20 + tradeCount * 10),
      topWeakness: null,
      topStrength: null,
      summary: `${tradeCount} trade${tradeCount > 1 ? "s" : ""} logged · add more data for deeper insights.`,
      insights: starterInsights,
      allInsights: starterInsights,
      activeWarnings: [],
    }
  }

  const candidates = [
    analyzeStreaks(trades),
    analyzeRevengeTrading(trades),
    analyzeFomoAfterWins(trades),
    analyzeSessionLosses(trades),
    analyzeDiscipline(trades),
    analyzeFomoPattern(trades),
    analyzeCounterTrend(trades),
    analyzeSetupQuality(trades),
    analyzeEmotionalRisk(trades),
    analyzeBestEmotion(trades),
    analyzeWinRateTrend(trades),
    analyzeDirectionBias(trades),
  ].filter((insight): insight is CoachInsight => insight !== null)

  if (candidates.length === 0) {
    candidates.push({
      id: "steady-process",
      type: "success",
      category: "discipline",
      message: "Process looks stable — keep executing your plan with consistent risk.",
      priority: 60,
    })
  }

  const allInsights = candidates.sort((a, b) => b.priority - a.priority)
  const insights = allInsights.slice(0, 5)
  const activeWarnings = allInsights.filter(
    (i) => i.type === "warning" && (i.category === "fomo" || i.category === "emotion" || i.category === "streak"),
  )

  return {
    hasData: true,
    tradeCount,
    overallWinRate,
    confidenceScore: computeConfidenceScore(trades, allInsights),
    topWeakness: deriveTopWeakness(trades, allInsights),
    topStrength: deriveTopStrength(trades, allInsights),
    summary: `Analyzing ${tradeCount} trades · ${overallWinRate}% win rate · ${insights.length} insight${insights.length === 1 ? "" : "s"} active`,
    insights,
    allInsights,
    activeWarnings,
  }
}
