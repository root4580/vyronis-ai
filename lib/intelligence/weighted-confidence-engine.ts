import type { CommandCenterVisionAnalysis } from "@/lib/intelligence/command-center-vision-engine"
import type { FullTraderContext } from "@/lib/intelligence/intelligence-types"
import {
  resolveVerdictWithReasoning,
  type VerdictReasoning,
} from "@/lib/intelligence/verdict-reasoning-engine"
import { getTradeRiskReward } from "@/lib/trade-form-utils"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"

export type ConfidenceFactor = {
  key: string
  label: string
  score: number
  weight: number
  note: string
}

export type WeightedConfidenceResult = {
  score: number
  verdict: import("@/lib/intelligence/intelligence-types").TradeDecisionRecommendation
  reasoningSummary: string
  factors: ConfidenceFactor[]
  waitFor: string
  psychWarning: string | null
  verdictReasoning: VerdictReasoning
}

const WEIGHTS = {
  htfAlignment: 0.18,
  confirmation: 0.14,
  volatility: 0.08,
  session: 0.08,
  rrStructure: 0.1,
  emotional: 0.14,
  recentPerformance: 0.12,
  counterTrend: 0.16,
} as const

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function scoreHtfAlignment(chartVision?: CommandCenterVisionAnalysis | null): ConfidenceFactor {
  const bundle = chartVision?.bundle
  const vision = chartVision?.vision
  if (bundle) {
    const aligned = bundle.htfAlignment === "aligned"
    const conflict = bundle.htfAlignment === "conflict"
    const mtf = bundle.mtfAnalysis?.bias.biasAlignmentScore
    const score = mtf ?? (aligned ? 82 : conflict ? 28 : 52)
    return {
      key: "htf",
      label: "HTF alignment",
      score: clamp(score),
      weight: WEIGHTS.htfAlignment,
      note: aligned
        ? "Higher timeframes agree"
        : conflict
          ? "Weekly/Daily/H4 conflict"
          : `Mixed HTF read (${bundle.inferredStack})`,
    }
  }
  const ema = vision?.metrics.emaAlignment ?? 50
  return {
    key: "htf",
    label: "HTF alignment",
    score: clamp(ema),
    weight: WEIGHTS.htfAlignment,
    note: `EMA/structure ${ema}/100`,
  }
}

function scoreConfirmation(chartVision?: CommandCenterVisionAnalysis | null): ConfidenceFactor {
  const bundle = chartVision?.bundle
  const vision = chartVision?.vision
  const score = bundle
    ? bundle.mtfAnalysis?.entry.entryConfirmationScore ??
      (bundle.entryTiming === "on-time" ? 78 : bundle.entryTiming === "late" ? 35 : 55)
    : vision?.metrics.confirmationCandleQuality ?? 50
  return {
    key: "confirmation",
    label: "Confirmation quality",
    score: clamp(score),
    weight: WEIGHTS.confirmation,
    note: bundle
      ? `Entry timing: ${bundle.entryTiming}`
      : `Confirmation ${score}/100`,
  }
}

function scoreVolatility(chartVision?: CommandCenterVisionAnalysis | null): ConfidenceFactor {
  const state = chartVision?.vision?.metrics.volatilityState ?? "normal"
  const score =
    state === "compressed" ? 72 : state === "normal" ? 65 : state === "expanded" ? 38 : 50
  return {
    key: "volatility",
    label: "Volatility",
    score: clamp(score),
    weight: WEIGHTS.volatility,
    note: state === "expanded" ? "Expanded — slippage/whipsaw risk" : `${state} conditions`,
  }
}

function scoreSession(context: FullTraderContext): ConfidenceFactor {
  const sessionName = context.preferredSession || context.memory.greeting.sessionLabel
  const perf = context.sessionPerformance.find((s) =>
    sessionName.toLowerCase().includes(s.name.toLowerCase().slice(0, 4)),
  )
  const wr = perf?.winRate ?? context.memory.snapshot.winRate
  const score = wr >= 60 ? 78 : wr >= 45 ? 58 : wr > 0 ? 42 : 55
  return {
    key: "session",
    label: "Session timing",
    score: clamp(score),
    weight: WEIGHTS.session,
    note: perf
      ? `${perf.name} win rate ~${perf.winRate}%`
      : `Journal win rate ~${context.memory.snapshot.winRate}%`,
  }
}

function scoreRr(planned?: PreTradePlannedContext | null): ConfidenceFactor {
  if (!planned?.entry_price) {
    return {
      key: "rr",
      label: "R:R structure",
      score: 50,
      weight: WEIGHTS.rrStructure,
      note: "R:R not specified in plan",
    }
  }
  const rr = getTradeRiskReward({
    direction: planned.direction || "BUY",
    entry_price: Number(planned.entry_price) || null,
    stop_loss: planned.stop_loss ? Number(planned.stop_loss) : null,
    take_profit: planned.take_profit ? Number(planned.take_profit) : null,
  })
  const score =
    rr === null ? 50 : rr >= 2.5 ? 92 : rr >= 2 ? 82 : rr >= 1.5 ? 68 : rr >= 1 ? 48 : 30
  return {
    key: "rr",
    label: "R:R structure",
    score: clamp(score),
    weight: WEIGHTS.rrStructure,
    note: rr === null ? "Incomplete levels" : `~${rr.toFixed(1)}R planned`,
  }
}

