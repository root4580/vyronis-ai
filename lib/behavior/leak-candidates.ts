import { parseMistakeTags } from "@/lib/trade-form-config"
import type { BehaviorTrade, LeakCandidateEvaluation, LeakDimension } from "@/lib/behavior/types"
import {
  buildLeakEvidence,
  computeRecencyWeight,
  formatMoney,
  scoreLeakConfidence,
} from "@/lib/behavior/leak-metrics"
import type { LeakAnalysisContext } from "@/lib/behavior/trade-context"
import {
  getConsecutiveLossesBefore,
  hadPriorLossSameDay,
  hasMistakeTag,
  isCounterTrendTrade,
  isImpulsiveEmotion,
} from "@/lib/behavior/trade-context"

type CandidateSpec = {
  id: string
  dimensions: LeakDimension[]
  match: (trade: BehaviorTrade, ctx: LeakAnalysisContext, maxRisk: number) => boolean
  headline: (evidence: LeakCandidateEvaluation["evidence"], label: string) => string
  correctiveAction: string
  label: string
}

const IMPULSIVE_CLASSIFICATIONS = new Set(["Impulsive", "Revenge", "Counter-Trend"])

function evaluateCandidate(
  spec: CandidateSpec,
  context: LeakAnalysisContext,
  maxRisk: number,
): LeakCandidateEvaluation | null {
  const segment = context.trades.filter((trade) => spec.match(trade, context, maxRisk))
  if (segment.length < 5) return null

  const evidence = buildLeakEvidence(segment, context.trades)
  if (evidence.lossRateDelta < 8 && evidence.estimatedMoneyLost < 50) return null

  const recencyWeight = computeRecencyWeight(segment, context.trades)
  const confidence = scoreLeakConfidence(evidence, recencyWeight)
  if (confidence < 38) return null

  return {
    id: spec.id,
    dimensions: spec.dimensions,
    segment,
    complement: context.trades.filter((trade) => !segment.some((row) => row.id === trade.id)),
    evidence,
    confidence,
    headline: spec.headline(evidence, spec.label),
    correctiveAction: spec.correctiveAction,
  }
}

function buildSessionCandidates(context: LeakAnalysisContext, maxRisk: number): LeakCandidateEvaluation[] {
  const sessions = new Set(
    context.trades.map((trade) => trade.session).filter((value): value is string => Boolean(value)),
  )
  const results: LeakCandidateEvaluation[] = []

  for (const session of sessions) {
    const spec: CandidateSpec = {
      id: `no-confirm-${session.toLowerCase().replace(/\s+/g, "-")}`,
      label: `${session} without confirmation`,
      dimensions: ["confirmation", "session"],
      match: (trade) =>
        trade.session === session &&
        (!trade.confirmation_signal ||
          hasMistakeTag(trade, /no confirmation/i) ||
          parseMistakeTags(trade.mistake_tags).some((tag) => /early|late entry|chased/i.test(tag))),
      headline: (evidence, label) =>
        `You lose ${evidence.lossRateDelta}% more often on ${label.toLowerCase()} (${evidence.sampleCount} trades, ~${formatMoney(evidence.estimatedMoneyLost)}).`,
      correctiveAction: `During ${session}, do not log an entry until M15 confirmation is documented on the chart.`,
    }
    const evaluated = evaluateCandidate(spec, context, maxRisk)
    if (evaluated) results.push(evaluated)
  }

  return results
}

function buildPostLossSessionCandidates(
  context: LeakAnalysisContext,
  maxRisk: number,
): LeakCandidateEvaluation[] {
  const sessions = new Set(
    context.trades.map((trade) => trade.session).filter((value): value is string => Boolean(value)),
  )
  const results: LeakCandidateEvaluation[] = []

  for (const session of sessions) {
    const spec: CandidateSpec = {
      id: `post-loss-${session.toLowerCase().replace(/\s+/g, "-")}`,
      label: `emotional re-entry in ${session} after a loss`,
      dimensions: ["emotion", "session", "pattern"],
      match: (trade, ctx) =>
        trade.session === session &&
        hadPriorLossSameDay(trade, ctx) &&
        isImpulsiveEmotion(trade.emotion),
      headline: (evidence, label) =>
        `You lose ${evidence.lossRateDelta}% more often when ${label} (${evidence.sampleCount} trades, ~${formatMoney(evidence.estimatedMoneyLost)}).`,
      correctiveAction: `After a loss in ${session}, pause 15 minutes and reset emotion before the next journal entry.`,
    }
    const evaluated = evaluateCandidate(spec, context, maxRisk)
    if (evaluated) results.push(evaluated)
  }

  return results
}

