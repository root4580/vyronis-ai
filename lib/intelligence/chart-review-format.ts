import type { CommandCenterVisionAnalysis } from "@/lib/intelligence/command-center-vision-engine"
import type { TimeframeBundleAnalysis } from "@/lib/intelligence/command-center-bundle-types"
import type { CommandCenterWarning } from "@/lib/command-center/types"
import { buildComparativeMemoryLine } from "@/lib/intelligence/comparative-memory-engine"
import { synthesizeMtfNarrative } from "@/lib/intelligence/mtf-synthesis-engine"
import {
  detectTraderPatterns,
  pickPsychologicalWarning,
} from "@/lib/intelligence/pattern-intelligence-engine"
import { filterFreshWarnings } from "@/lib/intelligence/conversation-continuity"
import { computeWeightedConfidence } from "@/lib/intelligence/weighted-confidence-engine"
import type { VerdictReasoning } from "@/lib/intelligence/verdict-reasoning-engine"
import { evaluateTradeDecision } from "@/lib/intelligence/trade-decision-engine"
import type {
  FullTraderContext,
  TradeDecisionRecommendation,
  TradeDecisionResult,
} from "@/lib/intelligence/intelligence-types"

export type { ChartStructureType } from "@/lib/intelligence/comparative-memory-engine"
export { buildPlannedContextForSimilarity } from "@/lib/intelligence/comparative-memory-engine"

import type { ChartStructureType } from "@/lib/intelligence/comparative-memory-engine"

export type ChartReviewFooter = {
  bias: string
  setupQuality: string
  riskState: string
  verdict: TradeDecisionRecommendation
  waitFor: string
  psychWarning: string | null
  score: number
  verdictReasoning?: VerdictReasoning | null
}

function firstName(traderName?: string | null): string {
  return traderName?.split(" ")[0] || "trader"
}

function inferStructureType(bundle?: TimeframeBundleAnalysis | null): ChartStructureType {
  if (!bundle) return "unclear"
  const raw = bundle.structureType
  if (
    raw === "continuation" ||
    raw === "pullback" ||
    raw === "reversal" ||
    raw === "chop"
  ) {
    return raw
  }
  return "unclear"
}

function resolveBias(chartVision?: CommandCenterVisionAnalysis | null): string {
  const bundle = chartVision?.bundle
  if (bundle) {
    const structure = inferStructureType(bundle)
    const htf = bundle.mtfAnalysis?.bias.overallBias ?? "mixed"
    return `${htf} · ${bundle.inferredStack} · ${structure}`
  }
  const trend = chartVision?.vision?.metrics.trendDirection ?? "neutral"
  return `${trend} · ${chartVision?.vision?.detectedSetup ?? "setup"}`
}

function resolveSetupQuality(
  chartVision?: CommandCenterVisionAnalysis | null,
  score?: number,
): string {
  const s = score ?? chartVision?.bundle?.mtfAnalysis?.visionScore ?? chartVision?.vision?.visionScore ?? 50
  const label = s >= 72 ? "Clean" : s >= 55 ? "Mixed" : "Weak"
  const bundle = chartVision?.bundle
  if (bundle) return `${label} (${s}/100) · AOI ${bundle.aoiQuality}`
  return `${label} (${s}/100)`
}

function resolveRiskState(
  context: FullTraderContext,
  freshWarnings: CommandCenterWarning[],
): string {
  const parts: string[] = []
  const patterns = detectTraderPatterns(context)

  if (patterns.some((p) => p.id === "overtrading")) parts.push("overtrading risk")
  if (patterns.some((p) => p.id === "emotional_tilt")) parts.push("emotional tilt")
  if (context.emotionalState.trend === "volatile") parts.push("volatile mood")
  else if (context.emotionalState.dominantEmotion) {
    parts.push(context.emotionalState.dominantEmotion)
  }

  if (context.risk.todayLossPercent >= context.settings.daily_drawdown_limit * 0.7) {
    parts.push(`drawdown ${context.risk.todayLossPercent.toFixed(0)}%`)
  }

  const critical = freshWarnings.find((w) => w.severity === "critical")
  if (critical) parts.push(critical.message.slice(0, 40))
  else if (freshWarnings[0]) parts.push(freshWarnings[0].message.slice(0, 36))

  return parts.length > 0 ? parts.slice(0, 2).join(" · ") : "Stable"
}

export function buildSimilarTradeMemoryLine(
  context: FullTraderContext,
  chartVision?: CommandCenterVisionAnalysis | null,
): string | null {
  return buildComparativeMemoryLine({ context, chartVision })
}

export function evaluateChartReviewDecision(input: {
  context: FullTraderContext
  chartVision?: CommandCenterVisionAnalysis | null
  mentionedWarningIds?: Set<string>
  baseDecision?: TradeDecisionResult | null
}): TradeDecisionResult {
  const patterns = detectTraderPatterns(input.context)
  const psychWarning = pickPsychologicalWarning(input.context, patterns)

  const weighted = computeWeightedConfidence({
    context: input.context,
    chartVision: input.chartVision,
    mentionedWarningIds: input.mentionedWarningIds,
    psychWarning,
  })

  const base =
    input.baseDecision ??
    evaluateTradeDecision({
      context: input.context,
      mentionedWarningIds: input.mentionedWarningIds,
    })

  const evidence = [
    weighted.reasoningSummary,
    ...weighted.verdictReasoning.whyNotTake.slice(0, 3),
    ...(base?.evidence.slice(0, 2) ?? []),
    buildSimilarTradeMemoryLine(input.context, input.chartVision),
  ].filter(Boolean) as string[]

  return {
    recommendation: weighted.verdict,
    confidence: weighted.score,
    evidence: [...new Set(evidence)].slice(0, 5),
    nextQuestion: weighted.waitFor,
    similarity: base?.similarity,
    weightedConfidence: weighted,
    psychWarning: weighted.psychWarning,
  }
}

