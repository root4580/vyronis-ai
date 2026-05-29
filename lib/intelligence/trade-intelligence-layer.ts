import { buildMistakeAnalysis } from "@/lib/mistake-analysis"
import { getTradeDisplayMistakeTags } from "@/lib/mistake-tags"
import { parseMistakeTags } from "@/lib/trade-form-config"
import { suggestJournalTags } from "@/lib/journal/csv-import"
import { generateJournalIntelligence } from "@/lib/learning/journal-intelligence"
import {
  buildEmotionalTrends,
  detectRecurringBehaviors,
} from "@/lib/learning/pattern-detection"
import { identifyWinningPatterns } from "@/lib/learning/winning-patterns"
import type {
  LearningFeedbackRow,
  LearningTradeRow,
} from "@/lib/learning/types"
import { compareSetupToHistory } from "@/lib/intelligence/setup-similarity-engine"
import {
  generatePatternMemory,
  type PatternMemoryFeedback,
  type PatternMemorySession,
  type PatternMemoryTrade,
} from "@/lib/trade-coach/pattern-memory"
import {
  computeSetupScore,
  resolveStoredSetupScore,
  type SetupScoreTradeInput,
} from "@/lib/trade-coach/setup-score-engine"
import {
  buildTradeDetailInsights,
  calculateTradeDisciplineScore,
  getEmotionDisplay,
  type TradeDetailTrade,
} from "@/lib/trade-detail-insights"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"
import type {
  TradeIntelligenceBundle,
  TradeTagGroup,
} from "@/lib/intelligence/trade-intelligence-types"
import type {
  SetupCoachingInsight,
  SetupScoreBreakdown,
} from "@/lib/trade-coach/setup-score-engine"
import type { NormalizedResearchTrade } from "@/lib/research/types"

const IMPULSIVE = new Set(["FOMO", "Revenge", "Euphoric", "Anxious", "Fearful"])
const STABLE = new Set(["Calm", "Confident", "Disciplined"])

export type IntelligenceTradeRow = LearningTradeRow & {
  import_source?: string | null
  setup_score?: number | null
  setup_classification?: string | null
  setup_score_breakdown?: SetupScoreBreakdown | null
  setup_coaching_insights?: SetupCoachingInsight[] | null
  entry_price?: number | null
  stop_loss?: number | null
  take_profit?: number | null
}

function toSetupInput(trade: IntelligenceTradeRow): SetupScoreTradeInput & IntelligenceTradeRow {
  return {
    ...trade,
    setup: trade.setup || "B Setup",
    emotion: trade.emotion || "Calm",
    result: trade.result,
    direction: trade.direction,
  }
}

function toDetailTrade(trade: IntelligenceTradeRow): TradeDetailTrade {
  return {
    pair: trade.pair,
    direction: trade.direction,
    result: trade.result,
    pnl: trade.pnl,
    emotion: trade.emotion,
    emotion_after: trade.emotion_after,
    strategy_name: trade.strategy_name ?? null,
    risk_percent: trade.risk_percent ?? null,
    rule_followed: trade.rule_followed ?? null,
    session: trade.session ?? null,
    trade_date: trade.trade_date ?? null,
    created_at: trade.created_at,
    confirmation_signal: trade.confirmation_signal ?? null,
    mistake_tags: trade.mistake_tags,
    trade_notes: trade.trade_notes ?? null,
    risk_reward: trade.risk_reward ?? null,
    entry_price: trade.entry_price ?? null,
    stop_loss: trade.stop_loss ?? null,
    take_profit: trade.take_profit ?? null,
  }
}

function buildPlannedContext(trade: IntelligenceTradeRow): PreTradePlannedContext {
  return {
    pair: trade.pair,
    direction: trade.direction as "BUY" | "SELL",
    setup: trade.setup || undefined,
    strategy_name: trade.strategy_name || undefined,
    session: trade.session || undefined,
    emotion: trade.emotion || undefined,
    risk_percent: trade.risk_percent != null ? String(trade.risk_percent) : undefined,
    confirmation_signal: trade.confirmation_signal || undefined,
    higher_timeframe: trade.higher_timeframe || undefined,
    entry_timeframe: trade.entry_timeframe || undefined,
    confirmation_timeframe: trade.confirmation_timeframe || undefined,
    entry_price: trade.entry_price != null ? String(trade.entry_price) : undefined,
    stop_loss: trade.stop_loss != null ? String(trade.stop_loss) : undefined,
    take_profit: trade.take_profit != null ? String(trade.take_profit) : undefined,
  }
}

