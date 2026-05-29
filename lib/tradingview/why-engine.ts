import type { OutcomeLessonRecord } from "@/lib/learning/outcome-learning-engine"
import { defaultConfirmationChecklist } from "@/lib/strategy-brain/confirmation-engine"
import { findSimilarTradeMemory } from "@/lib/strategy-brain/trade-memory-engine"
import type { TradeMemoryTrade } from "@/lib/strategy-brain/types"
import {
  analyzeSignalMemorySimilarity,
  scoreEmotionalRiskFromHistory,
} from "@/lib/tradingview/signal-memory-similarity"
import { gradeMeetsMinimum } from "@/lib/tradingview/signal-war-room-grader"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"
import type {
  TradingViewSignalAnalysis,
  TradingViewWhyConfidenceCategory,
  TradingViewWhyEngine,
} from "@/lib/tradingview/types"

export type SignalMemoryTrade = {
  id: string
  pair: string
  direction: string
  result: string
  pnl: number
  emotion: string | null
  session: string | null
  setup: string | null
  setup_classification?: string | null
  mistake_tags: string | null
  confirmation_signal: string | null
  risk_reward?: number | null
  higher_timeframe?: string | null
  rule_followed?: boolean | null
  discipline_score?: number | null
  entry_timeframe?: string | null
  trade_notes?: string | null
}

function buildConfidenceCategories(
  analysis: TradingViewSignalAnalysis,
  memorySimilarity: ReturnType<typeof analyzeSignalMemorySimilarity>,
  trades: SignalMemoryTrade[],
): TradingViewWhyConfidenceCategory[] {
  const aoi = analysis.war_room.aoi_status
  const structureScore = Math.round(
    analysis.war_room.alignment_score * 0.55 +
      (aoi === "INSIDE_AOI" || aoi === "CONFIRMING" ? 28 : aoi === "WAITING" ? 10 : 0),
  )

  const momentumScore = Math.round(
    analysis.htf_alignment.score * 0.45 +
      (analysis.session_timing.fits_preferred ? 22 : 8) +
      (analysis.risk_reward.quality === "strong" ? 12 : 0),
  )

  const confirmationScore =
    aoi === "CONFIRMING"
      ? 82
      : aoi === "INSIDE_AOI"
        ? 72
        : analysis.strengths.some((s) => /confirm|retest|structure/i.test(s))
          ? 65
          : 42

  const sessionScore = analysis.session_timing.fits_preferred
    ? analysis.session_timing.session.includes("London") ||
        analysis.session_timing.session.includes("New York")
      ? 78
      : 65
    : 42

  const emotionalRisk = scoreEmotionalRiskFromHistory(trades)
  const emotionalRiskScore = Math.max(0, 100 - emotionalRisk)

  return [
    {
      id: "structure",
      label: "Structure",
      score: Math.min(100, structureScore),
      note: analysis.war_room.headline,
    },
    {
      id: "momentum",
      label: "Momentum",
      score: Math.min(100, momentumScore),
      note: analysis.htf_alignment.label,
    },
    {
      id: "confirmation",
      label: "Confirmation",
      score: confirmationScore,
      note:
        aoi === "CONFIRMING"
          ? "War Room confirming"
          : aoi === "INSIDE_AOI"
            ? "Inside AOI — wait for trigger"
            : "Needs clearer confirmation on chart",
    },
    {
      id: "htf_alignment",
      label: "HTF alignment",
      score: analysis.htf_alignment.score,
      note: analysis.htf_alignment.notes,
    },
    {
      id: "session_quality",
      label: "Session quality",
      score: sessionScore,
      note: analysis.session_timing.notes,
    },
    {
      id: "emotional_risk",
      label: "Emotional risk",
      score: emotionalRiskScore,
      note:
        emotionalRisk >= 60
          ? "Recent journal shows elevated tilt / impulsive patterns"
          : emotionalRisk >= 40
            ? "Some emotional drag in recent trades"
            : "Emotional history stable in recent sample",
    },
  ]
}

