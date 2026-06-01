import { buildTradeDetailAnalysis } from "@/lib/trade-detail-insights"
import { detectCoachRedFlags } from "@/lib/trade-coach/red-flags"
import type {
  CoachInsightLabel,
  DisciplineAnalysis,
  PlannedVsActualComparison,
  PostTradeCoachInput,
  PostTradeCoachResult,
  PreTradePlannedContext,
} from "@/lib/trade-coach/types"

function asString(value: unknown, fallback = "—"): string {
  if (value === null || value === undefined || value === "") return fallback
  return String(value)
}

function parsePercent(value: string | undefined): number | null {
  if (!value) return null
  const parsed = parseFloat(value.replace("%", "").trim())
  return Number.isFinite(parsed) ? parsed : null
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null
  const parsed = parseFloat(value.replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : null
}

function compareField(
  field: string,
  planned: string,
  actual: string,
  noteWhenAligned: string,
  noteWhenMisaligned: string,
): PlannedVsActualComparison {
  const plannedNorm = planned.trim().toLowerCase()
  const actualNorm = actual.trim().toLowerCase()
  const aligned =
    plannedNorm === actualNorm ||
    (plannedNorm !== "—" && actualNorm !== "—" && plannedNorm.includes(actualNorm)) ||
    (plannedNorm !== "—" && actualNorm !== "—" && actualNorm.includes(plannedNorm))

  return {
    field,
    planned,
    actual,
    aligned,
    note: aligned ? noteWhenAligned : noteWhenMisaligned,
  }
}

function compareNumericField(
  field: string,
  plannedRaw: string | undefined,
  actual: number | null | undefined,
  tolerance: number,
  alignedNote: string,
  misalignedNote: string,
): PlannedVsActualComparison | null {
  const plannedNum = parseNumber(plannedRaw)
  if (plannedNum === null || actual === null || actual === undefined) {
    return null
  }

  const aligned = Math.abs(plannedNum - actual) <= tolerance
  return {
    field,
    planned: plannedRaw || "—",
    actual: String(actual),
    aligned,
    note: aligned ? alignedNote : misalignedNote,
  }
}

function buildComparisons(input: PostTradeCoachInput): PlannedVsActualComparison[] {
  const { trade, preTradeResponses, plannedContext } = input
  const comparisons: PlannedVsActualComparison[] = []

  const plannedEntry =
    asString(plannedContext.entry_price, "—") !== "—"
      ? asString(plannedContext.entry_price)
      : preTradeResponses.execution_plan
        ? "From execution plan"
        : "—"
  const entryCompare = compareNumericField(
    "Entry",
    plannedContext.entry_price || undefined,
    trade.entry_price,
    0.0001,
    "Entry matched your pre-trade plan.",
    "Actual entry differed from your pre-trade plan.",
  )
  if (entryCompare) {
    comparisons.push(entryCompare)
  } else {
    comparisons.push(
      compareField(
        "Entry",
        plannedEntry,
        trade.entry_price != null ? String(trade.entry_price) : "—",
        "Entry aligned with your pre-trade plan.",
        "Entry was not logged or differed from your pre-trade plan.",
      ),
    )
  }

  const slCompare = compareNumericField(
    "Stop loss",
    preTradeResponses.planned_sl || plannedContext.stop_loss,
    trade.stop_loss,
    0.0001,
    "Stop loss matched your pre-trade plan.",
    "Actual stop loss differed from your pre-trade plan.",
  )
  if (slCompare) comparisons.push(slCompare)

  const tpCompare = compareNumericField(
    "Take profit",
    preTradeResponses.planned_tp || plannedContext.take_profit,
    trade.take_profit,
    0.0001,
    "Take profit matched your pre-trade plan.",
    "Actual take profit differed from your pre-trade plan.",
  )
  if (tpCompare) comparisons.push(tpCompare)

  const plannedRisk =
    preTradeResponses.planned_risk || asString(plannedContext.risk_percent, "—")
  const actualRisk = `${(trade.risk_percent ?? 1).toFixed(1)}%`
  const plannedRiskNum = parsePercent(plannedRisk)
  const actualRiskNum = trade.risk_percent ?? 1
  const riskAligned =
    plannedRiskNum !== null
      ? Math.abs(plannedRiskNum - actualRiskNum) <= 0.25
      : actualRiskNum <= input.maxRiskPerTrade

  comparisons.push({
    field: "Risk",
    planned: plannedRisk,
    actual: actualRisk,
    aligned: riskAligned && actualRiskNum <= input.maxRiskPerTrade,
    note:
      riskAligned && actualRiskNum <= input.maxRiskPerTrade
        ? "Risk sizing stayed within your stated plan and limits."
        : actualRiskNum > input.maxRiskPerTrade
          ? `Risk exceeded your max ${input.maxRiskPerTrade}% rule.`
          : "Risk differed from what you planned before entry.",
  })

  const plannedEmotion =
    preTradeResponses.emotional_state || asString(plannedContext.emotion, "—")
  const closingEmotion = trade.emotion_after || "Not logged"
  comparisons.push(
    compareField(
      "Emotion",
      plannedEmotion,
      closingEmotion,
      "Closing emotion stayed aligned with your pre-trade state.",
      "Closing emotion diverged from your pre-trade state — review emotional drift.",
    ),
  )

  const plannedRules =
    preTradeResponses.rule_check ||
    (plannedContext.rule_followed === undefined
      ? "—"
      : plannedContext.rule_followed
        ? "Yes"
        : "No")
  const actualRules =
    trade.rule_followed === null ? "—" : trade.rule_followed ? "Yes" : "No"
  const riskRuleBroken = actualRiskNum > input.maxRiskPerTrade
  const rulesCompare = compareField(
    "Rules followed",
    plannedRules,
    actualRules,
    "Rule adherence matched your pre-trade commitment.",
    "Rule adherence differed from your pre-trade commitment.",
  )
  comparisons.push({
    ...rulesCompare,
    aligned: rulesCompare.aligned && !riskRuleBroken,
    note: riskRuleBroken
      ? `Risk exceeded your max ${input.maxRiskPerTrade}% rule — process rules were not fully followed.`
      : rulesCompare.note,
  })

  return comparisons
}

function buildDisciplineAnalysis(
  input: PostTradeCoachInput,
  comparisons: PlannedVsActualComparison[],
): DisciplineAnalysis {
  const tradeAnalysis = buildTradeDetailAnalysis(
    {
      ...input.trade,
      trade_date: input.trade.trade_date ?? null,
      created_at: input.trade.created_at ?? new Date().toISOString(),
      confirmation_signal: input.trade.confirmation_signal ?? null,
    },
    input.maxRiskPerTrade,
  )
  const misaligned = comparisons.filter((item) => !item.aligned)
  const strengths: string[] = []
  const weaknesses: string[] = []

  for (const item of comparisons) {
    if (item.aligned) strengths.push(item.note)
    else weaknesses.push(item.note)
  }

  for (const insight of tradeAnalysis.insights) {
    if (insight.type === "positive") strengths.push(insight.message)
    if (insight.type === "warning") weaknesses.push(insight.message)
  }

  const riskRuleBroken = (input.trade.risk_percent ?? 0) > input.maxRiskPerTrade
  const rulesCompare = comparisons.find((item) => item.field === "Rules followed")
  const hasRuleGap =
    riskRuleBroken ||
    rulesCompare?.aligned === false ||
    input.trade.rule_followed === false

  const ruleAdherence =
    hasRuleGap
      ? tradeAnalysis.disciplineScore >= 55
        ? "mixed"
        : "weak"
      : tradeAnalysis.disciplineScore >= 75
        ? "strong"
        : tradeAnalysis.disciplineScore >= 50
          ? "mixed"
          : "weak"

  const riskyEmotions = new Set(["FOMO", "Revenge", "Euphoric", "Anxious", "Fearful"])
  const emotionalControl = riskyEmotions.has(input.trade.emotion)
    ? "risky"
    : riskyEmotions.has(input.trade.emotion_after || "")
      ? "mixed"
      : "stable"

  const score = Math.max(
    0,
    Math.min(
      100,
      tradeAnalysis.disciplineScore -
        misaligned.length * 6 +
        (input.trade.rule_followed ? 5 : 0),
    ),
  )

  return {
    score,
    strengths: strengths.slice(0, 5),
    weaknesses: weaknesses.slice(0, 5),
    ruleAdherence,
    emotionalControl,
  }
}

function buildCoachingInsights(input: PostTradeCoachInput): CoachInsightLabel[] {
  const insights: CoachInsightLabel[] = []
  const { trade, preTradeResponses, plannedContext } = input
  const redFlags = detectCoachRedFlags(
    plannedContext,
    preTradeResponses,
    input.maxRiskPerTrade,
  )

  if (
    trade.rule_followed === false ||
    preTradeResponses.rule_check?.toLowerCase() === "no" ||
    actualRisk > input.maxRiskPerTrade
  ) {
    insights.push("You broke your rules")
  }

  if (["Calm", "Confident", "Disciplined"].includes(trade.emotion)) {
    insights.push("Good patience")
  }

  if (
    trade.emotion === "FOMO" ||
    trade.emotion_after === "FOMO" ||
    redFlags.some((flag) => flag.id === "fomo")
  ) {
    insights.push("FOMO detected")
  }

  const actualRisk = trade.risk_percent ?? 1
  if (actualRisk <= input.maxRiskPerTrade && !redFlags.some((flag) => flag.id === "over_risking")) {
    insights.push("Risk managed well")
  }

  if (trade.result === "WIN" && trade.rule_followed !== false) {
    insights.push("Process held under pressure")
  }

  if (trade.result === "LOSS" && trade.rule_followed !== false && actualRisk <= input.maxRiskPerTrade) {
    insights.push("Good loss — rules and risk stayed intact")
  }

  if (redFlags.some((flag) => flag.id === "revenge")) {
    insights.push("Revenge pattern flagged in pre-trade check-in")
  }

  if (redFlags.some((flag) => flag.id === "euphoric")) {
    insights.push("Euphoric entry flagged before the trade")
  }

  return [...new Set(insights)].slice(0, 6)
}

function buildCoachingSummary(
  input: PostTradeCoachInput,
  discipline: DisciplineAnalysis,
  comparisons: PlannedVsActualComparison[],
  insights: CoachInsightLabel[],
): string {
  const hasPreTrade = Object.keys(input.preTradeResponses).length > 0
  const misaligned = comparisons.filter((item) => !item.aligned)
  const preConfidence = input.plannedContext.coach_analysis?.confidenceScore

  if (!hasPreTrade) {
    return `Post-trade review for ${input.trade.pair} (${input.trade.result}): discipline score ${discipline.score}/100. Log a pre-trade check-in next time to unlock full plan vs outcome coaching.`
  }

  const confidenceNote =
    preConfidence !== undefined
      ? ` Pre-entry confidence was ${preConfidence}/100.`
      : ""

  if (misaligned.length === 0) {
    return `Strong plan vs execution alignment on ${input.trade.pair} (${input.trade.result}). Discipline score ${discipline.score}/100.${confidenceNote} ${insights[0] || "Keep repeating this process."}`
  }

  return `${input.trade.pair} closed ${input.trade.result} with ${misaligned.length} plan vs execution gap${misaligned.length === 1 ? "" : "s"}. Discipline score ${discipline.score}/100.${confidenceNote} Priority fix: ${discipline.weaknesses[0]?.toLowerCase() || "tighten execution against your plan"}.`
}

function buildFeedbackPoints(
  input: PostTradeCoachInput,
  discipline: DisciplineAnalysis,
  comparisons: PlannedVsActualComparison[],
  insights: CoachInsightLabel[],
): string[] {
  const points: string[] = [...insights]

  if (Object.keys(input.preTradeResponses).length === 0) {
    points.unshift("Use Pre-Trade Coach before entries to capture your plan while intent is clearest.")
  }

  for (const item of comparisons.filter((entry) => !entry.aligned).slice(0, 3)) {
    points.push(`${item.field}: ${item.note}`)
  }

  if (discipline.strengths[0] && !points.includes(discipline.strengths[0])) {
    points.push(`Keep doing this well: ${discipline.strengths[0]}`)
  }

  if (points.length === 0) {
    points.push("Process quality looks solid — journal one takeaway to reinforce the behavior.")
  }

  return [...new Set(points)].slice(0, 7)
}

export function generatePostTradeCoachFeedback(
  input: PostTradeCoachInput,
): PostTradeCoachResult {
  const plannedVsActual = buildComparisons(input)
  const disciplineAnalysis = buildDisciplineAnalysis(input, plannedVsActual)
  const coachingInsights = buildCoachingInsights(input)
  const coachingSummary = buildCoachingSummary(
    input,
    disciplineAnalysis,
    plannedVsActual,
    coachingInsights,
  )
  const feedbackPoints = buildFeedbackPoints(
    input,
    disciplineAnalysis,
    plannedVsActual,
    coachingInsights,
  )

  return {
    plannedVsActual,
    disciplineAnalysis,
    coachingSummary,
    feedbackPoints,
    coachingInsights,
    disciplineScore: disciplineAnalysis.score,
  }
}

export function extractPreTradeResponses(
  messages: Array<{ role: string; question_key: string | null; content: string }>,
): Record<string, string> {
  const responses: Record<string, string> = {}
  for (const message of messages) {
    if (message.role === "user" && message.question_key) {
      responses[message.question_key] = message.content
    }
  }
  return responses
}

export function mergePlannedContext(
  sessionContext: PreTradePlannedContext,
  fallback: PreTradePlannedContext,
): PreTradePlannedContext {
  return {
    ...fallback,
    ...sessionContext,
    coach_analysis: sessionContext.coach_analysis ?? fallback.coach_analysis,
  }
}
