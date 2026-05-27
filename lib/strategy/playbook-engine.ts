import { calculateRiskReward } from "@/lib/trade-form-utils"
import type { MtfAnalysisResult, MtfBiasDirection } from "@/lib/coach/mtf-types"
import type {
  EvaluateStrategyPlaybookInput,
  PlaybookRuleItem,
  StrategyPlaybookMatchResult,
} from "@/lib/strategy/types"
import type {
  TradeQualityGrade,
  TradeQualityRecommendation,
} from "@/lib/trade-coach/trade-quality-engine"

const IMPULSIVE_EMOTIONS = new Set(["FOMO", "Revenge", "Euphoric", "Anxious", "Fearful", "Greed"])

const AOI_KEYWORDS = ["aoi", "supply", "demand", "zone", "order block", "ob", "pd array"]
const BREAK_RETEST_KEYWORDS = ["break", "retest", "bos", "choch", "structure shift", "mss"]
const EMA_KEYWORDS = ["ema", "moving average", "ma stack", "20 ema", "50 ema", "200 ema"]
const LIQUIDITY_KEYWORDS = ["sweep", "liquidity", "ssl", "bsl", "equal highs", "equal lows"]
const CHASE_KEYWORDS = ["chase", "fomo", "extended", "overextended", "expansion", "impulse", "parabolic"]
const CONFIRMATION_KEYWORDS = ["close", "confirm", "engulf", "pin bar", "rejection", "trigger"]

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

function tradeBiasFromDirection(direction?: string): MtfBiasDirection {
  if (direction === "BUY") return "bullish"
  if (direction === "SELL") return "bearish"
  return "neutral"
}

function biasMatchesTrade(bias: MtfBiasDirection, direction?: string): boolean {
  const tradeBias = tradeBiasFromDirection(direction)
  if (tradeBias === "neutral" || bias === "neutral") return true
  if (bias === "mixed") return false
  return tradeBias === bias
}

function buildHaystack(context: EvaluateStrategyPlaybookInput["context"]): string {
  return [
    context.setup,
    context.confirmation_signal,
    context.higher_timeframe,
    context.entry_timeframe,
    context.confirmation_timeframe,
    context.emotion,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword))
}

function resolveActualRr(context: EvaluateStrategyPlaybookInput["context"]): number | null {
  return calculateRiskReward({
    direction: context.direction || "BUY",
    entry_price: context.entry_price || "",
    stop_loss: context.stop_loss || "",
    take_profit: context.take_profit || "",
  })
}

function gradeFromScore(score: number): TradeQualityGrade {
  if (score >= 85) return "A"
  if (score >= 70) return "B"
  if (score >= 55) return "C"
  if (score >= 40) return "D"
  return "F"
}

type StrategySignals = {
  weeklyAligned: boolean
  dailyAligned: boolean
  h4Aligned: boolean
  htfConflict: boolean
  h4DisagreesWithHtf: boolean
  h1Choppy: boolean
  countertrend: boolean
  htfAlignmentStrong: boolean
  aoiPresent: boolean
  breakRetest: boolean
  emaAligned: boolean
  liquiditySweep: boolean
  candleConfirmed: boolean
  h1SetupReady: boolean
  m15Confirmed: boolean
  h1FormationScore: number
  m15ExecutionScore: number
  earlyEntry: boolean
  beforeConfirmationClose: boolean
  noConfirmation: boolean
  noLiquidityConfirmation: boolean
  chasing: boolean
  overextended: boolean
  expansionEntry: boolean
  poorRr: boolean
  emotionalRisk: boolean
  fomoEntry: boolean
  revengeEntry: boolean
  requiredRuleFailures: string[]
}

function collectVisionText(
  visualAnalysis: EvaluateStrategyPlaybookInput["visualAnalysis"],
  mtfAnalysis: MtfAnalysisResult,
): string {
  const parts: string[] = [mtfAnalysis.summary]
  for (const tf of Object.values(visualAnalysis?.timeframes || {})) {
    if (!tf) continue
    parts.push(tf.summary, ...tf.warnings, ...tf.structureNotes)
  }
  parts.push(...(visualAnalysis?.aggregate.warnings || []))
  return parts.join(" ").toLowerCase()
}