function buildTagGroup(trade: IntelligenceTradeRow): TradeTagGroup {
  const normalized: NormalizedResearchTrade = {
    external_ticket: String(trade.id),
    pair: trade.pair,
    direction: trade.direction as "BUY" | "SELL",
    result: trade.result as "WIN" | "LOSS" | "BE",
    pnl: trade.pnl,
    trade_date: trade.trade_date || trade.created_at.slice(0, 10),
    opened_at: null,
    closed_at: null,
    lots: null,
    commission: null,
    swap: null,
    stop_loss: trade.stop_loss ?? null,
    take_profit: trade.take_profit ?? null,
    risk_reward: trade.risk_reward ?? null,
    magic_number: null,
    account_login: null,
    broker: null,
    trade_notes: trade.trade_notes ?? null,
    session: trade.session ?? null,
    raw_payload: {},
  }
  const suggested = suggestJournalTags(normalized)

  return {
    setup: trade.setup || suggested.setup,
    emotion: trade.emotion || suggested.emotion,
    emotionAfter: trade.emotion_after ?? null,
    mistakeTags: parseMistakeTags(trade.mistake_tags),
    suggestedTags: suggested.mistake_tags,
    strategyName: trade.strategy_name ?? null,
    session: trade.session ?? null,
  }
}

function resolveDisciplineScore(
  trade: IntelligenceTradeRow,
  history: IntelligenceTradeRow[],
  feedback?: LearningFeedbackRow,
): { score: number; source: TradeIntelligenceBundle["disciplineSource"] } {
  if (feedback?.discipline_score != null && feedback.discipline_score > 0) {
    return { score: Math.round(feedback.discipline_score), source: "coach" }
  }

  const tradeScore = calculateTradeDisciplineScore(toDetailTrade(trade))
  if (tradeScore > 0) {
    return { score: tradeScore, source: "trade_heuristic" }
  }

  const portfolio = buildMistakeAnalysis(history)
  return { score: portfolio.disciplineScore, source: "portfolio" }
}

function emotionalStabilityScore(trades: LearningTradeRow[]): number {
  if (trades.length === 0) return 50
  const recent = trades.slice(0, 12)
  const impulsive = recent.filter((t) => IMPULSIVE.has(t.emotion)).length
  const stable = recent.filter((t) => STABLE.has(t.emotion)).length
  const raw = Math.round(50 + (stable / recent.length) * 40 - (impulsive / recent.length) * 35)
  return Math.max(0, Math.min(100, raw))
}

function buildEmotionInsight(
  trade: IntelligenceTradeRow,
  trends: Array<{ emotion: string; count: number; trend: string }>,
): string | null {
  if (IMPULSIVE.has(trade.emotion) && trade.result === "LOSS") {
    return `${trade.emotion} before this loss matches your higher-risk emotional entries.`
  }
  if (trade.emotion_after && STABLE.has(trade.emotion_after) && IMPULSIVE.has(trade.emotion)) {
    return "You recovered to a calmer state after closing — good reset discipline."
  }
  const dominant = trends[0]
  if (dominant && dominant.count >= 3) {
    return `Recent journal mood leans ${dominant.emotion} (${dominant.count} trades).`
  }
  return null
}

