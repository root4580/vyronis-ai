import {
  doctrineScoreAdjustment,
  fieldStatusLabel,
  resolveLiquiditySweepStatus,
  resolveStructureStatus,
  type JournalFieldReview,
} from "@/lib/trade-coach/post-trade-field-status"
import {
  resolveTradeRiskReward,
  riskRewardStrategyAdjustment,
  type ResolvedTradeRiskReward,
} from "@/lib/trade-coach/post-trade-rr"
import { sanitizePostTradeCopy } from "@/lib/trade-coach/trade-coach-mode"
import { getTradeDisplayMistakeTags } from "@/lib/mistake-tags"
import type {
  PlannedVsActualComparison,
  PostTradeCoachInput,
  PostTradeExecutionReview,
  PostTradeGrade,
  PostTradeResultQuality,
  PostTradeRuleReview,
} from "@/lib/trade-coach/types"

const STABLE_EMOTIONS = new Set(["Calm", "Confident", "Disciplined"])
const IMPULSIVE_EMOTIONS = new Set(["FOMO", "Revenge", "Euphoric", "Anxious", "Fearful"])

export type PostTradeScorecard = {
  strategyScore: number
  strategyGrade: PostTradeGrade
  executionScore: number
  executionGrade: PostTradeGrade
  psychologyScore: number
  psychologyGrade: PostTradeGrade
  /** @deprecated Use executionScore */
  disciplineScore: number
  /** @deprecated Use executionGrade */
  disciplineGrade: PostTradeGrade
  finalScore: number
  finalGrade: PostTradeGrade
}

type ResolvedRiskPercent = {
  value: number | null
  verified: boolean
  display: string
  note: string
}

function resolveRiskPercent(
  riskPercent: number | null | undefined,
  maxRiskPerTrade: number,
): ResolvedRiskPercent {
  if (riskPercent == null || !Number.isFinite(riskPercent)) {
    return {
      value: null,
      verified: false,
      display: "Not verified",
      note: "Risk percentage could not be verified.",
    }
  }

  const withinLimit = riskPercent > 0 && riskPercent <= maxRiskPerTrade
  return {
    value: riskPercent,
    verified: true,
    display: `${riskPercent.toFixed(1)}%`,
    note: withinLimit
      ? `Risk logged at ${riskPercent.toFixed(1)}% — within the ${maxRiskPerTrade}% challenge limit.`
      : `Risk logged at ${riskPercent.toFixed(1)}% — above the ${maxRiskPerTrade}% challenge limit.`,
  }
}

function clamp(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)))
}

function scoreToGrade(score: number): PostTradeGrade {
  if (score >= 93) return "A+"
  if (score >= 88) return "A"
  if (score >= 84) return "A"
  if (score >= 80) return "B"
  if (score >= 74) return "B"
  if (score >= 68) return "C"
  return "D"
}

function scoreToFinalGrade(score: number): PostTradeGrade {
  if (score >= 92) return "A+"
  if (score >= 86) return "A"
  if (score >= 80) return "B"
  if (score >= 68) return "C"
  return "D"
}

function biasAlignedWithDirection(bias?: string | null, direction?: string): boolean | null {
  const normalized = bias?.trim().toLowerCase() ?? ""
  if (!normalized || normalized === "neutral") return null
  if (direction === "BUY") return normalized === "bullish"
  if (direction === "SELL") return normalized === "bearish"
  return null
}

function hasLinkedPreTrade(input: PostTradeCoachInput): boolean {
  return (
    Object.keys(input.preTradeResponses).length > 0 ||
    Boolean(input.plannedContext.coach_analysis?.confidenceScore != null)
  )
}

function buildDoctrineReview(trade: PostTradeCoachInput["trade"]): JournalFieldReview[] {
  return [
    resolveLiquiditySweepStatus(trade.aoi_type),
    resolveStructureStatus("CHoCH", trade.confirmation_type),
    resolveStructureStatus("BOS", trade.confirmation_type),
  ]
}