function matchesCustomInvalidation(text: string, rule: string): boolean {
  const normalized = rule.toLowerCase()
  if (normalized.includes("m15") && normalized.includes("confirmation")) {
    return text.includes("before confirmation") || text.includes("no confirmation")
  }
  if (normalized.includes("expansion") || normalized.includes("impulse")) {
    return text.includes("expansion") || text.includes("impulse") || text.includes("displacement")
  }
  if (normalized.includes("h4") && normalized.includes("conflict")) {
    return text.includes("h4") && (text.includes("conflict") || text.includes("disagree"))
  }
  if (normalized.includes("h1") && (normalized.includes("messy") || normalized.includes("choppy"))) {
    return text.includes("choppy") || text.includes("messy") || text.includes("no clean setup")
  }
  if (normalized.includes("aoi") || normalized.includes("liquidity")) {
    return text.includes("no aoi") || text.includes("no liquidity") || text.includes("missing confluence")
  }
  if (normalized.includes("fomo")) {
    return text.includes("fomo") || text.includes("chase")
  }
  return false
}

function trackRequiredRule(
  rule: PlaybookRuleItem,
  ok: boolean,
  requiredFailures: string[],
): void {
  if (rule.enabled && rule.required && !ok) {
    requiredFailures.push(rule.label)
  }
}

