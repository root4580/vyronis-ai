import { MIN_EMOTION_INSIGHT_TRADES } from "@/lib/analytics/insight-thresholds"
import {
  buildDailyRules,
  buildRiskSnapshot,
  getTodayTrades,
  type UserSettingsForm,
} from "@/lib/user-settings"
import {
  countTodayImpulsiveLosses,
  getRecentLossStreak,
  type TradeRiskGuardCategory,
  type TradeRiskGuardHistoryTrade,
} from "@/lib/trade-risk-guard"

export type RiskAwarenessTone = "info" | "caution" | "elevated"

export type RiskAwarenessBanner = {
  id: string
  tone: RiskAwarenessTone
  category: TradeRiskGuardCategory
  title: string
  message: string
}

export type DashboardRiskAwarenessInput = {
  settings: UserSettingsForm
  startingBalance: number
  historicalTrades: TradeRiskGuardHistoryTrade[]
  referenceDate?: string
}

export type DashboardRiskAwarenessResult = {
  banners: RiskAwarenessBanner[]
  overallTone: RiskAwarenessTone | "clear"
}

const IMPULSIVE_EMOTIONS = new Set(["FOMO", "Revenge", "Euphoric", "Anxious", "Fearful", "Greed"])
const STABLE_EMOTIONS = new Set(["Calm", "Confident", "Disciplined"])
const MAX_VISIBLE_BANNERS = 3

const BANNER_PRIORITY: Record<string, number> = {
  "daily-loss-limit": 100,
  "daily-loss-near": 90,
  "max-trades-near": 85,
  "revenge-pattern": 80,
  "impulsive-cluster": 75,
  "loss-streak": 70,
  "emotion-drift": 65,
  "risk-drift": 60,
  "daily-rules-slip": 55,
}

function pushBanner(banners: RiskAwarenessBanner[], banner: RiskAwarenessBanner): void {
  if (banners.some((entry) => entry.id === banner.id)) return
  banners.push(banner)
}

function getImpulsiveRate(trades: TradeRiskGuardHistoryTrade[]): number {
  if (trades.length === 0) return 0
  const impulsive = trades.filter((trade) => IMPULSIVE_EMOTIONS.has(trade.emotion)).length
  return impulsive / trades.length
}

function getAverageRisk(trades: TradeRiskGuardHistoryTrade[]): number {
  if (trades.length === 0) return 0
  return trades.reduce((sum, trade) => sum + (trade.risk_percent ?? 0), 0) / trades.length
}

function sortByPriority(banners: RiskAwarenessBanner[]): RiskAwarenessBanner[] {
  return [...banners].sort(
    (a, b) => (BANNER_PRIORITY[b.id] ?? 0) - (BANNER_PRIORITY[a.id] ?? 0),
  )
}

function resolveOverallTone(banners: RiskAwarenessBanner[]): DashboardRiskAwarenessResult["overallTone"] {
  if (banners.length === 0) return "clear"
  if (banners.some((banner) => banner.tone === "elevated")) return "elevated"
  if (banners.some((banner) => banner.tone === "caution")) return "caution"
  return "info"
}