function scoreEmotional(context: FullTraderContext): ConfidenceFactor {
  const { emotionalState, memory } = context
  let score = 70
  if (emotionalState.trend === "volatile") score = 32
  else if (emotionalState.trend === "elevated") score = 48
  if (emotionalState.impulsiveCount >= 2) score -= 18
  const risky = ["fomo", "revenge", "tilted", "euphoric", "anxious"]
  if (
    emotionalState.dominantEmotion &&
    risky.includes(emotionalState.dominantEmotion.toLowerCase())
  ) {
    score -= 22
  }
  if (memory.primaryLeak.status === "active") score -= 10
  const ei = context.emotionalIntelligence
  if (ei) {
    score -= Math.round(ei.impulsiveRiskScore * 0.22)
    score += Math.round(ei.processHealthScore * 0.08)
  }
  const cal = context.verdictCalibration
  if (cal && cal.sampleCount >= 3) {
    score = clamp(score * cal.emotionalWeightMultiplier)
  }
  return {
    key: "emotional",
    label: "Emotional state",
    score: clamp(score),
    weight: WEIGHTS.emotional,
    note: emotionalState.note || emotionalState.dominantEmotion || "Stable mood",
  }
}

function scoreRecentPerformance(context: FullTraderContext): ConfidenceFactor {
  const trades = context.recentTrades.slice(0, 8)
  if (trades.length === 0) {
    return {
      key: "performance",
      label: "Recent performance",
      score: 55,
      weight: WEIGHTS.recentPerformance,
      note: "Limited recent journal data",
    }
  }
  const wins = trades.filter((t) => t.result === "WIN").length
  const wr = Math.round((wins / trades.length) * 100)
  const pnl = trades.reduce((sum, t) => sum + t.pnl, 0)
  let score = wr
  if (pnl < 0 && wr < 50) score -= 12
  if (pnl > 0 && wr >= 55) score += 8
  const cal = context.verdictCalibration
  if (cal && cal.sampleCount >= 3) {
    score = clamp(score * cal.performanceWeightMultiplier)
  }
  return {
    key: "performance",
    label: "Recent performance",
    score: clamp(score),
    weight: WEIGHTS.recentPerformance,
    note: `Last ${trades.length} trades: ${wr}% win, ${pnl >= 0 ? "+" : ""}${pnl.toFixed(0)} PnL`,
  }
}

function scoreCounterTrend(chartVision?: CommandCenterVisionAnalysis | null): ConfidenceFactor {
  const vision = chartVision?.vision
  const bundle = chartVision?.bundle
  let score = 75
  if (vision?.metrics.countertrend) score = 28
  if (bundle?.ltfConfirmsHtf === false) score -= 22
  if (bundle?.htfAlignment === "conflict") score = 25
  if (bundle?.structureType === "reversal" && bundle.ltfConfirmsHtf === false) score -= 15
  return {
    key: "counterTrend",
    label: "Counter-trend risk",
    score: clamp(score),
    weight: WEIGHTS.counterTrend,
    note:
      score < 45
        ? "LTF fighting HTF or counter-trend entry"
        : bundle?.ltfConfirmsHtf
          ? "LTF confirms HTF direction"
          : "Trend alignment acceptable",
  }
}

function buildWaitFor(
  verdict: import("@/lib/intelligence/intelligence-types").TradeDecisionRecommendation,
  chartVision?: CommandCenterVisionAnalysis | null,
): string {
  const bundle = chartVision?.bundle
  if (verdict === "SKIP") {
    return "Pause until emotions and HTF bias stabilize."
  }
  if (verdict === "CAUTION") {
    if (bundle?.entryTiming === "late") return "A fresh trigger — don't chase."
    if (bundle?.ltfConfirmsHtf === false) return "LTF close that confirms HTF direction."
    return "Clean retest of your zone with confirmation."
  }
  return "Scale in only after LTF confirms HTF at your planned level."
}

export function computeWeightedConfidence(input: {
  context: FullTraderContext
  chartVision?: CommandCenterVisionAnalysis | null
  mentionedWarningIds?: Set<string>
  psychWarning?: string | null
}): WeightedConfidenceResult {
  const planned = input.context.activePlannedContext
  const factors = [
    scoreHtfAlignment(input.chartVision),
    scoreConfirmation(input.chartVision),
    scoreVolatility(input.chartVision),
    scoreSession(input.context),
    scoreRr(planned),
    scoreEmotional(input.context),
    scoreRecentPerformance(input.context),
    scoreCounterTrend(input.chartVision),
  ]

  const score = clamp(
    factors.reduce((sum, f) => sum + f.score * f.weight, 0) /
      factors.reduce((sum, f) => sum + f.weight, 0),
  )

  const verdictReasoning = resolveVerdictWithReasoning({
    score,
    factors,
    context: input.context,
    chartVision: input.chartVision,
    mentionedWarningIds: input.mentionedWarningIds,
  })
  const verdict = verdictReasoning.verdict

  const psychWarning =
    input.psychWarning ??
    (input.context.emotionalState.trend === "volatile"
      ? "Your emotional state is elevated — size down or step away."
      : input.context.emotionalState.impulsiveCount >= 2
        ? "Impulsive emotions showed up recently — protect process over P&L."
        : null)

  return {
    score,
    verdict,
    reasoningSummary: verdictReasoning.reasoningSummary,
    factors,
    waitFor: buildWaitFor(verdict, input.chartVision),
    psychWarning,
    verdictReasoning,
  }
}