function buildStrategySignals(input: EvaluateStrategyPlaybookInput): StrategySignals {
  const { mtfAnalysis, context, screenshots, visualAnalysis } = input
  const { bias, entry } = mtfAnalysis
  const text = buildHaystack(context)
  const emotion = (context.emotion || "").trim()
  const chartAnalysis = context.chart_analysis
  const visual = visualAnalysis?.aggregate
  const timeframes = visualAnalysis?.timeframes

  const weeklyAligned =
    Boolean(screenshots.weekly) &&
    (timeframes?.weekly
      ? biasMatchesTrade(timeframes.weekly.htfTrendBias, context.direction)
      : biasMatchesTrade(bias.weeklyBias, context.direction))
  const dailyAligned =
    Boolean(screenshots.daily) &&
    (timeframes?.daily
      ? biasMatchesTrade(timeframes.daily.htfTrendBias, context.direction)
      : biasMatchesTrade(bias.dailyBias, context.direction))
  const h4Aligned =
    Boolean(screenshots.h4) &&
    (timeframes?.h4
      ? biasMatchesTrade(timeframes.h4.htfTrendBias, context.direction)
      : biasMatchesTrade(bias.h4Bias, context.direction))

  const htfConflict =
    bias.overallBias === "mixed" ||
    visual?.countertrend === true ||
    (weeklyAligned === false &&
      dailyAligned === false &&
      Boolean(screenshots.weekly) &&
      Boolean(screenshots.daily)) ||
    (bias.weeklyBias !== "neutral" &&
      bias.dailyBias !== "neutral" &&
      bias.weeklyBias !== bias.dailyBias) ||
    (bias.dailyBias !== "neutral" &&
      bias.h4Bias !== "neutral" &&
      bias.dailyBias !== bias.h4Bias)

  const h4DisagreesWithHtf =
    Boolean(screenshots.h4) &&
    Boolean(screenshots.weekly || screenshots.daily) &&
    ((timeframes?.h4 &&
      timeframes.weekly &&
      timeframes.h4.htfTrendBias !== "neutral" &&
      timeframes.weekly.htfTrendBias !== "neutral" &&
      timeframes.h4.htfTrendBias !== timeframes.weekly.htfTrendBias) ||
      (timeframes?.h4 &&
        timeframes.daily &&
        timeframes.h4.htfTrendBias !== "neutral" &&
        timeframes.daily.htfTrendBias !== "neutral" &&
        timeframes.h4.htfTrendBias !== timeframes.daily.htfTrendBias) ||
      (bias.h4Bias !== "neutral" &&
        bias.weeklyBias !== "neutral" &&
        bias.h4Bias !== bias.weeklyBias) ||
      (bias.h4Bias !== "neutral" &&
        bias.dailyBias !== "neutral" &&
        bias.h4Bias !== bias.dailyBias))

  const h1Choppy =
    Boolean(screenshots.h1) &&
    ((timeframes?.h1 && timeframes.h1.entryQuality < 50) ||
      entry.h1SetupQuality < 50 ||
      entry.entryWarnings.some((warning) =>
        /choppy|messy|unclear|no clean/i.test(warning),
      ) ||
      Boolean(
        timeframes?.h1?.warnings.some((warning) =>
          /choppy|messy|unclear|no clean/i.test(warning),
        ),
      ))

  const countertrend =
    visual?.countertrend === true ||
    (bias.overallBias !== "neutral" &&
      bias.overallBias !== "mixed" &&
      !biasMatchesTrade(bias.overallBias, context.direction))

  const aoiPresent =
    visual?.supplyDemandPresent === true ||
    includesAny(text, AOI_KEYWORDS) ||
    Boolean(timeframes?.h1?.supplyDemandZones.length || timeframes?.m15?.supplyDemandZones.length)
  const breakRetest =
    visual?.bosDetected === true ||
    visual?.chochDetected === true ||
    includesAny(text, BREAK_RETEST_KEYWORDS) ||
    Boolean(timeframes?.h1?.bosDetected || timeframes?.m15?.bosDetected)
  const emaAligned =
    (visual?.emaAlignmentScore ?? 0) >= 65 ||
    includesAny(text, EMA_KEYWORDS) ||
    Object.values(timeframes || {}).some((tf) => tf?.emaAlignmentState === "aligned")
  const liquiditySweep =
    visual?.liquiditySweepDetected === true ||
    includesAny(text, LIQUIDITY_KEYWORDS) ||
    Boolean(timeframes?.h1?.liquiditySweepDetected || timeframes?.m15?.liquiditySweepDetected)
  const candleConfirmed =
    (visual?.confirmationQuality ?? 0) >= 60 ||
    Boolean(context.confirmation_signal?.trim()) ||
    includesAny(text, CONFIRMATION_KEYWORDS) ||
    entry.m15EntryQuality >= 68 ||
    Boolean(timeframes?.m15?.confirmationCandleDetected || timeframes?.h1?.confirmationCandleDetected)

  const h1SetupReady =
    Boolean(screenshots.h1) &&
    (timeframes?.h1 ? timeframes.h1.entryQuality >= 55 : entry.h1SetupQuality >= 55)
  const m15Confirmed =
    Boolean(screenshots.m15) &&
    (timeframes?.m15 ? timeframes.m15.entryQuality >= 55 : entry.m15EntryQuality >= 55)

  const earlyEntry =
    Boolean(screenshots.m15) &&
    (!screenshots.h1 || entry.h1SetupQuality < 50 || entry.m15EntryQuality > entry.h1SetupQuality + 15)

  const beforeConfirmationClose =
    Boolean(screenshots.m15) &&
    !Boolean(context.confirmation_signal?.trim()) &&
    !includesAny(text, CONFIRMATION_KEYWORDS) &&
    entry.m15EntryQuality < 60

  const noConfirmation =
    !candleConfirmed && (!screenshots.m15 || entry.m15EntryQuality < 50)

  const noLiquidityConfirmation =
    !liquiditySweep &&
    !entry.entryStrengths.some((strength) => strength.toLowerCase().includes("liquidity"))

  const chasing =
    includesAny(text, CHASE_KEYWORDS) ||
    entry.entryWarnings.some((warning) => includesAny(warning.toLowerCase(), CHASE_KEYWORDS))

  const overextended =
    Boolean(chartAnalysis?.overextendedEntry) ||
    (visual?.entryQuality !== undefined && visual.entryQuality < 45) ||
    includesAny(text, ["overextended", "extended move", "late entry"]) ||
    entry.entryWarnings.some((warning) => warning.toLowerCase().includes("extended")) ||
    Boolean(timeframes?.h1?.countertrendEntry || timeframes?.m15?.countertrendEntry)

  const expansionEntry =
    includesAny(text, ["expansion", "impulse", "displacement", "after move"]) ||
    (chasing && m15Confirmed)

  const actualRr = resolveActualRr(context)
  const poorRr = actualRr !== null && actualRr < input.playbook.rr_minimum

  const fomoEntry = emotion === "FOMO" || includesAny(text, ["fomo", "chase"])
  const revengeEntry = emotion === "Revenge" || includesAny(text, ["revenge"])
  const emotionalRisk = IMPULSIVE_EMOTIONS.has(emotion) || fomoEntry || revengeEntry

  return {
    weeklyAligned,
    dailyAligned,
    h4Aligned,
    htfConflict,
    h4DisagreesWithHtf,
    h1Choppy,
    countertrend,
    htfAlignmentStrong: bias.biasAlignmentScore >= 65 && bias.overallBias !== "mixed",
    aoiPresent,
    breakRetest,
    emaAligned,
    liquiditySweep,
    candleConfirmed,
    h1SetupReady,
    m15Confirmed,
    h1FormationScore: entry.h1SetupQuality,
    m15ExecutionScore: entry.m15EntryQuality,
    earlyEntry,
    beforeConfirmationClose,
    noConfirmation,
    noLiquidityConfirmation,
    chasing,
    overextended,
    expansionEntry,
    poorRr,
    emotionalRisk,
    fomoEntry,
    revengeEntry,
    requiredRuleFailures: [],
  }
}

