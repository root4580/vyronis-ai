import type { CoachExecutionVerdict, CoachFinalVerdict } from "@/lib/coach/coach-execution-verdict"
import type { EntryGateRuleId } from "@/lib/coach/entry-gate"
import type { MtfAnalysisResult, MtfBiasDirection } from "@/lib/coach/mtf-types"
import type { VyronisCoachDeepAnalysis, VyronisCoachResponse } from "@/lib/coach/vyronis-coach-response"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"

export type CoachPrimaryAction = "TAKE" | "WAIT" | "SKIP"

export type CoachDecisionFactor = {
  id: string
  label: string
  value: string
  passed: boolean
}

export type CoachFailedRule = {
  label: string
  explanation: string
}

export type CoachAiExplanation = {
  summary: string | null
  warnings: string[]
  journalNote: string | null
  oneImprovement: string | null
}

export type CoachDecisionView = {
  primaryAction: CoachPrimaryAction
  setupGrade: string
  setupScore: number
  decisionFactors: CoachDecisionFactor[]
  failedRules: CoachFailedRule[]
  nextAction: string
  aiExplanation: CoachAiExplanation
}

const HTF_ALIGNMENT_GATE = 70
const ENTRY_TIMING_GATE = 70
const EMA_ALIGNMENT_GATE = 65

export function mapFinalVerdictToPrimaryAction(
  verdict: CoachFinalVerdict,
): CoachPrimaryAction {
  if (verdict === "A_PLUS_READY") return "TAKE"
  if (verdict === "WAIT_FOR_CONFIRMATION" || verdict === "COACH_WARNING") return "WAIT"
  return "SKIP"
}