export function buildTradeIntelligenceBundle(input: {
  trade: IntelligenceTradeRow
  history: IntelligenceTradeRow[]
  feedback?: LearningFeedbackRow
  patternFeedback?: PatternMemoryFeedback[]
  patternSessions?: PatternMemorySession[]
  maxRiskPerTrade?: number
  syncedAt?: string | null
}): TradeIntelligenceBundle {
  const { trade, history, feedback, patternFeedback = [], patternSessions = [] } = input
  const maxRisk = input.maxRiskPerTrade ?? 1
  const prior = history.filter((row) => String(row.id) !== String(trade.id))

  const patternTrades = [trade, ...prior].map(
    (row): PatternMemoryTrade => ({
      id: String(row.id),
      direction: row.direction,
      result: row.result,
      pnl: row.pnl,
      emotion: row.emotion,
      emotion_after: row.emotion_after,
      strategy_name: row.strategy_name,
      session: row.session,
      risk_percent: row.risk_percent,
      rule_followed: row.rule_followed,
      mistake_tags: row.mistake_tags,
      confirmation_signal: row.confirmation_signal,
      trade_date: row.trade_date,
      created_at: row.created_at,
    }),
  )

  const patternResult = generatePatternMemory({
    trades: patternTrades,
    feedback: patternFeedback,
    sessions: patternSessions,
    maxRiskPerTrade: maxRisk,
  })

  const setupInput = {
    ...toSetupInput(trade),
    setup_score: trade.setup_score,
    setup_classification: trade.setup_classification,
    setup_score_breakdown: trade.setup_score_breakdown,
    setup_coaching_insights: trade.setup_coaching_insights,
  }

  const hasStoredScore =
    trade.setup_score != null &&
    trade.setup_classification &&
    trade.setup_score_breakdown

  const setupScore = hasStoredScore
    ? resolveStoredSetupScore(setupInput)
    : computeSetupScore({
        trade: toSetupInput(trade),
        maxRiskPerTrade: maxRisk,
        historicalTrades: prior.map((row) => toSetupInput(row)),
        patterns: patternResult.patterns,
      })

  const analysis = generateJournalIntelligence({ trade, history: prior, feedback })
  const discipline = resolveDisciplineScore(trade, prior, feedback)
  const tags = buildTagGroup(trade)
  const trends = buildEmotionalTrends(prior)
  const planned = buildPlannedContext(trade)

  const historicalComparison = compareSetupToHistory({
    planned,
    trades: prior.map((row) => ({
      id: String(row.id),
      pair: row.pair,
      direction: row.direction,
      result: row.result,
      pnl: row.pnl,
      emotion: row.emotion,
      session: row.session,
      setup: row.setup,
      mistake_tags: row.mistake_tags,
      trade_date: row.trade_date,
      created_at: row.created_at,
      risk_reward: row.risk_reward,
      confirmation_signal: row.confirmation_signal,
      higher_timeframe: row.higher_timeframe,
    })),
    minScore: 32,
  })

  const comparisonNarratives = [
    ...analysis.comparisons,
    historicalComparison.narrative,
  ].filter(Boolean)

  const winningPatterns = patternResult.patterns.filter((p) => p.severity === "positive")
  const losingPatterns = patternResult.patterns.filter((p) => p.severity === "warning")

  const beforeEmotion = getEmotionDisplay(trade.emotion)
  const afterEmotion = trade.emotion_after ? getEmotionDisplay(trade.emotion_after) : null

  return {
    tradeId: String(trade.id),
    importSource: trade.import_source ?? null,
    generatedAt: new Date().toISOString(),
    tags,
    setupScore,
    disciplineScore: discipline.score,
    disciplineSource: discipline.source,
    emotion: {
      before: { label: beforeEmotion.label, emoji: beforeEmotion.emoji },
      after: afterEmotion
        ? { label: afterEmotion.label, emoji: afterEmotion.emoji }
        : null,
      shiftedToCalm: Boolean(
        trade.emotion_after &&
          STABLE.has(trade.emotion_after) &&
          IMPULSIVE.has(trade.emotion),
      ),
      dominantRecentEmotion: trends[0]?.emotion ?? null,
      emotionalStabilityScore: emotionalStabilityScore(prior),
      trends,
      insight: buildEmotionInsight(trade, trends),
    },
    screenshot: {
      url: trade.screenshot_url ?? null,
      attached: Boolean(trade.screenshot_url?.trim()),
      visionAvailable: Boolean(trade.screenshot_url?.trim()),
      message: trade.screenshot_url?.trim()
        ? "Screenshot attached — open Command Center chart review for vision analysis."
        : "No screenshot — add one when editing to unlock chart-based coaching.",
    },
    analysis,
    tradeInsights: buildTradeDetailInsights(toDetailTrade(trade), maxRisk),
    historicalComparison,
    comparisonNarratives: [...new Set(comparisonNarratives)].slice(0, 6),
    winLossPatterns: {
      winning: winningPatterns,
      losing: losingPatterns,
      behavioral: detectRecurringBehaviors(prior),
      winningSignals: identifyWinningPatterns(prior),
    },
    patternMemory: patternResult.patterns.slice(0, 8),
    coachFeedback: feedback ?? null,
    syncedAt: input.syncedAt ?? null,
  }
}

export function getDisplayMistakeTags(trade: IntelligenceTradeRow) {
  return getTradeDisplayMistakeTags(toDetailTrade(trade))
}