function scoreSetupQuality(
  signals: StrategySignals,
  playbook: EvaluateStrategyPlaybookInput["playbook"],
  mtfAnalysis: MtfAnalysisResult,
): number {
  let score = 48
  const { bias, entry } = mtfAnalysis

  if (playbook.bias_rules.weekly_bias.enabled && signals.weeklyAligned) score += 8
  else if (playbook.bias_rules.weekly_bias.enabled && signals.htfConflict) score -= 6

  if (playbook.bias_rules.daily_bias.enabled && signals.dailyAligned) score += 8
  if (playbook.bias_rules.h4_structure.enabled && signals.h4Aligned) score += 8
  if (playbook.bias_rules.htf_alignment.enabled && signals.htfAlignmentStrong) score += 10
  else if (signals.htfConflict || signals.h4DisagreesWithHtf) score -= 14

  if (signals.h4DisagreesWithHtf) score -= 10
  if (signals.h1Choppy) score -= 12

  if (playbook.entry_rules.h1_setup.enabled && signals.h1SetupReady) score += 8
  if (playbook.entry_rules.aoi_supply_demand.enabled && signals.aoiPresent) score += 6
  if (playbook.entry_rules.break_and_retest.enabled && signals.breakRetest) score += 6
  if (playbook.entry_rules.ema_alignment.enabled && signals.emaAligned) score += 4
  if (playbook.entry_rules.liquidity_sweep.enabled && signals.liquiditySweep) score += 5

  score += Math.round((bias.biasAlignmentScore - 50) * 0.12)
  score += Math.round((entry.h1SetupQuality - 50) * 0.08)

  if (signals.countertrend) score -= 16
  if (signals.chasing) score -= 10
  if (signals.overextended) score -= 12

  return clamp(Math.round(score))
}

function scoreExecutionTiming(signals: StrategySignals, playbook: EvaluateStrategyPlaybookInput["playbook"]): number {
  let score = 50

  if (playbook.entry_rules.h1_setup.enabled) {
    if (signals.h1SetupReady) score += 14
    else if (!signals.h1SetupReady) score -= 8
  }

  if (playbook.entry_rules.m15_confirmation.enabled) {
    if (signals.m15Confirmed) score += 16
    else score -= 10
  }

  if (playbook.entry_rules.candle_confirmation.enabled && signals.candleConfirmed) score += 10
  else if (playbook.entry_rules.candle_confirmation.enabled && signals.beforeConfirmationClose) score -= 14

  if (signals.h1SetupReady && signals.m15Confirmed) score += 8
  if (signals.earlyEntry) score -= 18
  if (signals.beforeConfirmationClose) score -= 12
  if (signals.noConfirmation) score -= 10
  if (signals.h1Choppy) score -= 10

  score += Math.round((signals.m15ExecutionScore - signals.h1FormationScore) * 0.05)

  return clamp(Math.round(score))
}