function buildStrategyScore(input: PostTradeCoachInput, rr: ResolvedTradeRiskReward): {
  score: number
  strengths: string[]
  gaps: string[]
} {
  const { trade } = input
  let score = 58
  const strengths: string[] = []
  const gaps: string[] = []

  const weekly = biasAlignedWithDirection(trade.weekly_bias, trade.direction)
  const daily = biasAlignedWithDirection(trade.daily_bias, trade.direction)
  const h4 = biasAlignedWithDirection(trade.h4_bias, trade.direction)
  const biases = [weekly, daily, h4].filter((v) => v !== null)
  const alignedCount = biases.filter(Boolean).length

  if (alignedCount >= 2) {
    score += 14
    strengths.push("HTF alignment supported the trade direction.")
  } else if (alignedCount === 1) {
    score += 7
    strengths.push("Partial HTF alignment was logged.")
  } else if (biases.length > 0) {
    gaps.push("HTF bias was mixed or counter to direction.")
    score -= 4
  }

  if (trade.aoi_type?.trim()) {
    score += 8
    strengths.push(`AOI logged (${trade.aoi_type.replace(/_/g, " ")}).`)
  }

  const doctrine = buildDoctrineReview(trade)
  score += doctrineScoreAdjustment(doctrine)
  for (const item of doctrine) {
    if (item.status === "yes") strengths.push(`${item.field}: verified.`)
  }

  score += riskRewardStrategyAdjustment(rr)
  if (rr.passesVyronisMinimum) strengths.push(rr.note)

  if (trade.session?.trim()) {
    score += 6
    strengths.push(`Session logged (${trade.session}).`)
  }

  if (trade.result === "WIN") score += 4
  if (trade.setup?.trim()) score += 4

  return { score: clamp(score), strengths, gaps }
}

function buildExecutionScore(
  input: PostTradeCoachInput,
  hasPreTrade: boolean,
  risk: ResolvedRiskPercent,
): {
  score: number
  strengths: string[]
  ruleGaps: string[]
  ruleFollowed: PostTradeRuleReview[]
  ruleMissed: PostTradeRuleReview[]
} {
  const { trade, maxRiskPerTrade } = input
  let score = 72
  const strengths: string[] = []
  const ruleGaps: string[] = []
  const ruleFollowed: PostTradeRuleReview[] = []
  const ruleMissed: PostTradeRuleReview[] = []

  if (risk.verified && risk.value != null) {
    const riskWithinChallenge = risk.value > 0 && risk.value <= maxRiskPerTrade
    if (riskWithinChallenge) {
      score += 12
      ruleFollowed.push({
        rule: `Risk ≤ ${maxRiskPerTrade}% challenge limit`,
        status: "followed",
        note: risk.note,
      })
      strengths.push(`Risk stayed within the ${maxRiskPerTrade}% challenge rule.`)
    } else if (risk.value > maxRiskPerTrade) {
      score -= 10
      const gap = `Rule gap detected: risk exceeded the current ${maxRiskPerTrade}% challenge limit (${risk.display} logged).`
      ruleGaps.push(gap)
      ruleMissed.push({
        rule: `Risk ≤ ${maxRiskPerTrade}% challenge limit`,
        status: "missed",
        note: gap,
      })
    }
  }

  if (trade.rule_followed === true) {
    score += 14
    ruleFollowed.push({
      rule: "Trading rules",
      status: "followed",
      note: "Rules followed was marked Yes on this trade.",
    })
    strengths.push("Rules followed was marked Yes.")
  } else if (trade.rule_followed === false) {
    score -= 18
    const gap = "Rule gap detected: this trade deviated from your preferred process."
    ruleGaps.push(gap)
    ruleMissed.push({
      rule: "Trading rules",
      status: "missed",
      note: "Rules followed was marked No on this trade.",
    })
  }

  if (trade.entry_quality === "impulsive") {
    score -= 12
    ruleGaps.push("Entry quality was logged as impulsive.")
  } else if (trade.entry_quality === "perfect") {
    score += 6
    strengths.push("Entry quality logged as perfect.")
  } else if (trade.entry_quality === "early" || trade.entry_quality === "late") {
    score -= 4
    ruleGaps.push(`Entry timing logged as ${trade.entry_quality}.`)
  }

  const mistakeTags = getTradeDisplayMistakeTags({
    ...trade,
    confirmation_signal: trade.confirmation_signal ?? null,
    mistake_tags: trade.mistake_tags ?? null,
  })
  const executionMistakes = mistakeTags.filter(
    (tag) => tag.dangerous && !["FOMO", "Revenge Trade"].includes(tag.label),
  )
  score -= Math.min(16, executionMistakes.length * 6)
  for (const tag of executionMistakes.slice(0, 2)) {
    ruleGaps.push(`Mistake tag: ${tag.label}.`)
  }

  const movedStop = mistakeTags.some((tag) => tag.label === "Moved Stop")
  if (movedStop) {
    score -= 10
    ruleGaps.push("Set & Forget gap: moved stop logged on this trade.")
    ruleMissed.push({
      rule: "Set & Forget",
      status: "missed",
      note: "Stop was adjusted after entry — journal shows a moved-stop tag.",
    })
  } else if (trade.result && trade.result !== "OPEN") {
    ruleFollowed.push({
      rule: "Set & Forget",
      status: "followed",
      note: "No moved-stop tag logged on this closed trade.",
    })
  }

  if (!hasPreTrade) {
    ruleGaps.push("Pre-trade plan fields were incomplete or not logged.")
    score -= 4
  } else {
    strengths.push("Pre-trade context was available for plan vs execution review.")
  }

  if (trade.trade_notes?.trim()) {
    score += 4
    strengths.push("Trade notes were captured for review.")
  }

  return {
    score: clamp(score),
    strengths,
    ruleGaps,
    ruleFollowed,
    ruleMissed,
  }
}