export function buildChartReviewFooter(input: {
  context: FullTraderContext
  decision: TradeDecisionResult
  chartVision?: CommandCenterVisionAnalysis | null
  mentionedWarningIds?: Set<string>
}): ChartReviewFooter {
  const freshWarnings = filterFreshWarnings(
    input.context.memory.warnings,
    input.mentionedWarningIds ?? new Set(),
  )
  const score =
    input.decision.weightedConfidence?.score ?? input.decision.confidence

  return {
    bias: resolveBias(input.chartVision),
    setupQuality: resolveSetupQuality(input.chartVision, score),
    riskState: resolveRiskState(input.context, freshWarnings),
    verdict: input.decision.recommendation,
    waitFor: input.decision.nextQuestion,
    psychWarning: input.decision.psychWarning ?? input.decision.weightedConfidence?.psychWarning ?? null,
    score,
    verdictReasoning: input.decision.weightedConfidence?.verdictReasoning ?? null,
  }
}

export function formatChartReviewFooter(footer: ChartReviewFooter): string {
  const lines = [
    "",
    `**Bias:** ${footer.bias}`,
    `**Setup Quality:** ${footer.setupQuality}`,
    `**Risk State:** ${footer.riskState}`,
    `**Verdict:** ${footer.verdict} (${footer.score}/100)`,
    `**One thing to wait for:** ${footer.waitFor}`,
  ]
  if (footer.psychWarning) {
    lines.push(`**Mindset:** ${footer.psychWarning}`)
  }
  return lines.join("\n")
}

export function hasChartReviewFooter(body: string): boolean {
  const hasVerdict = body.includes("**Verdict:**") || body.includes("**Decision:**")
  return hasVerdict && body.includes("**One thing to wait for:**")
}

export function splitChartReviewFooter(footer: string): {
  summary: string
  reasoning: string | null
} {
  const whyIdx = footer.indexOf("**Why not TAKE?**")
  const reasoningIdx = footer.indexOf("**Verdict reasoning**")
  const splitAt =
    whyIdx >= 0 ? whyIdx : reasoningIdx >= 0 ? reasoningIdx : -1
  if (splitAt === -1) return { summary: footer, reasoning: null }
  return {
    summary: footer.slice(0, splitAt).trim(),
    reasoning: footer.slice(splitAt).trim(),
  }
}

export function splitChartReviewContent(content: string): {
  narrative: string
  footer: string | null
} {
  const marker = content.indexOf("**Bias:**")
  if (marker === -1) {
    const alt = content.indexOf("\n\n**")
    if (alt === -1) return { narrative: content, footer: null }
    return {
      narrative: content.slice(0, alt).trim(),
      footer: content.slice(alt).trim(),
    }
  }
  return {
    narrative: content.slice(0, marker).trim(),
    footer: content.slice(marker).trim(),
  }
}

export function buildChartReviewOpening(input: {
  chartVision: CommandCenterVisionAnalysis
  traderName?: string | null
  memoryLine?: string | null
}): string {
  const name = firstName(input.traderName)
  const bundle = input.chartVision.bundle

  if (bundle) {
    const synthesis = synthesizeMtfNarrative(bundle)
    const parts = [
      `${name}, ${synthesis}`,
      input.memoryLine,
    ]
    return parts.filter(Boolean).join("\n\n")
  }

  const vision = input.chartVision.vision
  if (!vision) return input.chartVision.summary

  const summary = vision.summary.split(".").slice(0, 2).join(".").trim()
  return [summary, input.memoryLine].filter(Boolean).join("\n\n")
}

/**
 * Ensures footer verdict matches engine decision and appends structured reasoning
 * so SKIP/CAUTION never contradict strong checklist metrics without explanation.
 */
export function reconcileChartReviewVerdict(input: {
  content: string
  context: FullTraderContext
  decision: TradeDecisionResult
  chartVision?: CommandCenterVisionAnalysis | null
  mentionedWarningIds?: Set<string>
}): string {
  const { narrative, footer } = splitChartReviewContent(input.content)
  const built = buildChartReviewFooter({
    context: input.context,
    decision: input.decision,
    chartVision: input.chartVision,
    mentionedWarningIds: input.mentionedWarningIds,
  })
  if (!footer) {
    return [narrative, formatChartReviewFooter(built)].filter(Boolean).join("\n\n")
  }

  const nextFooter = footer.replace(
    /\*\*Verdict:\*\*[^\n]*/i,
    `**Verdict:** ${built.verdict} (${built.score}/100)`,
  )

  return [narrative, nextFooter].filter(Boolean).join("\n\n")
}

export function assembleChartReviewReply(input: {
  context: FullTraderContext
  chartVision: CommandCenterVisionAnalysis
  decision: TradeDecisionResult
  mentionedWarningIds?: Set<string>
}): string {
  const memoryLine = buildSimilarTradeMemoryLine(input.context, input.chartVision)
  const opening = buildChartReviewOpening({
    chartVision: input.chartVision,
    traderName: input.context.traderName,
    memoryLine,
  })

  const footer = buildChartReviewFooter({
    context: input.context,
    decision: input.decision,
    chartVision: input.chartVision,
    mentionedWarningIds: input.mentionedWarningIds,
  })

  return [opening, formatChartReviewFooter(footer)].filter(Boolean).join("\n\n")
}
