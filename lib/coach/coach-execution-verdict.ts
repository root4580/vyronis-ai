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

const ENTRY_CONFIRMATION_GATE = 70
const M15_ENTRY_GATE = 70
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

function collectEntryBlockers(input: {
  context?: PreTradePlannedContext | null
  playbook?: StrategyPlaybookMatchResult | null
  mtf?: MtfAnalysisResult | null
  precisionFlow?: PrecisionFlowResult | null
}): string[] {
  const blockers: string[] = []
  const { playbook, mtf, precisionFlow } = input

  if (playbook?.missingConfirmations?.length) {
    blockers.push(...playbook.missingConfirmations)
  }

  const detections = playbook?.detections
  if (detections?.beforeConfirmationClose) {
    blockers.push("M15 confirmation candle has not closed yet")
  }
  if (detections?.earlyEntry) {
    blockers.push("Possible early entry before H1 setup completed")
  }
  if (detections?.noLiquidityConfirmation) {
    blockers.push("Liquidity sweep / confirmation not verified")
  }
  if (detections?.overextendedEntry) {
    blockers.push("Entry reads overextended — wait for retest")
  }

  if (mtf) {
    if (mtf.entry.entryConfirmationScore < ENTRY_CONFIRMATION_GATE) {
      blockers.push(
        `Entry confirmation ${mtf.entry.entryConfirmationScore}/100 — trigger incomplete`,
      )
    }
    if (mtf.entry.m15EntryQuality < M15_ENTRY_GATE) {
      blockers.push(`M15 entry quality ${mtf.entry.m15EntryQuality}/100 — below entry gate`)
    }
    for (const warning of mtf.entry.entryWarnings.slice(0, 3)) {
      blockers.push(warning)
    }
  }

  if (precisionFlow) {
    for (const rule of precisionFlow.rules) {
      if (
        (rule.id === "confirmation" || rule.id === "entry_quality") &&
        !rule.passed
      ) {
        blockers.push(rule.note)
      }
    }
  }

  const signal = input.context?.confirmation_signal?.trim()
  if (!signal && mtf && mtf.entry.entryConfirmationScore < ENTRY_CONFIRMATION_GATE) {
    blockers.push("No CHoCH, BOS, engulfing, or break & retest confirmation logged")
  }

  return [...new Set(blockers)].slice(0, 8)
}

function collectSetupStrengths(input: {
  playbook?: StrategyPlaybookMatchResult | null
  mtf?: MtfAnalysisResult | null
  precisionFlow?: PrecisionFlowResult | null
}): string[] {
  const strengths: string[] = []

  if (input.playbook?.rulesPassed?.length) {
    strengths.push(...input.playbook.rulesPassed.slice(0, 4))
  }

  if (input.mtf) {
    if (input.mtf.bias.biasAlignmentScore >= 70 && input.mtf.bias.overallBias !== "mixed") {
      strengths.push(`HTF bias aligned (${input.mtf.bias.overallBias})`)
    }
    if (input.mtf.entry.h1SetupQuality >= 70) {
      strengths.push("H1 structure is clean")
    }
    strengths.push(...input.mtf.entry.entryStrengths.slice(0, 2))
  }

  if (input.precisionFlow) {
    for (const rule of input.precisionFlow.rules) {
      if (
        (rule.id === "htf_bias" || rule.id === "aoi" || rule.id === "risk_reward") &&
        rule.passed
      ) {
        strengths.push(rule.note)
      }
    }
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
  if (input.playbook?.rulesFailed?.length) {
    reasons.push(...input.playbook.rulesFailed.slice(0, 3))
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
      if (
        !rule.passed &&
        (rule.id === "emotion_gate" || rule.id === "htf_bias" || rule.id === "risk_reward")
      ) {
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
}): boolean {
  const skipReasons = collectSkipReasons(input)
  const detections = input.playbook?.detections

  if (input.playbook?.recommendation === "SKIP" && skipReasons.length >= 2) return true
  if (input.precisionFlow?.verdict === "SKIP" && skipReasons.length > 0) return true
  if (detections?.countertrend && detections.revengeEntry) return true
  if (detections?.htfConflict && input.setupScore < 55) return true
  if (input.setupScore < SETUP_QUALITY_SKIP_THRESHOLD) return true
  if (
    input.mtf?.bias.overallBias === "mixed" &&
    (input.mtf.entry.entryConfirmationScore ?? 0) < 50
  ) {
    return true
  }

  return skipReasons.length >= 3
}

function buildMentorLine(
  grade: string,
  finalVerdict: CoachFinalVerdict,
  blockers: string[],
): string {
  if (finalVerdict === "A_PLUS_READY") {
    return "All rules satisfied — this is an A+ setup and an A+ entry."
  }
  if (finalVerdict === "WAIT_FOR_CONFIRMATION") {
    const quality =
      grade === "A+" || grade === "A"
        ? `This is an ${grade} setup, but not an ${grade} entry yet.`
        : "The idea has merit, but entry triggers are still incomplete."
    const waitFor = blockers[0] ? ` Wait for: ${blockers[0].replace(/\.$/, "")}.` : ""
    return `${quality}${waitFor}`
  }
  return "Playbook rules or setup quality are not there — skip and protect the chapter."
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

  const setupScore = resolveSetupQualityScore({ playbook, mtf })
  const grade = setupQualityGradeFromScore(setupScore)
  const entryBlockers = collectEntryBlockers({
    context: input.context,
    playbook,
    mtf,
    precisionFlow: input.precisionFlow,
  })
  const strengths = collectSetupStrengths({ playbook, mtf, precisionFlow: input.precisionFlow })
  const skipReasons = collectSkipReasons({
    playbook,
    mtf,
    precisionFlow: input.precisionFlow,
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

  if (shouldSkipTrade({ setupScore, playbook, mtf, precisionFlow: input.precisionFlow })) {
    finalVerdict = "SKIP_TRADE"
    entryStatus = "NOT_READY"
    entryHeadline = "NOT READY"
    entrySummary = "Playbook rules violated or setup quality too low."
  } else if (entryBlockers.length > 0) {
    finalVerdict = "WAIT_FOR_CONFIRMATION"
    entryStatus = "WAIT_FOR_CONFIRMATION"
    entryHeadline = "WAIT FOR CONFIRMATION"
    entrySummary = entryBlockers[0] ?? "One or more entry triggers are incomplete."
  } else {
    finalVerdict = "A_PLUS_READY"
    entryStatus = "READY"
    entryHeadline = "ENTRY READY"
    entrySummary = "All required confirmations are in place."
  }

  const finalVerdictLabel =
    finalVerdict === "A_PLUS_READY"
      ? "🟢 A+ READY"
      : finalVerdict === "WAIT_FOR_CONFIRMATION"
        ? "🟡 WAIT FOR CONFIRMATION"
        : "🔴 SKIP TRADE"

  const blockers =
    finalVerdict === "SKIP_TRADE"
      ? [...skipReasons, ...entryBlockers].slice(0, 6)
      : entryBlockers

  return {
    setupQuality: {
      grade,
      score: setupScore,
      summary: setupSummary,
    },
    entryReadiness: {
      status: entryStatus,
      headline: entryHeadline,
      summary: entrySummary,
      blockers,
    },
    finalVerdict,
    finalVerdictLabel,
    mentorLine: buildMentorLine(grade, finalVerdict, entryBlockers),
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
