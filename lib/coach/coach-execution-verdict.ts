import {
  evaluateCoachDiscipline,
  shouldSkipForEmotion,
  shouldWarnForEmotion,
  type CoachDisciplineInput,
} from "@/lib/coach/coach-discipline-gate"
import { evaluateEntryGate, type EntryGateResult } from "@/lib/coach/entry-gate"
import { isHardSkipEntryGateRule } from "@/lib/coach/entry-gate-classification"
import type { MtfAnalysisResult } from "@/lib/coach/mtf-types"
import type { PrecisionFlowResult } from "@/lib/coach/precision-flow-engine"
import type { StrategyPlaybookMatchResult } from "@/lib/strategy/types"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"

export type CoachFinalVerdict =
  | "A_PLUS_READY"
  | "WAIT_FOR_CONFIRMATION"
  | "SKIP_TRADE"
  | "TRADE_LIMIT_REACHED"
  | "COACH_WARNING"

export type CoachEntryReadinessStatus = "READY" | "WAIT_FOR_CONFIRMATION" | "NOT_READY"

export type CoachExecutionVerdict = {
  setupQuality: {
    grade: string
    score: number
    summary: string
  }
  entryGate: EntryGateResult
  entryReadiness: {
    status: CoachEntryReadinessStatus
    headline: string
    summary: string
    blockers: string[]
  }
  finalVerdict: CoachFinalVerdict
  finalVerdictLabel: string
  mentorLine: string
  reasons: {
    strengths: string[]
    blockers: string[]
  }
}

const SETUP_QUALITY_SKIP_THRESHOLD = 40

export function setupQualityGradeFromScore(score: number): string {
  if (score >= 95) return "A+"
  if (score >= 85) return "A"
  if (score >= 70) return "B"
  if (score >= 55) return "C"
  if (score >= 40) return "D"
  return "F"
}

export function coachFinalVerdictLabel(verdict: CoachFinalVerdict): string {
  if (verdict === "A_PLUS_READY") return "🟢 A+ READY"
  if (verdict === "WAIT_FOR_CONFIRMATION") return "🟡 WAIT FOR CONFIRMATION"
  if (verdict === "TRADE_LIMIT_REACHED") return "🔴 TRADE LIMIT REACHED"
  if (verdict === "COACH_WARNING") return "🟡 COACH WARNING"
  return "🔴 SKIP TRADE"
}

function resolveSetupQualityScore(input: {
  playbook?: StrategyPlaybookMatchResult | null
  mtf?: MtfAnalysisResult | null
}): number {
  if (input.playbook?.setupQualityScore != null) {
    return input.playbook.setupQualityScore
  }
  if (input.mtf) {
    return Math.round(
      (input.mtf.bias.biasAlignmentScore + input.mtf.entry.h1SetupQuality) / 2,
    )
  }
  return 0
}

function collectSetupStrengths(input: {
  entryGate: EntryGateResult
  playbook?: StrategyPlaybookMatchResult | null
  mtf?: MtfAnalysisResult | null
}): string[] {
  const strengths: string[] = []

  for (const rule of input.entryGate.rules) {
    if (rule.passed) {
      strengths.push(`${rule.label}: ${rule.note}`)
    }
  }

  if (input.playbook?.rulesPassed?.length) {
    strengths.push(...input.playbook.rulesPassed.slice(0, 2))
  }

  if (input.mtf?.entry.entryStrengths?.length) {
    strengths.push(...input.mtf.entry.entryStrengths.slice(0, 2))
  }

  return [...new Set(strengths)].slice(0, 6)
}

function collectStructuralSkipReasons(input: {
  playbook?: StrategyPlaybookMatchResult | null
  mtf?: MtfAnalysisResult | null
  setupScore: number
}): string[] {
  const reasons: string[] = []

  if (input.setupScore < SETUP_QUALITY_SKIP_THRESHOLD) {
    reasons.push("Setup quality below minimum threshold.")
  }

  if (input.playbook?.violations?.length) {
    reasons.push(...input.playbook.violations.slice(0, 3))
  }

  const detections = input.playbook?.detections
  if (detections?.countertrend) reasons.push("Counter-trend vs HTF bias")
  if (detections?.revengeEntry) reasons.push("Revenge-style entry pattern")
  if (detections?.htfConflict) reasons.push("HTF conflict on bias stack")

  if (input.mtf?.bias.overallBias === "mixed") {
    reasons.push("Mixed HTF bias — no clear directional edge")
  }

  return [...new Set(reasons)].slice(0, 6)
}