function buildPsychologyScore(input: PostTradeCoachInput): {
  score: number
  strengths: string[]
  gaps: string[]
} {
  const { trade } = input
  let score = 74
  const strengths: string[] = []
  const gaps: string[] = []

  if (STABLE_EMOTIONS.has(trade.emotion)) {
    score += 10
    strengths.push(`Pre-trade emotion logged as ${trade.emotion.toLowerCase()}.`)
  }
  if (trade.emotion === "Confident") score += 4
  if (IMPULSIVE_EMOTIONS.has(trade.emotion)) {
    score -= 14
    gaps.push(`Pre-trade emotion logged as ${trade.emotion} — impulsive state flagged.`)
  }
  if (trade.emotion === "Revenge") score -= 8
  if (trade.emotion === "FOMO") score -= 6

  if (trade.emotion_after) {
    if (STABLE_EMOTIONS.has(trade.emotion_after)) {
      score += 8
      strengths.push(`Post-trade emotion stayed ${trade.emotion_after.toLowerCase()}.`)
    } else if (IMPULSIVE_EMOTIONS.has(trade.emotion_after)) {
      score -= 8
      gaps.push(`Post-trade emotion logged as ${trade.emotion_after}.`)
    }
  }

  const mistakeTags = getTradeDisplayMistakeTags({
    ...trade,
    confirmation_signal: trade.confirmation_signal ?? null,
    mistake_tags: trade.mistake_tags ?? null,
  })
  if (mistakeTags.some((tag) => tag.label === "FOMO")) {
    score -= 8
    gaps.push("FOMO tagged on this trade.")
  }
  if (mistakeTags.some((tag) => tag.label === "Revenge Trade")) {
    score -= 10
    gaps.push("Revenge trading tagged on this trade.")
  }
  if (mistakeTags.some((tag) => tag.label === "Early Entry")) {
    score -= 4
    gaps.push("Patience gap: early entry tagged.")
  }

  return { score: clamp(score), strengths, gaps }
}