function deriveRecommendation(
  analysis: TradingViewSignalAnalysis,
  memory: ReturnType<typeof analyzeSignalMemorySimilarity>,
): string {
  const base = (() => {
    switch (analysis.setup_verdict) {
      case "trade_ready":
        return "War Room alignment is strong — confirm structure on chart, then size per your risk rule."
      case "tradable":
        return "Meets your B+ rule — wait for candle close confirmation before MT5 entry."
      case "wait":
        return "Hold — move War Room AOI to INSIDE_AOI or CONFIRMING before treating this as tradable."
      case "low_quality":
        return "Skip for process — this alert fails your minimum grade vs weekly plan."
      default:
        return analysis.verdict_summary
    }
  })()

  if (memory.narrative && memory.historical_confidence < 50) {
    return `${base} ${memory.narrative}`
  }
  return base
}

function buildPassAndFailReasons(analysis: TradingViewSignalAnalysis): {
  pass_reasons: string[]
  fail_reasons: string[]
} {
  const pass_reasons: string[] = []
  const fail_reasons: string[] = []

  if (analysis.htf_alignment.score >= 70) {
    pass_reasons.push(analysis.htf_alignment.notes)
  } else {
    fail_reasons.push(analysis.htf_alignment.notes)
  }

  if (analysis.war_room.direction_aligned) {
    pass_reasons.push("Alert direction aligns with War Room pair bias.")
  } else if (analysis.war_room.pair_bias) {
    fail_reasons.push(`Direction conflicts with War Room bias (${analysis.war_room.pair_bias}).`)
  }

  if (analysis.war_room.market_bias_aligned) {
    pass_reasons.push("Higher-timeframe market bias supports this side.")
  } else if (analysis.war_room.pair_on_watchlist) {
    fail_reasons.push("HTF market bias does not fully support this direction.")
  }

  if (analysis.war_room.pair_on_watchlist) {
    pass_reasons.push("Pair is on this week's War Room watchlist.")
  } else {
    fail_reasons.push("Pair is not on this week's War Room watchlist.")
  }

  const aoi = analysis.war_room.aoi_status
  if (aoi === "INSIDE_AOI" || aoi === "CONFIRMING") {
    pass_reasons.push(`AOI status: ${aoi.replace(/_/g, " ").toLowerCase()}.`)
  } else if (aoi === "WAITING") {
    fail_reasons.push("AOI still waiting — price has not reached your planned zone.")
  } else if (aoi === "INVALIDATED") {
    fail_reasons.push("War Room AOI invalidated for this pair.")
  }

  if (analysis.session_timing.fits_preferred && analysis.session_timing.session) {
    pass_reasons.push(`${analysis.session_timing.session} session active at alert time.`)
  }

  if (analysis.risk_reward.quality === "strong") {
    pass_reasons.push("Risk/reward structure is favorable on alert levels.")
  } else if (analysis.risk_reward.quality === "poor") {
    fail_reasons.push("Risk/reward below 1:1 on provided stop and target.")
  }

  for (const line of analysis.strengths) {
    if (!pass_reasons.includes(line)) pass_reasons.push(line)
  }
  for (const line of analysis.warnings) {
    if (!fail_reasons.includes(line)) fail_reasons.push(line)
  }
  for (const line of analysis.war_room.notes) {
    if (!pass_reasons.includes(line)) pass_reasons.push(line)
  }

  return {
    pass_reasons: [...new Set(pass_reasons)].slice(0, 8),
    fail_reasons: [...new Set(fail_reasons)].slice(0, 8),
  }
}

function buildImprovements(
  analysis: TradingViewSignalAnalysis,
  fail_reasons: string[],
): string[] {
  const items: string[] = []
  const aoi = analysis.war_room.aoi_status

  if (aoi === "WAITING") items.push("Move War Room AOI to INSIDE_AOI or CONFIRMING.")
  if (!analysis.war_room.direction_aligned) items.push("Align alert direction with weekly pair bias.")
  if (!analysis.war_room.market_bias_aligned) items.push("Wait for HTF market bias to support this side.")
  if (analysis.risk_reward.quality === "poor") {
    items.push("Fix stop and target so R:R is at least 1:1 before entry.")
  }
  if (analysis.htf_alignment.score < 70) {
    items.push("Confirm higher-timeframe trend before sizing up.")
  }
  if (!analysis.session_timing.fits_preferred) {
    items.push("Plan entry for your preferred session window.")
  }
  if (analysis.setup_verdict === "tradable") {
    items.push("Wait for candle close confirmation — do not chase the alert.")
  }

  for (const line of fail_reasons.slice(0, 2)) {
    if (!items.includes(line)) items.push(line)
  }

  return [...new Set(items)].slice(0, 5)
}

