import type { MtfAnalysisResult } from "@/lib/coach/mtf-types"
import {
  evaluateSessionGate,
  logSessionGateDebug,
  type SessionGateDebug,
} from "@/lib/coach/session-gate"
import { calculateRiskReward } from "@/lib/trade-form-utils"
import type { StrategyPlaybookMatchResult } from "@/lib/strategy/types"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"

export type EntryGateRuleId =
  | "htf_bias"
  | "aoi_valid"
  | "session_valid"
  | "confirmation_present"
  | "risk_reward"
  | "ema_rule"

export type EntryGateRule = {
  id: EntryGateRuleId
  label: string
  passed: boolean
  required: boolean
  note: string
}

export type EntryGateResult = {
  rules: EntryGateRule[]
  rulesPassed: number
  rulesTotal: number
  entryStatus: "WAIT" | "READY"
  blockMessage: string | null
  progressLabel: string
  failedRules: EntryGateRule[]
  sessionDebug: SessionGateDebug | null
}
const ENTRY_CONFIRMATION_GATE = 70
const EMA_ALIGNMENT_GATE = 65
const HTF_BIAS_GATE = 70

function evaluateHtfBias(
  context: PreTradePlannedContext,
  mtf: MtfAnalysisResult | null,
  playbook: StrategyPlaybookMatchResult | null,
): EntryGateRule {
  const detections = playbook?.detections
  if (detections?.htfConflict || detections?.countertrend) {
    return {
      id: "htf_bias",
      label: "HTF Bias",
      passed: false,
      required: true,
      note: "HTF conflict or counter-trend read flagged.",
    }
  }

  if (mtf) {
    const passed =
      mtf.bias.biasAlignmentScore >= HTF_BIAS_GATE && mtf.bias.overallBias !== "mixed"
    return {
      id: "htf_bias",
      label: "HTF Bias",
      passed,
      required: true,
      note: passed
        ? `W/D/H4 aligned (${mtf.bias.overallBias}, ${mtf.bias.biasAlignmentScore}/100).`
        : `HTF misaligned or mixed — ${mtf.bias.biasAlignmentScore}/100.`,
    }
  }

  const hasHtfFields = Boolean(
    context.higher_timeframe?.trim() ||
      context.entry_timeframe?.trim() ||
      context.confirmation_timeframe?.trim(),
  )

  return {
    id: "htf_bias",
    label: "HTF Bias",
    passed: hasHtfFields,
    required: true,
    note: hasHtfFields
      ? "Bias fields noted — run MTF analysis for proof."
      : "Weekly/Daily/H4 bias not documented.",
  }
}

function evaluateAoiValid(
  context: PreTradePlannedContext,
  playbook: StrategyPlaybookMatchResult | null,
): EntryGateRule {
  const hasPrices =
    Boolean(context.stop_loss?.trim()) &&
    Boolean(context.take_profit?.trim()) &&
    Boolean(context.entry_price?.trim())
  const visual = context.visual_analysis?.aggregate
  const aoiFromPlaybook = playbook?.rulesPassed.some((rule) =>
    /aoi|supply|demand|zone/i.test(rule),
  )
  const passed =
    hasPrices || Boolean(visual?.supplyDemandPresent) || Boolean(aoiFromPlaybook)

  return {
    id: "aoi_valid",
    label: "AOI Valid",
    passed,
    required: true,
    note: passed
      ? "Entry, stop, and target sit at a defined zone."
      : "No valid AOI — define stop and target at supply/demand.",
  }
}

function evaluateSessionValid(
  context: PreTradePlannedContext,
  now?: Date,
): { rule: EntryGateRule; debug: SessionGateDebug } {
  const gate = evaluateSessionGate({
    loggedSession: context.session ?? null,
    now,
  })
  logSessionGateDebug(gate.debug)

  return {
    rule: {
      id: "session_valid",
      label: "Session Valid",
      passed: gate.passed,
      required: true,
      note: gate.note,
    },
    debug: gate.debug,
  }
}