function capitalizeBias(bias: MtfBiasDirection | string): string {
  const text = String(bias)
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function gateRuleById(verdict: CoachExecutionVerdict, id: EntryGateRuleId) {
  return verdict.entryGate.rules.find((rule) => rule.id === id)
}

function plainExplanation(text: string): string {
  return text
    .replace(/=\s*❌/g, "failed")
    .replace(/✅/g, "")
    .replace(/❌/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function isLongDirection(direction: string | undefined): boolean {
  const normalized = direction?.toUpperCase() ?? ""
  return normalized === "LONG" || normalized === "BUY"
}

function isShortDirection(direction: string | undefined): boolean {
  const normalized = direction?.toUpperCase() ?? ""
  return normalized === "SHORT" || normalized === "SELL"
}

function trendAlignedWithPlan(input: {
  bias: MtfBiasDirection | string | undefined
  direction?: string
}): boolean {
  const bias = String(input.bias ?? "mixed").toLowerCase()
  if (bias === "mixed" || bias === "neutral") return false
  if (isLongDirection(input.direction)) return bias === "bullish"
  if (isShortDirection(input.direction)) return bias === "bearish"
  return bias !== "mixed" && bias !== "neutral"
}

function buildDeepAnalysisFallback(input: {
  verdict: CoachExecutionVerdict
  mtf: MtfAnalysisResult | null
  context?: PreTradePlannedContext | null
}): VyronisCoachDeepAnalysis {
  const { verdict, mtf, context } = input
  const visual = context?.visual_analysis?.aggregate ?? mtf?.visualAnalysis?.aggregate
  const chart = context?.chart_analysis
  const rrRule = gateRuleById(verdict, "risk_reward")

  return {
    trend_direction: mtf?.bias.overallBias ?? visual?.overallBias ?? "Not assessed",
    htf_ema_alignment: mtf
      ? `Bias alignment ${mtf.bias.biasAlignmentScore}/100 (W ${mtf.bias.weeklyBias}, D ${mtf.bias.dailyBias}, H4 ${mtf.bias.h4Bias}).`
      : chart?.trendAlignment
        ? `Trend alignment ${chart.trendAlignment}/100.`
        : "Upload W/D/H4 charts for HTF read.",
    confirmation_quality: visual?.confirmationQuality
      ? `${visual.confirmationQuality}/100 — BOS ${visual.bosDetected ? "yes" : "no"}, CHoCH ${visual.chochDetected ? "yes" : "no"}.`
      : mtf
        ? `Entry confirmation ${mtf.entry.entryConfirmationScore}/100.`
        : "Confirmation not scored yet.",
    risk_reward_structure: plainExplanation(rrRule?.note ?? "Define stop and target."),
    breakout_vs_retest: visual?.liquiditySweepDetected
      ? "Liquidity sweep detected — verify retest before entry."
      : "Treat as structure retest until BOS is confirmed on close.",
    volatility: chart?.overextendedEntry || visual?.countertrend
      ? "Elevated — extension or counter-trend risk flagged."
      : "Normal — no extension flag on this read.",
    overextended_entry: Boolean(chart?.overextendedEntry ?? visual?.countertrend),
    counter_trend_risk: chart?.countertrend || visual?.countertrend ? "HIGH" : "LOW",
  }
}

function buildDecisionFactors(input: {
  verdict: CoachExecutionVerdict
  mtf: MtfAnalysisResult | null
  context?: PreTradePlannedContext | null
  deep: VyronisCoachDeepAnalysis
}): CoachDecisionFactor[] {
  const { verdict, mtf, context, deep } = input
  const visual = context?.visual_analysis?.aggregate ?? mtf?.visualAnalysis?.aggregate
  const htfRule = gateRuleById(verdict, "htf_bias")
  const aoiRule = gateRuleById(verdict, "aoi_valid")
  const confirmationRule = gateRuleById(verdict, "confirmation_present")
  const emaRule = gateRuleById(verdict, "ema_rule")

  const htfScore = mtf?.bias.biasAlignmentScore ?? visual?.biasAlignmentScore ?? 0
  const entryScore = mtf?.entry.entryConfirmationScore ?? visual?.entryConfirmationScore ?? 0
  const m15Score = mtf?.entry.m15EntryQuality ?? visual?.m15EntryQuality ?? 0
  const emaScore = visual?.emaAlignmentScore ?? 0

  const htfPassed = Boolean(htfRule?.passed) && htfScore >= HTF_ALIGNMENT_GATE
  const aoiPassed = Boolean(aoiRule?.passed)
  const entryTimingPassed =
    Boolean(confirmationRule?.passed) &&
    entryScore >= ENTRY_TIMING_GATE &&
    m15Score >= 55 &&
    !deep.overextended_entry
  const ltfConfirmsHtf =
    entryScore >= ENTRY_TIMING_GATE &&
    htfScore >= HTF_ALIGNMENT_GATE &&
    trendAlignedWithPlan({
      bias: mtf?.bias.overallBias ?? deep.trend_direction,
      direction: context?.direction,
    })
  const trendPassed = trendAlignedWithPlan({
    bias: deep.trend_direction,
    direction: context?.direction,
  })
  const emaPassed = Boolean(emaRule?.passed) || emaScore >= EMA_ALIGNMENT_GATE
  const confirmationPassed = Boolean(confirmationRule?.passed)

  return [
    {
      id: "htf_alignment",
      label: "HTF Alignment",
      value: deep.htf_ema_alignment,
      passed: htfPassed,
    },
    {
      id: "aoi_quality",
      label: "AOI Quality",
      value: plainExplanation(aoiRule?.note ?? "No AOI zone defined."),
      passed: aoiPassed,
    },
    {
      id: "entry_timing",
      label: "Entry Timing",
      value: `${deep.breakout_vs_retest} ${deep.volatility}`,
      passed: entryTimingPassed,
    },
    {
      id: "ltf_confirms_htf",
      label: "LTF confirms HTF",
      value: mtf
        ? `H1 ${mtf.entry.h1SetupQuality}/100 · M15 ${mtf.entry.m15EntryQuality}/100 · confirm ${entryScore}/100.`
        : "Upload H1 and M15 charts for LTF confirmation read.",
      passed: ltfConfirmsHtf,
    },
    {
      id: "trend_direction",
      label: "Trend Direction",
      value: `${capitalizeBias(deep.trend_direction)} · counter-trend risk ${deep.counter_trend_risk}.`,
      passed: trendPassed,
    },
    {
      id: "ema_alignment",
      label: "EMA Alignment",
      value: plainExplanation(
        emaRule?.note ??
          (emaScore > 0 ? `EMA alignment ${emaScore}/100.` : "EMA stack not scored yet."),
      ),
      passed: emaPassed,
    },
    {
      id: "confirmation_quality",
      label: "Confirmation Quality",
      value: deep.confirmation_quality,
      passed: confirmationPassed,
    },
  ]
}

function buildFailedRules(input: {
  verdict: CoachExecutionVerdict
  primaryAction: CoachPrimaryAction
}): CoachFailedRule[] {
  const seen = new Set<string>()
  const failed: CoachFailedRule[] = []

  const push = (label: string, explanation: string) => {
    const key = `${label}:${explanation}`
    if (seen.has(key)) return
    seen.add(key)
    failed.push({ label, explanation: plainExplanation(explanation) })
  }

  for (const rule of input.verdict.entryGate.failedRules) {
    push(rule.label, rule.note)
  }

  if (input.primaryAction !== "TAKE") {
    for (const blocker of input.verdict.entryReadiness.blockers) {
      const explanation = plainExplanation(blocker)
      if (!failed.some((item) => item.explanation === explanation)) {
        push("Coach", explanation)
      }
    }
  }

  return failed.slice(0, 6)
}

function buildNextAction(input: {
  primaryAction: CoachPrimaryAction
  failedRules: CoachFailedRule[]
  verdict: CoachExecutionVerdict
}): string {
  if (input.primaryAction === "TAKE") {
    return "Execute at plan size — all entry gate rules passed. Hold your stop."
  }
  if (input.failedRules[0]) {
    return input.failedRules[0].explanation
  }
  return plainExplanation(input.verdict.entryReadiness.summary)
}

function buildAiExplanation(vyronisCoach?: VyronisCoachResponse | null): CoachAiExplanation {
  if (!vyronisCoach) {
    return {
      summary: null,
      warnings: [],
      journalNote: null,
      oneImprovement: null,
    }
  }

  return {
    summary: vyronisCoach.summary?.trim() || null,
    warnings: vyronisCoach.warnings ?? [],
    journalNote: vyronisCoach.journal_cross_reference?.trim() || null,
    oneImprovement: vyronisCoach.one_improvement?.trim() || null,
  }
}

export function buildCoachDecisionView(input: {
  verdict: CoachExecutionVerdict
  mtf?: MtfAnalysisResult | null
  context?: PreTradePlannedContext | null
  vyronisCoach?: VyronisCoachResponse | null
}): CoachDecisionView {
  const mtf =
    input.mtf ??
    input.context?.mtf_analysis ??
    input.context?.chart_analysis?.mtf ??
    null

  const deep =
    input.vyronisCoach?.deep_analysis ??
    buildDeepAnalysisFallback({
      verdict: input.verdict,
      mtf,
      context: input.context,
    })

  const primaryAction = mapFinalVerdictToPrimaryAction(input.verdict.finalVerdict)
  const decisionFactors = buildDecisionFactors({
    verdict: input.verdict,
    mtf,
    context: input.context,
    deep,
  })
  const failedRules = buildFailedRules({
    verdict: input.verdict,
    primaryAction,
  })
  const nextAction = buildNextAction({
    primaryAction,
    failedRules,
    verdict: input.verdict,
  })

  return {
    primaryAction,
    setupGrade: input.verdict.setupQuality.grade,
    setupScore: input.verdict.setupQuality.score,
    decisionFactors,
    failedRules,
    nextAction,
    aiExplanation: buildAiExplanation(input.vyronisCoach),
  }
}