const BASE_CANDIDATES: CandidateSpec[] = [
  {
    id: "post-loss-emotional",
    label: "emotional re-entry after a prior loss",
    dimensions: ["emotion", "pattern", "timing"],
    match: (trade, ctx) => hadPriorLossSameDay(trade, ctx) && isImpulsiveEmotion(trade.emotion),
    headline: (evidence, label) =>
      `You lose ${evidence.lossRateDelta}% more often when trading ${label} (${evidence.sampleCount} trades, ~${formatMoney(evidence.estimatedMoneyLost)}).`,
    correctiveAction:
      "After any loss on the day, run pre-trade coach or skip the next entry until emotion is Calm or Disciplined.",
  },
  {
    id: "no-confirmation",
    label: "entries without confirmation",
    dimensions: ["confirmation", "discipline"],
    match: (trade) =>
      !trade.confirmation_signal ||
      hasMistakeTag(trade, /no confirmation/i),
    headline: (evidence, label) =>
      `You lose ${evidence.lossRateDelta}% more often on ${label} (${evidence.sampleCount} trades, ~${formatMoney(evidence.estimatedMoneyLost)}).`,
    correctiveAction:
      "Do not log the trade until confirmation signal and timeframe are filled — no confirmation, no click.",
  },
  {
    id: "oversized-after-streak",
    label: "oversized risk after consecutive losses",
    dimensions: ["risk", "pattern"],
    match: (trade, ctx, maxRisk) =>
      getConsecutiveLossesBefore(trade, ctx) >= 2 &&
      (trade.risk_percent ?? 0) > maxRisk,
    headline: (evidence, label) =>
      `${label} shows a ${evidence.lossRateDelta}% higher loss rate (${evidence.sampleCount} trades, ~${formatMoney(evidence.estimatedMoneyLost)}).`,
    correctiveAction:
      "After two losses, cut size in half or stop for the session — size creep is compounding drawdown.",
  },
  {
    id: "impulsive-setup",
    label: "Impulsive or revenge-classified setups",
    dimensions: ["setup", "emotion"],
    match: (trade) =>
      Boolean(trade.setup_classification && IMPULSIVE_CLASSIFICATIONS.has(trade.setup_classification)),
    headline: (evidence, label) =>
      `Your journal shows ${evidence.lossRateDelta}% more losses on ${label} (${evidence.sampleCount} trades, ~${formatMoney(evidence.estimatedMoneyLost)}).`,
    correctiveAction:
      "Treat Impulsive/Revenge classifications as a no-trade filter until structure and emotion realign.",
  },
  {
    id: "rule-break-repeat",
    label: "trades where your plan was not followed",
    dimensions: ["discipline"],
    match: (trade) => trade.rule_followed === false || hasMistakeTag(trade, /ignored rules/i),
    headline: (evidence, label) =>
      `You lose ${evidence.lossRateDelta}% more often on ${label} (${evidence.sampleCount} trades, ~${formatMoney(evidence.estimatedMoneyLost)}).`,
    correctiveAction:
      "If the rule is broken before entry, stop — log the urge, not the trade.",
  },
  {
    id: "counter-trend-structure",
    label: "counter-trend structure entries",
    dimensions: ["setup", "confirmation"],
    match: (trade) => isCounterTrendTrade(trade),
    headline: (evidence, label) =>
      `You lose ${evidence.lossRateDelta}% more often on ${label} (${evidence.sampleCount} trades, ~${formatMoney(evidence.estimatedMoneyLost)}).`,
    correctiveAction:
      "Align with higher-timeframe bias — counter-trend entries need a written exception in notes.",
  },
  {
    id: "revenge-emotion",
    label: "Revenge emotional state",
    dimensions: ["emotion"],
    match: (trade) =>
      trade.emotion === "Revenge" ||
      hasMistakeTag(trade, /revenge/i),
    headline: (evidence, label) =>
      `You lose ${evidence.lossRateDelta}% more often when logging ${label} (${evidence.sampleCount} trades, ~${formatMoney(evidence.estimatedMoneyLost)}).`,
    correctiveAction:
      "Revenge entries are a process violation — close the platform for 15 minutes and journal the trigger.",
  },
  {
    id: "fomo-emotion",
    label: "FOMO emotional state",
    dimensions: ["emotion"],
    match: (trade) => trade.emotion === "FOMO" || trade.emotion_after === "FOMO",
    headline: (evidence, label) =>
      `You lose ${evidence.lossRateDelta}% more often when logging ${label} (${evidence.sampleCount} trades, ~${formatMoney(evidence.estimatedMoneyLost)}).`,
    correctiveAction:
      "FOMO entries skip confirmation — wait for your checklist, not the candle.",
  },
]

export function evaluateLeakCandidates(
  context: LeakAnalysisContext,
  maxRiskPerTrade: number,
): LeakCandidateEvaluation[] {
  const results: LeakCandidateEvaluation[] = []

  for (const spec of BASE_CANDIDATES) {
    const evaluated = evaluateCandidate(spec, context, maxRiskPerTrade)
    if (evaluated) results.push(evaluated)
  }

  results.push(...buildSessionCandidates(context, maxRiskPerTrade))
  results.push(...buildPostLossSessionCandidates(context, maxRiskPerTrade))

  return results.sort((a, b) => {
    const scoreA = a.confidence + a.evidence.estimatedMoneyLost * 0.02 + a.evidence.lossRateDelta
    const scoreB = b.confidence + b.evidence.estimatedMoneyLost * 0.02 + b.evidence.lossRateDelta
    return scoreB - scoreA
  })
}