function buildPlannedVsActual(
  input: PostTradeCoachInput,
  risk: ResolvedRiskPercent,
): PlannedVsActualComparison[] {
  const { trade, preTradeResponses, plannedContext, maxRiskPerTrade } = input
  const hasPreTrade = hasLinkedPreTrade(input)
  const comparisons: PlannedVsActualComparison[] = []
  const rr = resolveTradeRiskReward(trade, {
    plannedRr: preTradeResponses.planned_rr,
  })

  comparisons.push({
    field: "Risk:Reward",
    planned: preTradeResponses.planned_rr || "—",
    actual: rr.value != null ? rr.display : "Not verified",
    aligned: rr.value != null ? rr.passesVyronisMinimum : false,
    note: rr.note,
  })

  comparisons.push({
    field: "Risk %",
    planned: preTradeResponses.planned_risk || String(maxRiskPerTrade),
    actual: risk.verified && risk.value != null ? risk.display : "Not verified",
    aligned: risk.verified && risk.value != null ? risk.value <= maxRiskPerTrade : false,
    note: risk.note,
  })

  if (hasPreTrade && plannedContext.entry_price) {
    comparisons.push({
      field: "Entry",
      planned: plannedContext.entry_price,
      actual: trade.entry_price != null ? String(trade.entry_price) : "Not logged",
      aligned:
        trade.entry_price != null &&
        Math.abs(Number(plannedContext.entry_price) - trade.entry_price) <= 0.0001,
      note: "Retrospective plan vs execution check — not an entry readiness warning.",
    })
  }

  comparisons.push({
    field: "Rules followed",
    planned: preTradeResponses.rule_check || (hasPreTrade ? "—" : "Not logged"),
    actual: trade.rule_followed === null ? "Not logged" : trade.rule_followed ? "Yes" : "No",
    aligned:
      trade.rule_followed !== false &&
      (risk.verified && risk.value != null ? risk.value <= maxRiskPerTrade : true),
    note:
      trade.rule_followed === false
        ? "Rules followed was marked No."
        : risk.verified && risk.value != null && risk.value > maxRiskPerTrade
          ? `Risk challenge gap only — rules followed was ${trade.rule_followed === true ? "Yes" : "not logged"}.`
          : "Rule adherence looked clean on this closed trade.",
  })

  return comparisons
}

function buildWhatWentWell(
  strategyStrengths: string[],
  disciplineStrengths: string[],
  trade: PostTradeCoachInput["trade"],
): string[] {
  const items = [...strategyStrengths, ...disciplineStrengths]
  if (trade.result === "WIN") items.unshift("Trade closed as a win.")
  if (trade.result === "LOSS") items.push("Loss logged with reviewable journal data.")
  if (trade.emotion_after && STABLE_EMOTIONS.has(trade.emotion_after)) {
    items.push("Emotion stayed stable after the trade closed.")
  }
  return [...new Set(items.map(sanitizePostTradeCopy))].slice(0, 6)
}

function buildPostTradeVerdict(input: {
  trade: PostTradeCoachInput["trade"]
  strategyGrade: PostTradeGrade
  executionGrade: PostTradeGrade
  psychologyGrade: PostTradeGrade
  ruleGaps: string[]
  riskGap: string | null
}): string {
  const { trade, strategyGrade, executionGrade, psychologyGrade, ruleGaps, riskGap } = input
  const resultLabel =
    trade.result === "WIN"
      ? "Winning trade."
      : trade.result === "LOSS"
        ? "Losing trade."
        : "Closed trade."

  const strategyLine =
    strategyGrade === "A" || strategyGrade === "A+"
      ? "Strategy alignment was strong."
      : strategyGrade === "B"
        ? "Strategy alignment was acceptable."
        : "Strategy alignment had gaps."

  const executionLine =
    executionGrade === "A" || executionGrade === "A+"
      ? "Execution was clean."
      : executionGrade === "B"
        ? "Execution was mostly clean."
        : "Execution had gaps to tighten."

  const psychologyLine =
    psychologyGrade === "A" || psychologyGrade === "A+"
      ? "Psychology stayed stable."
      : psychologyGrade === "B"
        ? "Psychology was acceptable."
        : "Psychology needs attention before repeating."

  const mainIssue =
    riskGap ??
    ruleGaps[0] ??
    (executionGrade === "C" || executionGrade === "D"
      ? "Review execution before repeating the setup."
      : null)

  return sanitizePostTradeCopy(
    [resultLabel, strategyLine, executionLine, psychologyLine, mainIssue ? `Main gap: ${mainIssue}` : null]
      .filter(Boolean)
      .join(" "),
  )
}