function buildMemoryInsights(input: {
  memorySimilarity: ReturnType<typeof analyzeSignalMemorySimilarity>
  memoryLine: string | null
  outcomeSnippets: string[]
}): string[] {
  const lines: string[] = []
  if (input.memoryLine) lines.push(input.memoryLine)
  if (input.memorySimilarity.narrative) lines.push(input.memorySimilarity.narrative)

  for (const match of input.memorySimilarity.matches) {
    const label =
      match.kind === "winner"
        ? "Winner echo"
        : match.kind === "impulsive"
          ? "Impulsive echo"
          : match.kind === "high_confidence"
            ? "High-confidence echo"
            : "Loss echo"
    lines.push(`${label}: ${match.pair} ${match.result} (${match.similarity_score}% similar).`)
  }

  lines.push(...input.outcomeSnippets)
  lines.push(...input.memorySimilarity.warnings)

  return [...new Set(lines)].filter(Boolean).slice(0, 6)
}

export function buildTradingViewWhyEngine(input: {
  symbol: string
  direction: "BUY" | "SELL"
  analysis: TradingViewSignalAnalysis
  trades?: SignalMemoryTrade[]
  planned?: PreTradePlannedContext
  recentOutcomeLessons?: OutcomeLessonRecord[]
}): TradingViewWhyEngine {
  const { analysis, symbol, direction } = input
  const planned: PreTradePlannedContext = input.planned ?? {
    pair: symbol,
    direction,
    strategy_name: null,
    session: analysis.session_timing.session,
    confirmation_signal: analysis.summary,
    higher_timeframe: analysis.htf_alignment.label,
  }

  const trades = input.trades ?? []
  const memory_similarity = analyzeSignalMemorySimilarity({ planned, trades })

  let memoryLine: string | null = null
  if (trades.length > 0) {
    const memoryTrades: TradeMemoryTrade[] = trades.map((t) => ({
      id: t.id,
      pair: t.pair,
      direction: t.direction,
      result: t.result,
      pnl: t.pnl,
      emotion: t.emotion,
      setup: t.setup,
      confirmation_signal: t.confirmation_signal,
      mistake_tags: t.mistake_tags,
      trade_date: null,
    }))
    memoryLine = findSimilarTradeMemory({
      pair: symbol,
      trades: memoryTrades,
      confirmation: defaultConfirmationChecklist(),
    })
  }

  const pairLessons = (input.recentOutcomeLessons || [])
    .filter((l) => l.pair.toUpperCase().replace(/\s/g, "") === symbol.toUpperCase().replace(/\s/g, ""))
    .slice(0, 2)
    .map((l) => l.naturalReference)

  const { pass_reasons, fail_reasons } = buildPassAndFailReasons(analysis)
  const improvements = buildImprovements(analysis, fail_reasons)
  const grade_passed = gradeMeetsMinimum(analysis.setup_grade)

  const memory_insights = buildMemoryInsights({
    memorySimilarity: memory_similarity,
    memoryLine,
    outcomeSnippets: pairLessons,
  })

  const warnings = [
    ...new Set([...analysis.warnings, ...memory_similarity.warnings, ...fail_reasons]),
  ].slice(0, 6)

  const blendedConfidence = Math.round(
    analysis.confidence_score * 0.62 + memory_similarity.historical_confidence * 0.38,
  )

  return {
    headline: `${symbol} ${direction} · ${blendedConfidence}% confidence · Grade ${analysis.setup_grade}`,
    confidence_score: blendedConfidence,
    historical_confidence: memory_similarity.historical_confidence,
    confidence_categories: buildConfidenceCategories(analysis, memory_similarity, trades),
    memory_similarity,
    grade_passed,
    setup_grade: analysis.setup_grade,
    setup_verdict: analysis.setup_verdict,
    pass_reasons,
    fail_reasons,
    improvements,
    strengths: [...new Set([...analysis.strengths, ...analysis.war_room.notes])].slice(0, 6),
    weaknesses: [...new Set(analysis.warnings)].slice(0, 6),
    warnings,
    memory_insights,
    recommendation: deriveRecommendation(analysis, memory_similarity),
    saved_for_training: true,
  }
}