function resolveVerdictFromEntryGate(entryGate: EntryGateResult): CoachFinalVerdict | null {
  if (entryGate.failedRules.length === 0) return null

  const hasHardSkip = entryGate.failedRules.some((rule) =>
    isHardSkipEntryGateRule(rule.id),
  )

  return hasHardSkip ? "SKIP_TRADE" : "WAIT_FOR_CONFIRMATION"
}

function buildMentorLine(input: {
  grade: string
  finalVerdict: CoachFinalVerdict
  entryGate: EntryGateResult
  disciplineMessage?: string | null
}): string {
  if (input.finalVerdict === "A_PLUS_READY") {
    return `${input.entryGate.progressLabel}. All entry gate rules satisfied.`
  }
  if (input.finalVerdict === "TRADE_LIMIT_REACHED") {
    return `${input.entryGate.progressLabel}. ${input.disciplineMessage ?? "Weekly trade limit reached."}`
  }
  if (input.finalVerdict === "COACH_WARNING") {
    return `${input.entryGate.progressLabel}. ${input.disciplineMessage ?? "Coach warning — fix mindset before live size."}`
  }
  if (input.finalVerdict === "WAIT_FOR_CONFIRMATION") {
    const quality =
      input.grade === "A+" || input.grade === "A"
        ? `This is an ${input.grade} setup (${input.entryGate.progressLabel}).`
        : `${input.entryGate.progressLabel}.`
    const block = input.entryGate.blockMessage ?? "Entry gate incomplete."
    return `${quality} ${block}`
  }
  const hardFail = input.entryGate.failedRules.find((rule) =>
    isHardSkipEntryGateRule(rule.id),
  )
  if (hardFail) {
    return `Entry blocked because ${hardFail.label} = ❌ — ${hardFail.note}`
  }
  return "Playbook rules violated or setup quality too low — skip and protect the chapter."
}

