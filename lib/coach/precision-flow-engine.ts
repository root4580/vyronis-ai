import type { MtfAnalysisResult } from "@/lib/coach/mtf-types"
import { calculateStateScore } from "@/lib/coach/state-score-engine"
import { calculateRiskReward } from "@/lib/trade-form-utils"
import { DAILY_LOSS_NOTIFY_RATIO } from "@/lib/alerts/evaluate-alerts"
import { getRecentLossStreak, type TradeRiskGuardHistoryTrade } from "@/lib/trade-risk-guard"
import { buildRiskSnapshot } from "@/lib/user-settings"
import type { UserSettingsForm } from "@/lib/user-settings"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"

export type PrecisionFlowRuleId =
  | "htf_bias"
  | "aoi"
  | "confirmation"
  | "entry_quality"
  | "emotion_gate"
  | "risk_reward"
  | "session"

export type PrecisionFlowRuleResult = {
  id: PrecisionFlowRuleId
  label: string
  passed: boolean
  note: string
}

export type VyronisCoachVerdict = "EXECUTE" | "CAUTION" | "SKIP"

export type PrecisionFlowResult = {
  verdict: VyronisCoachVerdict
  rulesPassed: number
  rules: PrecisionFlowRuleResult[]
  setupScore: number
  stateScore: number
  riskLevel: "LOW" | "MEDIUM" | "HIGH"
  confidence: number
  consecutiveLosses: number
  dailyLossRatio: number
  chartUnclear: boolean
}

const BLOCKED_EMOTIONS = new Set(["revenge", "fearful", "impulsive", "fomo", "anxious", "euphoric", "greed"])
const EXECUTE_EMOTIONS = new Set(["calm", "confident", "disciplined"])
const VALID_SESSIONS = new Set(["london", "new york", "newyork", "ny"])

function normalizeEmotion(value: string | undefined): string {
  return (value || "").trim().toLowerCase()
}

function evaluateHtfBias(context: PreTradePlannedContext, mtf: MtfAnalysisResult | null): PrecisionFlowRuleResult {
  if (mtf) {
    const aligned = mtf.bias.biasAlignmentScore >= 70 && mtf.bias.overallBias !== "mixed"
    return {
      id: "htf_bias",
      label: "HTF Bias",
      passed: aligned,
      note: aligned
        ? `W/D/H4 aligned (${mtf.bias.overallBias}, ${mtf.bias.biasAlignmentScore}/100).`
        : `HTF misaligned or mixed — score ${mtf.bias.biasAlignmentScore}/100.`,
    }
  }

  const hasHtfFields = Boolean(
    context.higher_timeframe?.trim() || context.entry_timeframe?.trim() || context.confirmation_timeframe?.trim(),
  )
  return {
    id: "htf_bias",
    label: "HTF Bias",
    passed: hasHtfFields,
    note: hasHtfFields
      ? "Timeframes noted — run MTF analysis for alignment proof."
      : "Weekly/Daily/H4 bias not documented.",
  }
}

function evaluateAoi(context: PreTradePlannedContext): PrecisionFlowRuleResult {
  const hasPrices =
    Boolean(context.stop_loss?.trim()) &&
    Boolean(context.take_profit?.trim()) &&
    Boolean(context.entry_price?.trim())
  const visual = context.visual_analysis?.aggregate
  const zoneHint =
    hasPrices || visual?.supplyDemandPresent || (visual?.rrQuality ?? 0) > 0

  return {
    id: "aoi",
    label: "AOI",
    passed: zoneHint,
    note: zoneHint
      ? "Entry, stop, and target zone are defined."
      : "No clear AOI — define stop and target at a valid zone.",
  }
}

function evaluateConfirmation(context: PreTradePlannedContext, mtf: MtfAnalysisResult | null): PrecisionFlowRuleResult {
  const signal = context.confirmation_signal?.trim()
  const entryScore = mtf?.entry.entryConfirmationScore ?? context.entry_confirmation_score ?? 0
  const passed = Boolean(signal) || entryScore >= 60

  return {
    id: "confirmation",
    label: "Confirmation",
    passed,
    note: passed
      ? signal
        ? `Confirmation signal logged: ${signal}.`
        : `Entry confirmation score ${entryScore}/100.`
      : "No CHoCH, BOS, or retest confirmation logged.",
  }
}

function evaluateEntryQuality(context: PreTradePlannedContext, mtf: MtfAnalysisResult | null): PrecisionFlowRuleResult {
  const chart = context.chart_analysis
  const overextended = chart?.overextendedEntry ?? chart?.vision?.metrics.overextendedMove ?? false
  const entryScore = mtf?.entry.m15EntryQuality ?? mtf?.entry.entryConfirmationScore ?? chart?.executionQuality ?? 0
  const passed = !overextended && entryScore >= 55

  return {
    id: "entry_quality",
    label: "Entry quality",
    passed,
    note: overextended
      ? "Entry reads extended — A+ requires Perfect timing."
      : passed
        ? `Entry quality ${entryScore}/100 — not flagged as late/chase.`
        : `Entry quality ${entryScore}/100 — below Perfect gate.`,
  }
}

function evaluateEmotionGate(responses: Record<string, string>): PrecisionFlowRuleResult {
  const emotion = normalizeEmotion(responses.emotional_state || responses.emotion)
  const blocked = BLOCKED_EMOTIONS.has(emotion)
  const passed = EXECUTE_EMOTIONS.has(emotion) && !blocked

  return {
    id: "emotion_gate",
    label: "Emotion gate",
    passed,
    note: blocked
      ? `${responses.emotional_state || "State"} blocks execution.`
      : passed
        ? `${responses.emotional_state || "Calm"} — state is tradeable.`
        : "Emotional state is borderline — size down or pause.",
  }
}

