import { evaluateEntryGate, type EntryGateResult } from "@/lib/coach/entry-gate"
import type { MtfAnalysisResult } from "@/lib/coach/mtf-types"
import type { PrecisionFlowResult } from "@/lib/coach/precision-flow-engine"
import type { StrategyPlaybookMatchResult } from "@/lib/strategy/types"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"

export type CoachFinalVerdict = "A_PLUS_READY" | "WAIT_FOR_CONFIRMATION" | "SKIP_TRADE"

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

function collectSkipReasons(input: {
  playbook?: StrategyPlaybookMatchResult | null
  mtf?: MtfAnalysisResult | null
  precisionFlow?: PrecisionFlowResult | null
}): string[] {
  const reasons: string[] = []

  if (input.playbook?.violations?.length) {
    reasons.push(...input.playbook.violations.slice(0, 4))
  }

  const detections = input.playbook?.detections
  if (detections?.countertrend) reasons.push("Counter-trend vs HTF bias")
  if (detections?.revengeEntry) reasons.push("Revenge-style entry pattern")
  if (detections?.fomoEntry) reasons.push("FOMO / chase pattern")
  if (detections?.htfConflict) reasons.push("HTF conflict on bias stack")

  if (input.mtf?.bias.overallBias === "mixed") {
    reasons.push("Mixed HTF bias — no clear directional edge")
  }

  if (input.precisionFlow?.verdict === "SKIP") {
    for (const rule of input.precisionFlow.rules) {
      if (!rule.passed && rule.id === "emotion_gate") {
        reasons.push(rule.note)
      }
    }
  }

  return [...new Set(reasons)].slice(0, 6)
}

function shouldSkipTrade(input: {
  setupScore: number
  playbook?: StrategyPlaybookMatchResult | null
  mtf?: MtfAnalysisResult | null
  precisionFlow?: PrecisionFlowResult | null
  entryGate: EntryGateResult
}): boolean {
  const skipReasons = collectSkipReasons(input)
  const detections = input.playbook?.detections

  if (input.setupScore < SETUP_QUALITY_SKIP_THRESHOLD) return true
  if (detections?.countertrend && detections.revengeEntry) return true
  if (input.precisionFlow?.verdict === "SKIP" && skipReasons.length > 0) return true
  if (input.playbook?.recommendation === "SKIP" && skipReasons.length >= 2) return true
  if (
    input.mtf?.bias.overallBias === "mixed" &&
    input.entryGate.rulesPassed <= 2
  ) {
    return true
  }

  return skipReasons.length >= 4
}

function buildMentorLine(input: {
  grade: string
  finalVerdict: CoachFinalVerdict
  entryGate: EntryGateResult
}): string {
  if (input.finalVerdict === "A_PLUS_READY") {
    return `${input.entryGate.progressLabel}. All entry gate rules satisfied.`
  }
  if (input.finalVerdict === "WAIT_FOR_CONFIRMATION") {
    const quality =
      input.grade === "A+" || input.grade === "A"
        ? `This is an ${input.grade} setup (${input.entryGate.progressLabel}).`
        : `${input.entryGate.progressLabel}.`
    const block = input.entryGate.blockMessage ?? "Entry gate incomplete."
    return `${quality} ${block}`
  }
  return "Playbook rules violated or setup quality too low — skip and protect the chapter."
}

export function resolveCoachExecutionVerdict(input: {
  context?: PreTradePlannedContext | null
  playbook?: StrategyPlaybookMatchResult | null
  mtf?: MtfAnalysisResult | null
  precisionFlow?: PrecisionFlowResult | null
}): CoachExecutionVerdict {
  const mtf = input.mtf ?? input.context?.mtf_analysis ?? input.context?.chart_analysis?.mtf ?? null
  const playbook =
    input.playbook ?? input.context?.playbook_match ?? mtf?.playbookMatch ?? null

  const entryGate = evaluateEntryGate({ context: input.context, playbook, mtf })
  const setupScore = resolveSetupQualityScore({ playbook, mtf })
  const grade = setupQualityGradeFromScore(setupScore)
  const skipReasons = collectSkipReasons({
    playbook,
    mtf,
    precisionFlow: input.precisionFlow,
  })
  const strengths = collectSetupStrengths({ entryGate, playbook, mtf })

  const setupSummary =
    setupScore >= 85
      ? "The trade idea is valid and aligns with the playbook."
      : setupScore >= 65
        ? "Structure is developing — idea is acceptable but not elite."
        : "Setup quality is below your usual bar."

  const skip = shouldSkipTrade({
    setupScore,
    playbook,
    mtf,
    precisionFlow: input.precisionFlow,
    entryGate,
  })

  let finalVerdict: CoachFinalVerdict
  let entryStatus: CoachEntryReadinessStatus
  let entryHeadline: string
  let entrySummary: string

  if (skip) {
    finalVerdict = "SKIP_TRADE"
    entryStatus = "NOT_READY"
    entryHeadline = "NOT READY"
    entrySummary = skipReasons[0] ?? "Playbook rules violated or setup quality too low."
  } else if (entryGate.entryStatus === "WAIT") {
    finalVerdict = "WAIT_FOR_CONFIRMATION"
    entryStatus = "WAIT_FOR_CONFIRMATION"
    entryHeadline = "WAIT"
    entrySummary = entryGate.blockMessage ?? "One or more entry gate rules failed."
  } else {
    finalVerdict = "A_PLUS_READY"
    entryStatus = "READY"
    entryHeadline = "ENTRY READY"
    entrySummary = entryGate.progressLabel
  }

  const finalVerdictLabel =
    finalVerdict === "A_PLUS_READY"
      ? "🟢 A+ READY"
      : finalVerdict === "WAIT_FOR_CONFIRMATION"
        ? "🟡 WAIT FOR CONFIRMATION"
        : "🔴 SKIP TRADE"

  const blockers =
    finalVerdict === "SKIP_TRADE"
      ? [
          ...skipReasons,
          ...entryGate.failedRules.map((rule) => `${rule.label} = ❌ — ${rule.note}`),
        ].slice(0, 6)
      : entryGate.failedRules.map((rule) => `${rule.label} = ❌ — ${rule.note}`)

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
    finalVerdictLabel,
    mentorLine: buildMentorLine({ grade, finalVerdict, entryGate }),
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
  if (verdict === "WAIT_FOR_CONFIRMATION") return "CAUTION"
  return "SKIP"
}