function assessResultQuality(
  trade: PostTradeCoachInput["trade"],
  strategyScore: number,
  disciplineScore: number,
  ruleGaps: string[],
): { quality: PostTradeResultQuality; note: string } {
  const processStrong = disciplineScore >= 74 && ruleGaps.length === 0
  const processWeak = disciplineScore < 60 || ruleGaps.length >= 2

  if (trade.result === "WIN") {
    if (processStrong && strategyScore >= 72) {
      return { quality: "good_execution", note: "Win supported by solid strategy and discipline." }
    }
    if (processWeak) {
      return {
        quality: "weak_execution_good_result",
        note: "Profitable result, but discipline gaps should not be ignored.",
      }
    }
    return { quality: "lucky_win", note: "Win arrived with mixed execution quality." }
  }

  if (processStrong) {
    return { quality: "good_execution", note: "Loss with acceptable process quality." }
  }
  return { quality: "weak_execution", note: "Loss with execution gaps to address." }
}

function buildImproveNextTime(ruleGaps: string[], doctrine: JournalFieldReview[]): string[] {
  const points: string[] = []
  for (const gap of ruleGaps.slice(0, 2)) {
    const clean = sanitizePostTradeCopy(gap)
    if (!clean.includes("wait for") && !clean.includes("reduce size")) points.push(clean)
  }
  const notProvided = doctrine.filter((d) => d.status === "not_provided")
  if (notProvided.length > 0) {
    points.push(
      `Log ${notProvided.map((d) => d.field.toLowerCase()).join(", ")} next time or mark them No when absent.`,
    )
  }
  if (points.length === 0) {
    points.push("Repeat the same setup structure with complete journal fields and challenge-risk discipline.")
  }
  return [...new Set(points)].slice(0, 3)
}

function buildRepeatability(input: {
  strategyScore: number
  executionScore: number
  psychologyScore: number
  ruleGaps: string[]
  rr: ResolvedTradeRiskReward
}): { repeatable: boolean; reason: string } {
  if (input.ruleGaps.some((g) => g.includes("challenge limit"))) {
    return {
      repeatable: false,
      reason: "Repeat the setup structure, but only with verified risk and complete pre-trade logging.",
    }
  }
  if (
    input.strategyScore >= 76 &&
    input.executionScore >= 72 &&
    input.psychologyScore >= 68 &&
    input.ruleGaps.length <= 1
  ) {
    return {
      repeatable: true,
      reason: "Setup structure, execution, and psychology are repeatable under the Vyronis model.",
    }
  }
  if (input.rr.value != null && input.rr.value < 1.5) {
    return {
      repeatable: false,
      reason: "Verified R:R was too thin to treat this as a repeatable template trade.",
    }
  }
  return {
    repeatable: false,
    reason: "Refine execution, psychology, and journal completeness before repeating this exact process.",
  }
}