function scoreRuleAdherence(input: {
  signals: StrategySignals
  playbook: EvaluateStrategyPlaybookInput["playbook"]
  context: EvaluateStrategyPlaybookInput["context"]
  rulesPassed: string[]
  rulesFailed: string[]
  requiredRuleFailures: string[]
}): number {
  const { signals, playbook, context, rulesPassed, rulesFailed, requiredRuleFailures } = input
  let enabled = 0
  let passed = 0

  function track(rule: PlaybookRuleItem, ok: boolean) {
    if (!rule.enabled) return
    enabled += 1
    trackRequiredRule(rule, ok, requiredRuleFailures)
    if (ok) {
      passed += 1
      rulesPassed.push(rule.label)
    } else {
      rulesFailed.push(rule.label)
    }
  }

  track(playbook.bias_rules.weekly_bias, signals.weeklyAligned)
  track(playbook.bias_rules.daily_bias, signals.dailyAligned)
  track(playbook.bias_rules.h4_structure, signals.h4Aligned)
  track(playbook.bias_rules.htf_alignment, signals.htfAlignmentStrong)
  track(playbook.entry_rules.h1_setup, signals.h1SetupReady)
  track(playbook.entry_rules.m15_confirmation, signals.m15Confirmed)
  track(playbook.entry_rules.aoi_supply_demand, signals.aoiPresent)
  track(playbook.entry_rules.break_and_retest, signals.breakRetest)
  track(playbook.entry_rules.ema_alignment, signals.emaAligned)
  track(playbook.entry_rules.liquidity_sweep, signals.liquiditySweep)
  track(playbook.entry_rules.candle_confirmation, signals.candleConfirmed)

  for (const item of playbook.confluence_rules.items) {
    if (!item.enabled) continue
    enabled += 1
    const ok =
      item.id === "htf_bias"
        ? signals.htfAlignmentStrong
        : item.id === "aoi_reaction"
          ? signals.aoiPresent
          : item.id === "ltf_trigger"
            ? signals.m15Confirmed
            : false
    if (ok) {
      passed += 1
      rulesPassed.push(item.label)
    } else {
      rulesFailed.push(item.label)
    }
  }

  let score = enabled > 0 ? Math.round((passed / enabled) * 100) : 55

  const actualRr = resolveActualRr(context)
  if (actualRr !== null) {
    if (!signals.poorRr) {
      rulesPassed.push(`R:R meets minimum (${actualRr.toFixed(1)}:1 ≥ ${playbook.rr_minimum}:1)`)
      score += 4
    } else {
      rulesFailed.push(`R:R below minimum (${actualRr.toFixed(1)}:1 < ${playbook.rr_minimum}:1)`)
      score -= 14
    }
  }

  return clamp(score)
}

function collectViolations(
  signals: StrategySignals,
  playbook: EvaluateStrategyPlaybookInput["playbook"],
  missingConfirmations: string[],
  rulesFailed: string[],
  visionText: string,
): string[] {
  const violations: string[] = []

  if (signals.htfConflict) {
    violations.push("HTF conflict — Weekly, Daily, or H4 structure disagree.")
    rulesFailed.push("HTF alignment conflict")
  }

  if (signals.h4DisagreesWithHtf) {
    violations.push("H4 structure conflicts with Weekly or Daily bias.")
    rulesFailed.push("H4 vs HTF conflict")
  }

  if (signals.h1Choppy) {
    violations.push("H1 setup is messy or choppy — no clean formation.")
    rulesFailed.push("H1 setup not clean")
  }

  if (playbook.invalidation_rules.countertrend_warning.enabled && signals.countertrend) {
    violations.push("Trading against HTF bias.")
    rulesFailed.push(playbook.invalidation_rules.countertrend_warning.label)
  }

  if (playbook.invalidation_rules.no_confirmation_warning.enabled && signals.noConfirmation) {
    violations.push("Missing M15 / confirmation candle before entry.")
    missingConfirmations.push("M15 confirmation candle")
    rulesFailed.push(playbook.invalidation_rules.no_confirmation_warning.label)
  }

  if (playbook.invalidation_rules.early_entry_warning.enabled && signals.earlyEntry) {
    violations.push("Early entry — M15 trigger before H1 setup is ready.")
    rulesFailed.push(playbook.invalidation_rules.early_entry_warning.label)
  }

  if (signals.beforeConfirmationClose) {
    violations.push("Entering before confirmation close on M15.")
    missingConfirmations.push("Confirmation candle close")
  }

  if (signals.noLiquidityConfirmation) {
    missingConfirmations.push("Liquidity sweep / confluence")
  }

  if (signals.chasing || signals.overextended || signals.expansionEntry) {
    violations.push("Chasing or entering after expansion move.")
  }

  if (signals.fomoEntry) {
    violations.push("Emotional FOMO entry pattern detected.")
  }

  if (signals.revengeEntry) {
    violations.push("Revenge / emotional re-entry pattern detected.")
  } else if (signals.emotionalRisk) {
    violations.push("Impulsive emotional state flagged before entry.")
  }

  if (signals.poorRr) {
    violations.push(`Poor R:R — below ${playbook.rr_minimum}:1 minimum.`)
  }

  for (const customRule of playbook.invalidation_rules.custom) {
    if (matchesCustomInvalidation(visionText, customRule)) {
      violations.push(customRule)
      rulesFailed.push(customRule)
    }
  }

  for (const condition of playbook.forbidden_conditions.items) {
    const normalized = condition.toLowerCase()
    const triggered =
      (normalized.includes("countertrend") && signals.countertrend) ||
      (normalized.includes("htf") && signals.countertrend) ||
      (normalized.includes("confirmation") && signals.noConfirmation) ||
      (normalized.includes("fomo") && signals.fomoEntry) ||
      (normalized.includes("emotional") && signals.emotionalRisk) ||
      (normalized.includes("revenge") && signals.revengeEntry) ||
      (normalized.includes("rr") && signals.poorRr) ||
      (normalized.includes("expansion") && signals.expansionEntry) ||
      (normalized.includes("liquidity") && signals.noLiquidityConfirmation) ||
      (normalized.includes("chasing") && signals.chasing) ||
      (normalized.includes("early") && signals.earlyEntry) ||
      (normalized.includes("h4") && signals.h4DisagreesWithHtf) ||
      (normalized.includes("h1") && signals.h1Choppy)
    if (triggered) violations.push(condition)
  }

  return [...new Set(violations)]
}