function evaluateRiskReward(context: PreTradePlannedContext): PrecisionFlowRuleResult {
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
    label: "Risk-reward",
    passed,
    note:
      numeric != null
        ? `R:R ${numeric.toFixed(1)}:1${numeric >= 3 ? " (A+ gate met)" : numeric >= 2 ? "" : " — below 1:2 minimum"}.`
        : "R:R not calculable — set entry, stop, and target.",
  }
}

function evaluateSession(context: PreTradePlannedContext): PrecisionFlowRuleResult {
  const session = (context.session || "").trim().toLowerCase()
  const passed =
    Boolean(session) &&
    (VALID_SESSIONS.has(session) || session.includes("london") || session.includes("new york"))

  return {
    id: "session",
    label: "Session",
    passed: passed || !session,
    note: passed
      ? `${context.session} — inside preferred liquidity window.`
      : session
        ? `${context.session} — thesis must justify trading outside London/NY.`
        : "Session not set — log London or New York before entry.",
  }
}

function canIssueExecuteVerdict(stateScore: number, setupScore: number): boolean {
  if (stateScore < 20) return false
  if (stateScore < 40 && setupScore <= 85) return false
  return true
}

function deriveVerdict(input: {
  rulesPassed: number
  emotion: string
  consecutiveLosses: number
  dailyLossRatio: number
  chartUnclear: boolean
  stateScore: number
  setupScore: number
}): VyronisCoachVerdict {
  const emotion = normalizeEmotion(input.emotion)

  if (input.chartUnclear) return "CAUTION"
  if (BLOCKED_EMOTIONS.has(emotion) || input.consecutiveLosses >= 5 || input.rulesPassed < 4) {
    return "SKIP"
  }
  if (input.dailyLossRatio >= DAILY_LOSS_NOTIFY_RATIO) return "SKIP"

  const strictExecute =
    input.rulesPassed >= 6 &&
    EXECUTE_EMOTIONS.has(emotion) &&
    input.consecutiveLosses <= 3

  const highConfidenceExecute =
    input.stateScore > 70 &&
    input.setupScore > 70 &&
    input.rulesPassed >= 5 &&
    EXECUTE_EMOTIONS.has(emotion) &&
    input.consecutiveLosses <= 3

  if ((strictExecute || highConfidenceExecute) && canIssueExecuteVerdict(input.stateScore, input.setupScore)) {
    return "EXECUTE"
  }

  if (input.rulesPassed >= 4 || input.consecutiveLosses >= 3) return "CAUTION"

  return "SKIP"
}

export function mapVerdictToShouldTakeTrade(
  verdict: VyronisCoachVerdict,
): "yes" | "caution" | "no" {
  if (verdict === "EXECUTE") return "yes"
  if (verdict === "CAUTION") return "caution"
  return "no"
}

export function evaluatePrecisionFlow(input: {
  context: PreTradePlannedContext
  responses: Record<string, string>
  historicalTrades?: TradeRiskGuardHistoryTrade[]
  settings?: UserSettingsForm
  startingBalance?: number
}): PrecisionFlowResult {
  const mtf = input.context.mtf_analysis ?? input.context.chart_analysis?.mtf ?? null
  const chartUnclear =
    Boolean(mtf && mtf.chartsProvided < 3) ||
    Boolean(mtf && mtf.overallScore < 40 && mtf.chartsProvided > 0)

  const rules = [
    evaluateHtfBias(input.context, mtf),
    evaluateAoi(input.context),
    evaluateConfirmation(input.context, mtf),
    evaluateEntryQuality(input.context, mtf),
    evaluateEmotionGate(input.responses),
    evaluateRiskReward(input.context),
    evaluateSession(input.context),
  ]

  const rulesPassed = rules.filter((rule) => rule.passed).length
  const consecutiveLosses = getRecentLossStreak(input.historicalTrades ?? [])

  let dailyLossRatio = 0
  if (input.settings && input.historicalTrades) {
    const snapshot = buildRiskSnapshot(
      input.settings,
      input.historicalTrades,
      input.startingBalance ?? input.settings.starting_balance ?? 100000,
    )
    dailyLossRatio =
      snapshot.dailyLossLimit > 0 ? snapshot.todayLossPercent / snapshot.dailyLossLimit : 0
  }

  const setupScore = Math.round((rulesPassed / 7) * 100)
  const stateScore = calculateStateScore({
    trades: input.historicalTrades ?? [],
    consecutiveLosses,
    dailyLossRatio,
    currentEmotion: input.responses.emotional_state || input.responses.emotion || "",
    maxRiskPerTrade: input.settings?.max_risk_per_trade ?? 1,
  })

  const verdict = deriveVerdict({
    rulesPassed,
    emotion: input.responses.emotional_state || "",
    consecutiveLosses,
    dailyLossRatio,
    chartUnclear,
    stateScore,
    setupScore,
  })

  const riskLevel: PrecisionFlowResult["riskLevel"] =
    verdict === "SKIP" || consecutiveLosses >= 4 || dailyLossRatio >= 0.8
      ? "HIGH"
      : verdict === "CAUTION"
        ? "MEDIUM"
        : "LOW"

  const confidence = Math.round(
    setupScore * 0.55 + stateScore * 0.25 + (verdict === "EXECUTE" ? 20 : verdict === "CAUTION" ? 10 : 0),
  )

  return {
    verdict,
    rulesPassed,
    rules,
    setupScore,
    stateScore,
    riskLevel,
    confidence: Math.min(100, Math.max(0, confidence)),
    consecutiveLosses,
    dailyLossRatio,
    chartUnclear,
  }
}
