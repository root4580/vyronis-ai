/**
 * Vyronis journal intelligence — per-trade learning analysis for Vyronis AI.
 */
import { buildMistakeAnalysis } from "@/lib/mistake-analysis"
import { parseMistakeTags } from "@/lib/trade-form-config"
import {
  detectRecurringBehaviors,
  buildMistakeHeatmap,
} from "@/lib/learning/pattern-detection"
import { identifyWinningPatterns } from "@/lib/learning/winning-patterns"
import { buildTradeMemoryRecord, scoreHtfAlignment } from "@/lib/learning/trade-memory-engine"
import type {
  JournalIntelligenceResult,
  LearningFeedbackRow,
  LearningTradeRow,
} from "@/lib/learning/types"

const IMPULSIVE = new Set(["FOMO", "Revenge", "Euphoric", "Anxious", "Fearful"])

function isPlanComparisonMisaligned(row: {
  aligned?: boolean
  match?: boolean
}): boolean {
  if (typeof row.aligned === "boolean") return !row.aligned
  if (typeof row.match === "boolean") return !row.match
  return false
}

export function generateJournalIntelligence(input: {
  trade: LearningTradeRow
  history: LearningTradeRow[]
  feedback?: LearningFeedbackRow
}): JournalIntelligenceResult {
  const { trade, history, feedback } = input
  const prior = history.filter((row) => String(row.id) !== String(trade.id))
  const memory = buildTradeMemoryRecord({ userId: "local", trade, feedback })
  const behaviors = detectRecurringBehaviors([...prior, trade])
  const winning = identifyWinningPatterns(prior)
  const mistakeAnalysis = buildMistakeAnalysis(prior)

  const detectedMistakes = [...memory.mistakes]
  if (scoreHtfAlignment(trade) < 50) detectedMistakes.push("Against HTF bias")
  if (trade.emotion === "FOMO") detectedMistakes.push("FOMO entry")
  if (trade.emotion === "Revenge") detectedMistakes.push("Revenge trading")
  if (!trade.confirmation_signal?.trim() && trade.confirmation_timeframe === "M15") {
    detectedMistakes.push("No M15 confirmation")
  }

  const comparisons: string[] = []
  const sameSetup = prior.filter((row) => row.setup === trade.setup)
  if (sameSetup.length >= 2) {
    const wins = sameSetup.filter((row) => row.result === "WIN").length
    comparisons.push(
      `${trade.setup} history: ${wins}/${sameSetup.length} wins before this trade.`,
    )
  }

  const samePair = prior.filter((row) => row.pair === trade.pair)
  if (samePair.length >= 2) {
    const recent = samePair.slice(-3)
    const recentLosses = recent.filter((row) => row.result === "LOSS").length
    if (recentLosses >= 2) {
      comparisons.push(`${trade.pair} had ${recentLosses} of last 3 losses — caution.`)
    }
  }

  if (IMPULSIVE.has(trade.emotion)) {
    const impulsiveHistory = prior.filter((row) => IMPULSIVE.has(row.emotion))
    if (impulsiveHistory.length >= 2) {
      comparisons.push("This matches your recurring impulsive-entry pattern.")
    }
  }

  const coachingFeedback: string[] = []
  if (feedback?.feedback_points?.length) {
    coachingFeedback.push(...feedback.feedback_points.slice(0, 3))
  }
  if (detectedMistakes.length > 0) {
    coachingFeedback.push(`Focus next session: reduce ${detectedMistakes[0].toLowerCase()}.`)
  }
  if (trade.result === "LOSS" && IMPULSIVE.has(trade.emotion)) {
    coachingFeedback.push("Step away after impulsive losses — no revenge entries.")
  }
  if (trade.result === "WIN" && trade.rule_followed) {
    coachingFeedback.push("Repeat this process: plan, confirm, execute, journal.")
  }
  if (winning[0]) {
    coachingFeedback.push(`Your edge clusters around ${winning[0].value}.`)
  }

  let verdict: JournalIntelligenceResult["verdict"] = "mixed"
  const discipline = feedback?.discipline_score ?? mistakeAnalysis.disciplineScore
  if (trade.result === "WIN" && discipline >= 70 && detectedMistakes.length === 0) verdict = "strong"
  if (trade.result === "LOSS" && (detectedMistakes.length >= 2 || discipline < 50)) verdict = "weak"

  const planGaps =
    feedback?.planned_vs_actual?.filter((row) => isPlanComparisonMisaligned(row)) ?? []
  const executionLabel = detectedMistakes.length
    ? `with ${detectedMistakes.slice(0, 2).join(", ")}`
    : planGaps.length > 0
      ? `with ${planGaps
          .slice(0, 2)
          .map((row) => row.field.toLowerCase())
          .join(", ")} gaps vs plan`
      : "with clean execution"

  const summaryParts = [
    `${trade.pair} ${trade.direction} ${trade.result}`,
    trade.setup ? `via ${trade.setup}` : null,
    trade.emotion ? `feeling ${trade.emotion}` : null,
    executionLabel,
  ].filter(Boolean)

  return {
    summary: `${summaryParts.join(" ")}.`,
    detectedMistakes: [...new Set(detectedMistakes)],
    coachingFeedback: [...new Set(coachingFeedback)].slice(0, 5),
    comparisons: comparisons.slice(0, 4),
    verdict,
    reinforcedPatterns: behaviors.filter((pattern) =>
      memory.mistakes.some((mistake) => pattern.label.toLowerCase().includes(mistake.toLowerCase().split(" ")[0])),
    ),
    winningSignals: winning.slice(0, 3),
  }
}

export function summarizeTradeForMemory(
  trade: LearningTradeRow,
  feedback?: LearningFeedbackRow,
): string {
  const intelligence = generateJournalIntelligence({ trade, history: [], feedback })
  const mistakes = parseMistakeTags(trade.mistake_tags)
  if (mistakes.length === 0 && trade.result === "WIN") {
    return `${trade.pair} ${trade.direction} win on ${trade.setup || "setup"} with disciplined execution.`
  }
  return intelligence.summary
}
