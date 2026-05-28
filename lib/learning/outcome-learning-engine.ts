import type { ReflectionTradeInput } from "@/lib/autonomous/reflection-engine"
import { reflectOnCompletedTrade } from "@/lib/autonomous/reflection-engine"
import type { TradeDecisionRecommendation } from "@/lib/intelligence/intelligence-types"

export type OutcomeLessonRecord = {
  tradeId: string
  pair: string
  result: string
  plannedSummary: string
  executionSummary: string
  emotion: string | null
  vyronisVerdictAtPlan: TradeDecisionRecommendation | null
  vyronisWasRight: boolean | null
  overrideReason: string | null
  lesson: string
  naturalReference: string
  category: string
}

export type OutcomeLearningInput = {
  trade: ReflectionTradeInput
  coachPlannedSummary?: string | null
  vyronisVerdictAtPlan?: TradeDecisionRecommendation | null
  vyronisWarningSnippet?: string | null
}

function inferVerdictFromWarning(warning: string | null | undefined): TradeDecisionRecommendation | null {
  if (!warning) return null
  const w = warning.toLowerCase()
  if (/\bskip\b|stand down|pause|do not|don't take/i.test(w)) return "SKIP"
  if (/\bcaution\b|size down|reduce/i.test(w)) return "CAUTION"
  if (/\btake\b|green light/i.test(w)) return "TAKE"
  return null
}

function wasVyronisRight(input: {
  verdict: TradeDecisionRecommendation | null
  result: string
  ruleFollowed: boolean | null | undefined
  impulsive: boolean
}): boolean | null {
  const { verdict, result, ruleFollowed, impulsive } = input
  if (!verdict) return null

  const win = result === "WIN"
  const loss = result === "LOSS"

  if (verdict === "SKIP") {
    if (loss || impulsive || ruleFollowed === false) return true
    if (win && !impulsive && ruleFollowed === true) return false
    return null
  }
  if (verdict === "CAUTION") {
    if (loss && (impulsive || ruleFollowed === false)) return true
    if (win && ruleFollowed !== false) return true
    return null
  }
  if (verdict === "TAKE") {
    if (win && ruleFollowed !== false && !impulsive) return true
    if (loss && (impulsive || ruleFollowed === false)) return false
    return null
  }
  return null
}

export function buildOutcomeLesson(input: OutcomeLearningInput): OutcomeLessonRecord {
  const reflection = reflectOnCompletedTrade(input.trade)
  const emotion = String(input.trade.emotion || "").trim()
  const impulsive = /fomo|revenge|tilted|anxious|euphoric|impulsive/i.test(emotion)

  const plannedSummary =
    input.coachPlannedSummary?.trim() ||
    (input.trade.setup
      ? `Planned ${input.trade.setup} ${input.trade.direction} on ${input.trade.pair}`
      : `Planned ${input.trade.direction} on ${input.trade.pair}`)

  const executionSummary = `${input.trade.result} (${input.trade.pnl >= 0 ? "+" : ""}${input.trade.pnl}) — ${reflection.planVsExecution}`

  const vyronisVerdictAtPlan =
    input.vyronisVerdictAtPlan ?? inferVerdictFromWarning(input.vyronisWarningSnippet)

  const vyronisWasRight = wasVyronisRight({
    verdict: vyronisVerdictAtPlan,
    result: String(input.trade.result),
    ruleFollowed: input.trade.rule_followed,
    impulsive,
  })

  let overrideReason: string | null = null
  if (impulsive) overrideReason = "emotional entry state"
  else if (input.trade.rule_followed === false) overrideReason = "rules not followed"
  else if (/revenge|fomo/i.test(reflection.lesson)) overrideReason = "revenge or FOMO pattern"
  else if (vyronisVerdictAtPlan === "SKIP" && input.trade.result === "WIN") {
    overrideReason = "Vyronis was cautious but outcome won — check if process or luck"
  }

  let naturalReference = reflection.lesson
  if (vyronisWasRight === true && vyronisVerdictAtPlan) {
    naturalReference = `Last time on ${input.trade.pair}, Vyronis said ${vyronisVerdictAtPlan} and the journal backed that up — ${reflection.lesson}`
  } else if (vyronisWasRight === false && vyronisVerdictAtPlan) {
    naturalReference = `On ${input.trade.pair}, we warned ${vyronisVerdictAtPlan} but the outcome still hurt — lesson: ${reflection.lesson}`
  } else if (overrideReason) {
    naturalReference = `Your ${input.trade.pair} trade showed ${overrideReason} — ${reflection.lesson}`
  }

  return {
    tradeId: String(input.trade.id),
    pair: String(input.trade.pair),
    result: String(input.trade.result),
    plannedSummary,
    executionSummary,
    emotion: emotion || null,
    vyronisVerdictAtPlan,
    vyronisWasRight,
    overrideReason,
    lesson: reflection.lesson,
    naturalReference,
    category: reflection.category,
  }
}