export function resolveCoachExecutionVerdict(input: {
  context?: PreTradePlannedContext | null
  playbook?: StrategyPlaybookMatchResult | null
  mtf?: MtfAnalysisResult | null
  precisionFlow?: PrecisionFlowResult | null
  discipline?: CoachDisciplineInput | null
  now?: Date
}): CoachExecutionVerdict {
  const mtf = input.mtf ?? input.context?.mtf_analysis ?? input.context?.chart_analysis?.mtf ?? null
  const playbook =
    input.playbook ?? input.context?.playbook_match ?? mtf?.playbookMatch ?? null

  const entryGate = evaluateEntryGate({
    context: input.context,
    playbook,
    mtf,
    now: input.now,
  })
  const setupScore = resolveSetupQualityScore({ playbook, mtf })
  const grade = setupQualityGradeFromScore(setupScore)
  const structuralSkips = collectStructuralSkipReasons({ playbook, mtf, setupScore })
  const strengths = collectSetupStrengths({ entryGate, playbook, mtf })

  const emotionGateFailed = input.precisionFlow?.rules.find(
    (rule) => rule.id === "emotion_gate" && !rule.passed,
  )
  const disciplineState = evaluateCoachDiscipline({
    weeklyTradesTaken: input.discipline?.weeklyTradesTaken,
    maxTradesPerWeek: input.discipline?.maxTradesPerWeek,
    emotionalState:
      input.discipline?.emotionalState ??
      (emotionGateFailed ? "revenge" : null),
    strictEmotionGate: input.discipline?.strictEmotionGate,
  })

  const setupSummary =
    setupScore >= 85
      ? "The trade idea is valid and aligns with the playbook."
      : setupScore >= 65
        ? "Structure is developing — idea is acceptable but not elite."
        : "Setup quality is below your usual bar."

  let finalVerdict: CoachFinalVerdict
  let entryStatus: CoachEntryReadinessStatus
  let entryHeadline: string
  let entrySummary: string
  let blockers: string[] = []
  let mentorDisciplineMessage: string | null = null

  if (disciplineState.tradeLimitReached && entryGate.rulesPassed === entryGate.rulesTotal) {
    finalVerdict = "TRADE_LIMIT_REACHED"
    entryStatus = "NOT_READY"
    entryHeadline = "LIMIT REACHED"
    entrySummary = disciplineState.tradeLimitMessage ?? "Weekly trade limit reached."
    mentorDisciplineMessage = disciplineState.tradeLimitMessage
    blockers = [disciplineState.tradeLimitMessage ?? "Weekly trade limit reached."]
  } else if (structuralSkips.length > 0 && setupScore < SETUP_QUALITY_SKIP_THRESHOLD) {
    finalVerdict = "SKIP_TRADE"
    entryStatus = "NOT_READY"
    entryHeadline = "NOT READY"
    entrySummary = structuralSkips[0]!
    blockers = [
      ...structuralSkips,
      ...entryGate.failedRules.map((rule) => `${rule.label} = ❌ — ${rule.note}`),
    ]
  } else {
    const gateVerdict = resolveVerdictFromEntryGate(entryGate)

    if (gateVerdict === "SKIP_TRADE") {
      finalVerdict = "SKIP_TRADE"
      entryStatus = "NOT_READY"
      entryHeadline = "NOT READY"
      const hardFail = entryGate.failedRules.find((rule) => isHardSkipEntryGateRule(rule.id))
      entrySummary = hardFail
        ? `Entry blocked because ${hardFail.label} = ❌`
        : "Entry gate failed on structural rules."
      blockers = entryGate.failedRules.map((rule) => `${rule.label} = ❌ — ${rule.note}`)
    } else if (gateVerdict === "WAIT_FOR_CONFIRMATION") {
      finalVerdict = "WAIT_FOR_CONFIRMATION"
      entryStatus = "WAIT_FOR_CONFIRMATION"
      entryHeadline = "WAIT"
      entrySummary = entryGate.blockMessage ?? "One or more entry gate rules failed."
      blockers = entryGate.failedRules.map((rule) => `${rule.label} = ❌ — ${rule.note}`)
    } else if (
      shouldSkipForEmotion(disciplineState, input.discipline?.strictEmotionGate ?? false)
    ) {
      finalVerdict = "SKIP_TRADE"
      entryStatus = "NOT_READY"
      entryHeadline = "NOT READY"
      entrySummary = disciplineState.emotionMessage ?? "Emotional state blocks execution."
      mentorDisciplineMessage = disciplineState.emotionMessage
      blockers = [disciplineState.emotionMessage ?? "Emotional state blocks execution."]
    } else if (shouldWarnForEmotion(disciplineState) && entryGate.entryStatus === "READY") {
      finalVerdict = "COACH_WARNING"
      entryStatus = "WAIT_FOR_CONFIRMATION"
      entryHeadline = "COACH WARNING"
      entrySummary = disciplineState.emotionMessage ?? "Mindset warning before entry."
      mentorDisciplineMessage = disciplineState.emotionMessage
      blockers = [disciplineState.emotionMessage ?? "Mindset warning before entry."]
    } else {
      finalVerdict = "A_PLUS_READY"
      entryStatus = "READY"
      entryHeadline = "ENTRY READY"
      entrySummary = entryGate.progressLabel
      blockers = []
    }
  }

  return {
    setupQuality: {
      grade,
      score: setupScore,
      summary: setupSummary,
    },
    entryGate,
    entryReadiness: {
      status: entryStatus,
      headline: entryHeadline,
      summary: entrySummary,
      blockers,
    },
    finalVerdict,
    finalVerdictLabel: coachFinalVerdictLabel(finalVerdict),
    mentorLine: buildMentorLine({
      grade,
      finalVerdict,
      entryGate,
      disciplineMessage: mentorDisciplineMessage,
    }),
    reasons: {
      strengths,
      blockers,
    },
  }
}

export function mapCoachFinalVerdictToLegacyRecommendation(
  verdict: CoachFinalVerdict,
): "TAKE" | "CAUTION" | "SKIP" {
  if (verdict === "A_PLUS_READY") return "TAKE"
  if (verdict === "WAIT_FOR_CONFIRMATION" || verdict === "COACH_WARNING") return "CAUTION"
  return "SKIP"
}