function deriveFinalRecommendation(input: {
  setupQualityScore: number
  ruleAdherenceScore: number
  executionTimingScore: number
  violations: string[]
  signals: StrategySignals
}): TradeQualityRecommendation {
  const composite = Math.round(
    input.setupQualityScore * 0.35 +
      input.ruleAdherenceScore * 0.35 +
      input.executionTimingScore * 0.3,
  )

  if (input.signals.requiredRuleFailures.length > 0) return "SKIP"

  const critical =
    input.signals.countertrend ||
    input.signals.revengeEntry ||
    input.signals.h4DisagreesWithHtf ||
    (input.signals.fomoEntry && input.signals.chasing) ||
    (input.signals.poorRr && input.signals.earlyEntry)

  if (critical || composite < 40 || input.violations.length >= 4) return "SKIP"
  if (
    composite >= 72 &&
    input.setupQualityScore >= 65 &&
    input.executionTimingScore >= 60 &&
    input.violations.length === 0
  ) {
    return "TAKE"
  }
  if (composite >= 55 && input.violations.length <= 2) return "CAUTION"
  return "SKIP"
}

export function evaluateStrategyPlaybook(
  input: EvaluateStrategyPlaybookInput,
): StrategyPlaybookMatchResult {
  const { playbook, mtfAnalysis, context, screenshots } = input
  const signals = buildStrategySignals(input)
  const visionText = `${buildHaystack(context)} ${collectVisionText(input.visualAnalysis, mtfAnalysis)}`

  const rulesPassed: string[] = []
  const rulesFailed: string[] = []
  const missingConfirmations: string[] = []
  const requiredRuleFailures: string[] = []
  signals.requiredRuleFailures = requiredRuleFailures

  if (!signals.candleConfirmed && playbook.entry_rules.candle_confirmation.enabled) {
    missingConfirmations.push("Confirmation candle on M15")
  }
  if (!signals.aoiPresent && playbook.entry_rules.aoi_supply_demand.enabled) {
    missingConfirmations.push("AOI / supply-demand zone context")
  }
  if (!screenshots.h1 && playbook.entry_rules.h1_setup.enabled) {
    missingConfirmations.push("H1 setup formation chart")
  }
  if (!screenshots.m15 && playbook.entry_rules.m15_confirmation.enabled) {
    missingConfirmations.push("M15 execution confirmation chart")
  }
  if (mtfAnalysis.chartsProvided < 3) {
    missingConfirmations.push("Full HTF stack (Weekly, Daily, H4)")
  }

  const violations = collectViolations(
    signals,
    playbook,
    missingConfirmations,
    rulesFailed,
    visionText,
  )

  const setupQualityScore = scoreSetupQuality(signals, playbook, mtfAnalysis)
  const executionTimingScore = scoreExecutionTiming(signals, playbook)
  const ruleAdherenceScore = scoreRuleAdherence({
    signals,
    playbook,
    context,
    rulesPassed,
    rulesFailed,
    requiredRuleFailures,
  })

  const penalizedAdherence = clamp(ruleAdherenceScore - violations.length * 5)

  const matchScore = clamp(
    Math.round(
      setupQualityScore * 0.35 + penalizedAdherence * 0.35 + executionTimingScore * 0.3,
    ),
  )
  const setupGrade = gradeFromScore(matchScore)
  const recommendation = deriveFinalRecommendation({
    setupQualityScore,
    ruleAdherenceScore: penalizedAdherence,
    executionTimingScore,
    violations,
    signals,
  })

  const summary =
    violations.length > 0
      ? `${playbook.strategy_name}: Setup ${setupQualityScore}/100 · Adherence ${penalizedAdherence}/100 · Timing ${executionTimingScore}/100 — ${violations.length} violation(s). ${recommendation}.`
      : `${playbook.strategy_name}: HTF-aligned read — Setup ${setupQualityScore}/100, Adherence ${penalizedAdherence}/100, Timing ${executionTimingScore}/100. Grade ${setupGrade}, ${recommendation}.`

  return {
    version: 2,
    playbookId: playbook.id,
    strategyName: playbook.strategy_name,
    matchScore,
    setupQualityScore,
    ruleAdherenceScore: penalizedAdherence,
    executionTimingScore,
    setupGrade,
    recommendation,
    rulesPassed: [...new Set(rulesPassed)],
    rulesFailed: [...new Set(rulesFailed)],
    missingConfirmations: [...new Set(missingConfirmations)],
    violations: [...new Set(violations)],
    summary,
    evaluatedAt: new Date().toISOString(),
    detections: {
      htfConflict: signals.htfConflict,
      countertrend: signals.countertrend,
      earlyEntry: signals.earlyEntry,
      emotionalRisk: signals.emotionalRisk,
      fomoEntry: signals.fomoEntry,
      revengeEntry: signals.revengeEntry,
      overextendedEntry: signals.overextended || signals.chasing,
      beforeConfirmationClose: signals.beforeConfirmationClose,
      noLiquidityConfirmation: signals.noLiquidityConfirmation,
    },
    visionContext: {
      strategyName: playbook.strategy_name,
      entryFlow: { h1: "setup formation", m15: "execution confirmation" },
      biasRules: playbook.bias_rules,
      entryRules: playbook.entry_rules,
      invalidationRules: playbook.invalidation_rules,
      confluenceRules: playbook.confluence_rules,
      forbiddenConditions: playbook.forbidden_conditions.items,
      rrMinimum: playbook.rr_minimum,
      exampleNotes: playbook.example_notes,
      mtfSummary: mtfAnalysis.summary,
      signals,
      scores: {
        setupQualityScore,
        ruleAdherenceScore: penalizedAdherence,
        executionTimingScore,
        matchScore,
      },
    },
  }
}