export function buildPostTradeReview(input: PostTradeCoachInput): {
  scorecard: PostTradeScorecard
  executionReview: PostTradeExecutionReview
  plannedVsActual: PlannedVsActualComparison[]
  whatWentWell: string[]
  ruleGaps: string[]
  notVerified: JournalFieldReview[]
} {
  const risk = resolveRiskPercent(input.trade.risk_percent, input.maxRiskPerTrade)
  const rr = resolveTradeRiskReward(input.trade, {
    plannedRr: input.preTradeResponses.planned_rr,
  })
  const doctrine = buildDoctrineReview(input.trade)
  const hasPreTrade = hasLinkedPreTrade(input)

  const strategy = buildStrategyScore(input, rr)
  const execution = buildExecutionScore(input, hasPreTrade, risk)
  const psychology = buildPsychologyScore(input)

  const strategyScore = strategy.score
  const executionScore = execution.score
  const psychologyScore = psychology.score
  const finalScore = clamp(strategyScore * 0.4 + executionScore * 0.35 + psychologyScore * 0.25)
  const scorecard: PostTradeScorecard = {
    strategyScore,
    strategyGrade: scoreToGrade(strategyScore),
    executionScore,
    executionGrade: scoreToGrade(executionScore),
    psychologyScore,
    psychologyGrade: scoreToGrade(psychologyScore),
    disciplineScore: executionScore,
    disciplineGrade: scoreToGrade(executionScore),
    finalScore,
    finalGrade: scoreToFinalGrade(finalScore),
  }

  const ruleGaps = [...execution.ruleGaps, ...psychology.gaps.map(sanitizePostTradeCopy)]
  const riskGap = execution.ruleGaps.find((g) => g.includes("challenge limit")) ?? null
  const resultQuality = assessResultQuality(
    input.trade,
    strategyScore,
    executionScore,
    ruleGaps,
  )
  const repeatability = buildRepeatability({
    strategyScore,
    executionScore,
    psychologyScore,
    ruleGaps,
    rr,
  })

  const postTradeVerdict = buildPostTradeVerdict({
    trade: input.trade,
    strategyGrade: scorecard.strategyGrade,
    executionGrade: scorecard.executionGrade,
    psychologyGrade: scorecard.psychologyGrade,
    ruleGaps,
    riskGap,
  })

  const whatWentWell = buildWhatWentWell(
    [...strategy.strengths, ...psychology.strengths],
    execution.strengths,
    input.trade,
  )
  const notVerified = [
    ...doctrine.filter((d) => d.status === "not_provided"),
    ...(risk.verified ? [] : [{ field: "Risk %", status: "not_provided" as const, display: "Not verified", note: risk.note }]),
    ...(rr.value != null ? [] : [{ field: "Risk:Reward", status: "not_provided" as const, display: "Not verified", note: rr.note }]),
  ]

  const executionReview: PostTradeExecutionReview = {
    coachMode: "post_trade",
    overallGrade: scorecard.finalGrade,
    finalScore: scorecard.finalScore,
    strategyScore: scorecard.strategyScore,
    strategyGrade: scorecard.strategyGrade,
    executionScore: scorecard.executionScore,
    executionGrade: scorecard.executionGrade,
    psychologyScore: scorecard.psychologyScore,
    psychologyGrade: scorecard.psychologyGrade,
    disciplineScore: scorecard.disciplineScore,
    disciplineGrade: scorecard.disciplineGrade,
    postTradeVerdict,
    executedWell: whatWentWell,
    rulesFollowed: execution.ruleFollowed,
    rulesMissed: execution.ruleMissed,
    ruleGaps,
    biggestMistake: ruleGaps[0] ?? null,
    improveNextTime: buildImproveNextTime(ruleGaps, doctrine),
    resultQuality: resultQuality.quality,
    resultQualityNote: resultQuality.note,
    repeatable: repeatability.repeatable,
    repeatableReason: repeatability.reason,
    confirmationReview: doctrine.map((item) => ({
      field: item.field,
      status:
        item.status === "yes"
          ? "verified"
          : item.status === "no"
            ? "absent"
            : "not_verified",
      note: item.note,
      display: fieldStatusLabel(item.status),
    })),
    riskReward: {
      value: rr.value,
      display: rr.display,
      note: rr.note,
    },
    notVerified: notVerified.map((item) => item.field),
  }

  return {
    scorecard,
    executionReview,
    plannedVsActual: buildPlannedVsActual(input, risk),
    whatWentWell,
    ruleGaps,
    notVerified,
  }
}
