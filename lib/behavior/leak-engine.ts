import { evaluateLeakCandidates } from "@/lib/behavior/leak-candidates"
import { formatMoney } from "@/lib/behavior/leak-metrics"
import { buildLeakAnalysisContext } from "@/lib/behavior/trade-context"
import {
  LEAK_ENGINE_DEFAULTS,
  type LeakEngineInput,
  type PrimaryLeakInsight,
} from "@/lib/behavior/types"

function buildInsufficientInsight(tradeCount: number): PrimaryLeakInsight {
  const remaining = Math.max(0, LEAK_ENGINE_DEFAULTS.minTradesActive - tradeCount)
  return {
    id: "insufficient-data",
    status: "insufficient_data",
    confidence: 0,
    headline: "Your primary leak is still forming",
    correctiveAction:
      remaining > 0
        ? `Log ${remaining} more trade${remaining === 1 ? "" : "s"} with emotion, session, and confirmation fields for a specific behavioral read.`
        : "Keep tagging emotion and mistakes — specificity improves with each logged trade.",
    dimensions: [],
    evidence: null,
    minTradesRequired: LEAK_ENGINE_DEFAULTS.minTradesActive,
    tradesRemaining: remaining,
  }
}

function buildLowConfidenceInsight(
  tradeCount: number,
  best: ReturnType<typeof evaluateLeakCandidates>[number] | undefined,
): PrimaryLeakInsight {
  if (!best) return buildInsufficientInsight(tradeCount)

  return {
    id: best.id,
    status: "low_confidence",
    confidence: best.confidence,
    headline: best.headline,
    correctiveAction: best.correctiveAction,
    dimensions: best.dimensions,
    evidence: best.evidence,
    minTradesRequired: LEAK_ENGINE_DEFAULTS.minTradesActive,
    tradesRemaining: Math.max(0, LEAK_ENGINE_DEFAULTS.minTradesActive - tradeCount),
  }
}

function buildActiveInsight(
  best: ReturnType<typeof evaluateLeakCandidates>[number],
): PrimaryLeakInsight {
  return {
    id: best.id,
    status: "active",
    confidence: best.confidence,
    headline: best.headline,
    correctiveAction: best.correctiveAction,
    dimensions: best.dimensions,
    evidence: best.evidence,
    minTradesRequired: LEAK_ENGINE_DEFAULTS.minTradesActive,
    tradesRemaining: 0,
  }
}

/**
 * Detect the single highest-confidence behavioral leak for a trader's journal.
 * Deterministic — uses only stored trade fields, no generative AI.
 */
export function detectPrimaryLeak(input: LeakEngineInput): PrimaryLeakInsight {
  const context = buildLeakAnalysisContext(input)
  const tradeCount = context.trades.length
  const maxRisk = input.maxRiskPerTrade ?? 1

  if (tradeCount < LEAK_ENGINE_DEFAULTS.minTradesLowConfidence) {
    return buildInsufficientInsight(tradeCount)
  }

  const candidates = evaluateLeakCandidates(context, maxRisk)
  const best = candidates[0]

  if (tradeCount < LEAK_ENGINE_DEFAULTS.minTradesActive) {
    return buildLowConfidenceInsight(tradeCount, best)
  }

  if (!best || best.confidence < LEAK_ENGINE_DEFAULTS.minConfidenceActive) {
    return buildLowConfidenceInsight(tradeCount, best)
  }

  return buildActiveInsight(best)
}

/** Week-scoped leak for weekly review / analytics adapters */
export function detectPrimaryLeakForTrades(
  trades: LeakEngineInput["trades"],
  options?: { maxRiskPerTrade?: number; lookbackDays?: number },
): PrimaryLeakInsight {
  return detectPrimaryLeak({
    trades,
    maxRiskPerTrade: options?.maxRiskPerTrade,
    lookbackDays: options?.lookbackDays,
  })
}

export function formatLeakSummary(insight: PrimaryLeakInsight): string {
  if (!insight.evidence) return insight.headline
  return `${insight.headline} Corrective focus: ${insight.correctiveAction}`
}

export function formatLeakEvidenceLine(insight: PrimaryLeakInsight): string | null {
  const evidence = insight.evidence
  if (!evidence) return null
  return `${evidence.sampleCount} trades · ${evidence.frequencyPercent}% of journal · ~${formatMoney(evidence.estimatedMoneyLost)} lost`
}