export function buildPlaybookMatchMessages(match: StrategyPlaybookMatchResult): string[] {
  const setup = match.setupQualityScore ?? match.matchScore
  const adherence = match.ruleAdherenceScore ?? match.matchScore
  const timing = match.executionTimingScore ?? match.matchScore

  return [
    match.summary,
    `Setup Quality ${setup}/100 · Rule Adherence ${adherence}/100 · Execution Timing ${timing}/100 · Grade ${match.setupGrade} · ${match.recommendation}`,
    match.rulesPassed.length > 0
      ? `Rules passed: ${match.rulesPassed.slice(0, 4).join("; ")}${match.rulesPassed.length > 4 ? "…" : ""}`
      : "Rules passed: none yet — add chart context or plan details.",
    match.missingConfirmations.length > 0
      ? `Missing confirmations: ${match.missingConfirmations.slice(0, 3).join("; ")}`
      : "",
    match.violations.length > 0 ? `Violations: ${match.violations.slice(0, 4).join("; ")}` : "",
    match.detections?.earlyEntry ? "Detection: possible early entry before H1 setup completed." : "",
    match.detections?.emotionalRisk ? "Detection: impulsive emotional state flagged." : "",
    match.detections?.overextendedEntry ? "Detection: overextended / chase-style entry risk." : "",
  ].filter(Boolean)
}