function evaluateConfirmationPresent(
  context: PreTradePlannedContext,
  mtf: MtfAnalysisResult | null,
  playbook: StrategyPlaybookMatchResult | null,
): EntryGateRule {
  const signal = context.confirmation_signal?.trim()
  const entryScore =
    mtf?.entry.entryConfirmationScore ?? context.entry_confirmation_score ?? 0
  const detections = playbook?.detections
  const missingM15 = playbook?.missingConfirmations.some((item) =>
    /m15|confirmation candle/i.test(item),
  )

  if (detections?.beforeConfirmationClose || missingM15) {
    return {
      id: "confirmation_present",
      label: "Confirmation Present",
      passed: false,
      required: true,
      note: "M15 confirmation candle has not closed yet.",
    }
  }

  const visual = context.visual_analysis?.aggregate
  const structureConfirm =
    Boolean(visual?.bosDetected) ||
    Boolean(visual?.chochDetected) ||
    (visual?.confirmationQuality ?? 0) >= ENTRY_CONFIRMATION_GATE

  const passed =
    Boolean(signal) || entryScore >= ENTRY_CONFIRMATION_GATE || structureConfirm

  return {
    id: "confirmation_present",
    label: "Confirmation Present",
    passed,
    required: true,
    note: passed
      ? signal
        ? `Logged: ${signal}.`
        : entryScore >= ENTRY_CONFIRMATION_GATE
          ? `Entry confirmation ${entryScore}/100.`
          : "BOS/CHoCH or confirmation quality met."
      : "No CHoCH, BOS, engulfing, or break & retest confirmation.",
  }
}

function evaluateRiskReward(context: PreTradePlannedContext): EntryGateRule {
  const rr =
    calculateRiskReward({
      direction: context.direction === "SHORT" ? "SELL" : "BUY",
      entry_price: context.entry_price || "",
      stop_loss: context.stop_loss || "",
      take_profit: context.take_profit || "",
    }) ?? context.chart_analysis?.rrQuality ?? null

  const numeric = typeof rr === "number" ? rr : null
  const passed = numeric != null && numeric >= 2

  return {
    id: "risk_reward",
    label: "RR >= 1:2",
    passed,
    required: true,
    note:
      numeric != null
        ? `R:R ${numeric.toFixed(1)}:1${passed ? "" : " — below 1:2 minimum"}.`
        : "Set entry, stop, and target to calculate R:R.",
  }
}

function evaluateEmaRule(
  context: PreTradePlannedContext,
  mtf: MtfAnalysisResult | null,
  playbook: StrategyPlaybookMatchResult | null,
): EntryGateRule {
  const visual = context.visual_analysis?.aggregate ?? mtf?.visualAnalysis?.aggregate
  const emaScore = visual?.emaAlignmentScore ?? 0
  const emaFromPlaybook = playbook?.rulesPassed.some((rule) => /ema/i.test(rule))
  const signals = playbook?.visionContext?.signals as { emaAligned?: boolean } | undefined
  const emaFromSignals = Boolean(signals?.emaAligned)
  const passed = emaScore >= EMA_ALIGNMENT_GATE || emaFromPlaybook || emaFromSignals

  return {
    id: "ema_rule",
    label: "EMA Rule Passed",
    passed,
    required: true,
    note: passed
      ? emaScore >= EMA_ALIGNMENT_GATE
        ? `EMA alignment ${emaScore}/100.`
        : "EMA rule satisfied on playbook read."
      : `EMA alignment ${emaScore}/100 — below ${EMA_ALIGNMENT_GATE} gate.`,
  }
}

function buildBlockMessage(failedRules: EntryGateRule[]): string | null {
  const first = failedRules[0]
  if (!first) return null
  return `Entry blocked because ${first.label} = ❌`
}

function buildProgressLabel(rulesPassed: number, rulesTotal: number): string {
  if (rulesPassed === rulesTotal) {
    return `${rulesPassed}/${rulesTotal} Rules Passed → A+ READY`
  }
  return `${rulesPassed}/${rulesTotal} Rules Passed`
}

export function evaluateEntryGate(input: {
  context?: PreTradePlannedContext | null
  playbook?: StrategyPlaybookMatchResult | null
  mtf?: MtfAnalysisResult | null
  now?: Date
}): EntryGateResult {
  const context = input.context ?? ({} as PreTradePlannedContext)
  const mtf =
    input.mtf ?? context.mtf_analysis ?? context.chart_analysis?.mtf ?? null
  const playbook =
    input.playbook ?? context.playbook_match ?? mtf?.playbookMatch ?? null

  const sessionEval = evaluateSessionValid(context, input.now)
  const rules: EntryGateRule[] = [
    evaluateHtfBias(context, mtf, playbook),
    evaluateAoiValid(context, playbook),
    sessionEval.rule,
    evaluateConfirmationPresent(context, mtf, playbook),
    evaluateRiskReward(context),
    evaluateEmaRule(context, mtf, playbook),
  ]

  const rulesPassed = rules.filter((rule) => rule.passed).length
  const rulesTotal = rules.length
  const failedRules = rules.filter((rule) => rule.required && !rule.passed)
  const allPassed = failedRules.length === 0

  return {
    rules,
    rulesPassed,
    rulesTotal,
    entryStatus: allPassed ? "READY" : "WAIT",
    blockMessage: buildBlockMessage(failedRules),
    progressLabel: buildProgressLabel(rulesPassed, rulesTotal),
    failedRules,
    sessionDebug: sessionEval.debug,
  }
}