export function evaluateDashboardRiskAwareness(
  input: DashboardRiskAwarenessInput,
): DashboardRiskAwarenessResult {
  const { settings, startingBalance, historicalTrades } = input
  const referenceDate = input.referenceDate ?? new Date().toISOString().split("T")[0]
  const banners: RiskAwarenessBanner[] = []

  if (historicalTrades.length === 0) {
    return { banners: [], overallTone: "clear" }
  }

  const snapshot = buildRiskSnapshot(settings, historicalTrades, startingBalance)
  const todayTrades = getTodayTrades(historicalTrades, new Date(referenceDate))
  const dailyRules = buildDailyRules(settings, historicalTrades, startingBalance)
  const lossStreak = getRecentLossStreak(historicalTrades)
  const impulsiveLossesToday = countTodayImpulsiveLosses(historicalTrades, referenceDate)

  const lossRatio = snapshot.dailyLossLimit > 0
    ? snapshot.todayLossPercent / snapshot.dailyLossLimit
    : 0

  if (lossRatio >= 1) {
    pushBanner(banners, {
      id: "daily-loss-limit",
      tone: "elevated",
      category: "session",
      title: "Daily loss limit reached",
      message: `${snapshot.todayLossPercent.toFixed(1)}% drawdown today — protect capital before adding risk.`,
    })
  } else if (lossRatio >= 0.8) {
    pushBanner(banners, {
      id: "daily-loss-near",
      tone: "caution",
      category: "session",
      title: "Near daily loss limit",
      message: `${snapshot.todayLossPercent.toFixed(1)}% of ${snapshot.dailyLossLimit}% used — next entry should be A+ size only.`,
    })
  }

  if (todayTrades.length >= settings.max_trades_per_day) {
    pushBanner(banners, {
      id: "max-trades-near",
      tone: "caution",
      category: "session",
      title: "Trade count at session cap",
      message: `${todayTrades.length}/${settings.max_trades_per_day} trades logged — edge decay rises after the cap.`,
    })
  } else if (todayTrades.length === settings.max_trades_per_day - 1 && settings.max_trades_per_day > 1) {
    pushBanner(banners, {
      id: "max-trades-near",
      tone: "info",
      category: "session",
      title: "One trade left in plan",
      message: `You have 1 remaining entry in your ${settings.max_trades_per_day}-trade session plan.`,
    })
  }

  const revengeToday = todayTrades.some((trade) => trade.emotion === "Revenge")
  const recentFive = [...historicalTrades]
    .sort(
      (a, b) =>
        new Date(b.trade_date || b.created_at).getTime() -
        new Date(a.trade_date || a.created_at).getTime(),
    )
    .slice(0, 5)
  const revengeInRecent = recentFive.filter((trade) => trade.emotion === "Revenge").length

  if (revengeToday || (revengeInRecent >= 2 && lossStreak >= 2)) {
    pushBanner(banners, {
      id: "revenge-pattern",
      tone: "elevated",
      category: "emotion",
      title: "Revenge pattern active",
      message: revengeToday
        ? "Revenge state logged today — pause and reset before the next click."
        : `${revengeInRecent} revenge-tagged entries in your last 5 trades after a loss streak.`,
    })
  }

  if (impulsiveLossesToday >= 2) {
    pushBanner(banners, {
      id: "impulsive-cluster",
      tone: impulsiveLossesToday >= 3 ? "elevated" : "caution",
      category: "pattern",
      title: "Multiple impulsive trades",
      message: `${impulsiveLossesToday} emotional losses today — discipline is slipping, not your setup quality.`,
    })
  }

  if (lossStreak >= 3) {
    pushBanner(banners, {
      id: "loss-streak",
      tone: "caution",
      category: "pattern",
      title: "Loss streak in play",
      message: `${lossStreak} consecutive losses — reduce size or run pre-trade coach before continuing.`,
    })
  }

  const sorted = [...historicalTrades].sort(
    (a, b) =>
      new Date(b.trade_date || b.created_at).getTime() -
      new Date(a.trade_date || a.created_at).getTime(),
  )
  const recentEmotionWindow = sorted.slice(0, 5)
  const priorEmotionWindow = sorted.slice(5, 15)
  const recentImpulsiveRate = getImpulsiveRate(recentEmotionWindow)
  const priorImpulsiveRate = getImpulsiveRate(priorEmotionWindow)

  if (
    recentEmotionWindow.length >= MIN_EMOTION_INSIGHT_TRADES &&
    recentImpulsiveRate >= 0.5 &&
    recentImpulsiveRate > priorImpulsiveRate + 0.2
  ) {
    pushBanner(banners, {
      id: "emotion-drift",
      tone: "caution",
      category: "emotion",
      title: "Emotional instability rising",
      message: `${Math.round(recentImpulsiveRate * 100)}% of recent trades show impulsive states — trend is worsening.`,
    })
  } else if (recentEmotionWindow.length >= 2 && !recentEmotionWindow.some((t) => STABLE_EMOTIONS.has(t.emotion))) {
    pushBanner(banners, {
      id: "emotion-drift",
      tone: "info",
      category: "emotion",
      title: "No stable emotional baseline",
      message: "Recent entries lack Calm/Disciplined states — check in before opening the trade form.",
    })
  }

  const recentRiskWindow = sorted.slice(0, 5)
  const priorRiskWindow = sorted.slice(5, 20)
  const recentAvgRisk = getAverageRisk(recentRiskWindow)
  const priorAvgRisk = getAverageRisk(priorRiskWindow)

  if (
    recentRiskWindow.length >= 3 &&
    priorRiskWindow.length >= 5 &&
    recentAvgRisk > priorAvgRisk * 1.12 &&
    recentAvgRisk > settings.max_risk_per_trade * 0.75
  ) {
    pushBanner(banners, {
      id: "risk-drift",
      tone: recentAvgRisk > settings.max_risk_per_trade ? "elevated" : "caution",
      category: "risk",
      title: "Risk sizing drifting higher",
      message: `Recent avg ${recentAvgRisk.toFixed(2)}% vs ${priorAvgRisk.toFixed(2)}% baseline — size creep detected.`,
    })
  } else if (snapshot.highRiskTradeCount >= 2 && snapshot.avgRiskPerTrade > settings.max_risk_per_trade) {
    pushBanner(banners, {
      id: "risk-drift",
      tone: "caution",
      category: "risk",
      title: "Oversized entries in journal",
      message: `${snapshot.highRiskTradeCount} trades above your ${settings.max_risk_per_trade}% max risk rule.`,
    })
  }

  const failedRules = dailyRules.filter((rule) => !rule.checked)
  if (failedRules.length >= 2) {
    pushBanner(banners, {
      id: "daily-rules-slip",
      tone: "info",
      category: "discipline",
      title: "Daily rules need attention",
      message: `${failedRules.length} rules off track today — review checklist before new risk.`,
    })
  }

  const prioritized = sortByPriority(banners).slice(0, MAX_VISIBLE_BANNERS)

  return {
    banners: prioritized,
    overallTone: resolveOverallTone(prioritized),
  }
}

export function mapTradeToRiskHistory(trade: {
  id: string
  risk_percent: number | null
  rule_followed: boolean | null
  emotion: string
  emotion_after?: string | null
  stop_loss?: number | null
  trade_date: string | null
  created_at: string
  result: string
  pnl: number
  setup_classification?: string | null
  mistake_tags?: string | null
}): TradeRiskGuardHistoryTrade {
  return {
    id: trade.id,
    risk_percent: trade.risk_percent,
    rule_followed: trade.rule_followed,
    emotion: trade.emotion,
    emotion_after: trade.emotion_after,
    stop_loss: trade.stop_loss,
    trade_date: trade.trade_date,
    created_at: trade.created_at,
    result: trade.result,
    pnl: trade.pnl,
    setup_classification: trade.setup_classification ?? null,
    mistake_tags: trade.mistake_tags,
  }
}
