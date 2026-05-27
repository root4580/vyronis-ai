import {
  buildChartAnnotationBundle,
  buildTimeframeChartUnderstanding,
} from "@/lib/chart-annotations/annotation-engine"
import type { ChartAnnotationBundle } from "@/lib/chart-annotations/types"
import { MTF_TIMEFRAME_IDS, type CoachMtfTimeframe } from "@/lib/coach/mtf-constants"
import { analyzeChartVision } from "@/lib/coach/chart-vision-engine"
import {
  analyzeTimeframeWithAiProvider,
  buildVisionFallbackWarnings,
  getProviderDisplayLabel,
  getVisionModelForEngine,
  isAiProviderConfigured,
  resolveActualVisionEngine,
  resolveRequestedVisionEngine,
} from "@/lib/ai/providers"
import {
  analyzeMultiTimeframeVision,
  mtfAnalysisToChartAnalysis,
} from "@/lib/coach/multi-timeframe-vision-engine"
import type {
  MtfAnalysisResult,
  MtfBiasAnalysis,
  MtfBiasDirection,
  MtfEntryAnalysis,
  MtfScreenshotMap,
} from "@/lib/coach/mtf-types"
import type { ChartVisionProviderId } from "@/lib/coach/types"
import type {
  TimeframeVisualAnalysis,
  VisualAnalysisAggregate,
  VisualAnalysisResult,
  VisualPlaybookComparison,
  VisualShouldTakeVerdict,
} from "@/lib/coach/visual-analysis-types"
import type { StrategyPlaybookRecord } from "@/lib/strategy/types"
import { evaluateStrategyPlaybook } from "@/lib/strategy/playbook-engine"
import type { ChartAnalysisResult, PreTradePlannedContext } from "@/lib/trade-coach/types"
import { calculateRiskReward } from "@/lib/trade-form-utils"
import type {
  TradeQualityGrade,
  TradeQualityRecommendation,
} from "@/lib/trade-coach/trade-quality-engine"

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

function average(values: number[]): number {
  if (values.length === 0) return 50
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function gradeFromScore(score: number): TradeQualityGrade {
  if (score >= 85) return "A"
  if (score >= 70) return "B"
  if (score >= 55) return "C"
  if (score >= 40) return "D"
  return "F"
}

function shouldTakeFromRecommendation(
  recommendation: TradeQualityRecommendation,
): VisualShouldTakeVerdict {
  if (recommendation === "TAKE") return "yes"
  if (recommendation === "CAUTION") return "caution"
  return "no"
}

function biasFromDirection(tradeDirection?: string): MtfBiasDirection {
  if (tradeDirection === "BUY") return "bullish"
  if (tradeDirection === "SELL") return "bearish"
  return "neutral"
}

function resolveOverallBias(biases: MtfBiasDirection[]): MtfBiasDirection {
  const scored = biases.filter((bias) => bias !== "neutral")
  if (scored.length === 0) return "neutral"

  const bullish = scored.filter((bias) => bias === "bullish").length
  const bearish = scored.filter((bias) => bias === "bearish").length

  if (bullish > 0 && bearish > 0) return "mixed"
  if (bullish >= 2) return "bullish"
  if (bearish >= 2) return "bearish"
  if (bullish === 1 && bearish === 0) return "bullish"
  if (bearish === 1 && bullish === 0) return "bearish"
  return "mixed"
}

function scoreBiasAlignmentFromVision(
  weekly: TimeframeVisualAnalysis | undefined,
  daily: TimeframeVisualAnalysis | undefined,
  h4: TimeframeVisualAnalysis | undefined,
  tradeDirection?: string,
): { score: number; warnings: string[]; overallBias: MtfBiasDirection } {
  const warnings: string[] = []
  const weeklyBias = weekly?.htfTrendBias ?? "neutral"
  const dailyBias = daily?.htfTrendBias ?? "neutral"
  const h4Bias = h4?.htfTrendBias ?? "neutral"
  const overallBias = resolveOverallBias([weeklyBias, dailyBias, h4Bias])

  let score = 52
  const provided = [weekly, daily, h4].filter(Boolean).length
  if (provided === 0) {
    warnings.push("No HTF bias charts analyzed — alignment score reduced.")
    return { score: 40, warnings, overallBias: "neutral" }
  }

  score += provided * 8

  const biases = [weeklyBias, dailyBias, h4Bias].filter((bias) => bias !== "neutral")
  const alignedCount = biases.filter((bias) => bias === overallBias).length
  score += alignedCount * 10

  if (overallBias === "mixed") {
    score -= 20
    warnings.push("Weekly, Daily, and H4 visual biases conflict.")
  }

  if (weekly && daily && weeklyBias !== "neutral" && dailyBias !== "neutral" && weeklyBias !== dailyBias) {
    score -= 12
    warnings.push("Weekly and Daily chart bias conflict.")
  }

  if (daily && h4 && dailyBias !== "neutral" && h4Bias !== "neutral" && dailyBias !== h4Bias) {
    score -= 10
    warnings.push("Daily and H4 structure conflict on chart.")
  }

  const tradeBias = biasFromDirection(tradeDirection)
  if (tradeBias !== "neutral" && overallBias !== "neutral" && tradeBias !== overallBias && overallBias !== "mixed") {
    score -= 16
    warnings.push("Planned direction conflicts with HTF chart bias.")
  } else if (tradeBias !== "neutral" && overallBias === tradeBias) {
    score += 10
  }

  for (const tf of [weekly, daily, h4]) {
    if (!tf) continue
    if (tf.countertrendEntry) {
      score -= 6
      warnings.push(`${tf.timeframe.toUpperCase()} chart shows countertrend entry risk.`)
    }
  }

  return { score: clamp(score), warnings: [...new Set(warnings)].slice(0, 6), overallBias }
}

function buildEntryAnalysisFromVision(
  h1: TimeframeVisualAnalysis | undefined,
  m15: TimeframeVisualAnalysis | undefined,
  overallBias: MtfBiasDirection,
  context: PreTradePlannedContext,
): MtfEntryAnalysis {
  const warnings: string[] = []
  const strengths: string[] = []

  const h1SetupQuality = h1?.entryQuality ?? (h1 ? 55 : 45)
  const m15EntryQuality = m15?.entryQuality ?? (m15 ? 55 : 45)

  if (!h1) warnings.push("H1 setup chart missing — entry timing confidence reduced.")
  else if (h1SetupQuality >= 75) strengths.push("H1 setup structure looks clean on chart.")
  else if (h1SetupQuality < 50) warnings.push("H1 setup quality is weak on chart.")

  if (!m15) warnings.push("M15 entry chart missing — confirmation confidence reduced.")
  else if (m15EntryQuality >= 75) strengths.push("M15 entry trigger aligns with chart structure.")
  else if (m15EntryQuality < 50) warnings.push("M15 does not strongly confirm the entry on chart.")

  if (h1?.liquiditySweepDetected || m15?.liquiditySweepDetected) {
    strengths.push("Liquidity sweep visible on chart.")
  }

  if (h1?.confirmationCandleDetected || m15?.confirmationCandleDetected) {
    strengths.push("Confirmation candle visible on chart.")
  }

  if (h1?.bosDetected || m15?.bosDetected) strengths.push("Break of structure detected.")
  if (h1?.chochDetected || m15?.chochDetected) {
    warnings.push("Change of character detected — trend may be shifting.")
  }

  const tradeBias = biasFromDirection(context.direction)
  if (
    tradeBias !== "neutral" &&
    overallBias !== "neutral" &&
    tradeBias !== overallBias &&
    overallBias !== "mixed"
  ) {
    warnings.push("Entry charts do not confirm HTF bias direction.")
  }

  if (h1SetupQuality >= 70 && m15EntryQuality < 55) {
    warnings.push("Entry may be too early — H1 looks better than M15 confirmation.")
  }
  if (m15EntryQuality >= 75 && h1SetupQuality < 55) {
    warnings.push("Entry may be late — M15 trigger without strong H1 structure.")
  }

  if (m15?.countertrendEntry || h1?.countertrendEntry) {
    warnings.push("Countertrend entry detected on chart.")
  }

  warnings.push(...(h1?.warnings.slice(0, 2) || []), ...(m15?.warnings.slice(0, 2) || []))
  strengths.push(...(h1?.strengths.slice(0, 2) || []), ...(m15?.strengths.slice(0, 2) || []))

  const entryConfirmationScore = clamp(Math.round(h1SetupQuality * 0.45 + m15EntryQuality * 0.55))

  return {
    h1SetupQuality,
    m15EntryQuality,
    entryConfirmationScore,
    entryWarnings: [...new Set(warnings)].slice(0, 8),
    entryStrengths: [...new Set(strengths)].slice(0, 6),
  }
}

function plannedRrScore(context: PreTradePlannedContext): number {
  const rr = calculateRiskReward({
    direction: context.direction || "BUY",
    entry_price: context.entry_price || "",
    stop_loss: context.stop_loss || "",
    take_profit: context.take_profit || "",
  })
  if (rr === null) return 52
  if (rr >= 2.5) return 92
  if (rr >= 2) return 84
  if (rr >= 1.5) return 72
  if (rr >= 1) return 58
  return 38
}

function deriveRecommendation(
  overallScore: number,
  bias: MtfBiasAnalysis,
  entry: MtfEntryAnalysis,
  countertrend: boolean,
): TradeQualityRecommendation {
  if (countertrend && entry.entryConfirmationScore < 55) return "SKIP"
  if (bias.overallBias === "mixed" && entry.entryConfirmationScore < 50) return "SKIP"
  if (overallScore >= 72 && bias.biasWarnings.length <= 2 && entry.entryWarnings.length <= 2) {
    return "TAKE"
  }
  if (overallScore >= 48) return "CAUTION"
  return "SKIP"
}

function buildAggregate(
  timeframes: Partial<Record<CoachMtfTimeframe, TimeframeVisualAnalysis>>,
  bias: MtfBiasAnalysis,
  entry: MtfEntryAnalysis,
  context: PreTradePlannedContext,
  chartsProvided: number,
  confidencePenalty: number,
  playbookComparison?: VisualPlaybookComparison | null,
  provider: ChartVisionProviderId = "heuristic",
): VisualAnalysisAggregate {
  const trendStrength = Math.round(
    average(
      Object.values(timeframes)
        .map((tf) => tf?.trendStrength)
        .filter((value): value is number => typeof value === "number"),
    ),
  )

  const emaAlignmentScore = Math.round(
    average(
      Object.values(timeframes)
        .map((tf) => tf?.emaAlignmentScore)
        .filter((value): value is number => typeof value === "number"),
    ) || 50,
  )

  const confirmationQuality = Math.round(
    average(
      [timeframes.h1?.confirmationCandleQuality, timeframes.m15?.confirmationCandleQuality].filter(
        (value): value is number => typeof value === "number",
      ),
    ) || 45,
  )

  const chartRr = Math.round(
    average(
      [timeframes.h1?.rrQuality, timeframes.m15?.rrQuality].filter(
        (value): value is number => typeof value === "number",
      ),
    ) || plannedRrScore(context),
  )

  const countertrend =
    Boolean(timeframes.h1?.countertrendEntry || timeframes.m15?.countertrendEntry) ||
    bias.overallBias === "mixed" ||
    bias.biasWarnings.some((warning) => warning.toLowerCase().includes("countertrend"))

  let visionScore = clamp(
    Math.round(
      bias.biasAlignmentScore * 0.35 +
        entry.entryConfirmationScore * 0.35 +
        chartRr * 0.1 +
        emaAlignmentScore * 0.1 +
        confirmationQuality * 0.1 -
        confidencePenalty,
    ),
  )

  if (playbookComparison) {
    visionScore = clamp(Math.round(visionScore * 0.55 + playbookComparison.matchScore * 0.45))
  }

  let tradeQualityScore = visionScore
  if (playbookComparison) {
    tradeQualityScore = clamp(
      Math.round(
        playbookComparison.setupQualityScore * 0.35 +
          playbookComparison.ruleAdherenceScore * 0.35 +
          playbookComparison.executionTimingScore * 0.3,
      ),
    )
  }

  const recommendation =
    playbookComparison?.recommendation ??
    deriveRecommendation(visionScore, bias, entry, countertrend)

  const confidenceScore = clamp(
    Math.round(
      visionScore * 0.5 +
        average(Object.values(timeframes).map((tf) => tf?.confidence ?? 50)) * 0.3 +
        (chartsProvided / 5) * 20 -
        confidencePenalty,
    ),
  )

  const warnings = [
    ...bias.biasWarnings,
    ...entry.entryWarnings,
    ...(playbookComparison?.violations.slice(0, 3) || []),
  ]
  const strengths = [...entry.entryStrengths, ...(playbookComparison?.rulesPassed.slice(0, 3) || [])]

  const bosDetected = Object.values(timeframes).some((tf) => tf?.bosDetected)
  const chochDetected = Object.values(timeframes).some((tf) => tf?.chochDetected)
  const liquiditySweepDetected = Object.values(timeframes).some((tf) => tf?.liquiditySweepDetected)
  const supplyDemandPresent = Object.values(timeframes).some(
    (tf) => (tf?.supplyDemandZones.length ?? 0) > 0,
  )

  const pair = context.pair || "Trade"
  const direction = context.direction || "setup"
  const engineLabel = getProviderDisplayLabel(provider)
  const summary =
    chartsProvided < 5
      ? `${pair} ${direction}: ${engineLabel} read with ${chartsProvided}/5 charts — ${recommendation}. HTF ${bias.overallBias}, entry ${entry.entryConfirmationScore}/100.`
      : `${pair} ${direction}: ${engineLabel} aligned read — HTF ${bias.overallBias} (${bias.biasAlignmentScore}/100), entry ${entry.entryConfirmationScore}/100, verdict ${recommendation}.`

  return {
    overallBias: bias.overallBias,
    biasAlignmentScore: bias.biasAlignmentScore,
    entryConfirmationScore: entry.entryConfirmationScore,
    h1SetupQuality: entry.h1SetupQuality,
    m15EntryQuality: entry.m15EntryQuality,
    trendStrength: Number.isFinite(trendStrength) ? trendStrength : 50,
    bosDetected,
    chochDetected,
    liquiditySweepDetected,
    emaAlignmentScore,
    supplyDemandPresent,
    confirmationQuality,
    countertrend,
    rrQuality: chartRr,
    entryQuality: entry.entryConfirmationScore,
    visionScore,
    confidenceScore,
    tradeQualityScore,
    tradeQualityGrade: gradeFromScore(tradeQualityScore),
    recommendation,
    shouldTake: shouldTakeFromRecommendation(recommendation),
    warnings: [...new Set(warnings)].slice(0, 10),
    strengths: [...new Set(strengths)].slice(0, 8),
    summary,
  }
}

function enrichTimeframesWithAnnotations(
  timeframes: Partial<Record<CoachMtfTimeframe, TimeframeVisualAnalysis>>,
  context: PreTradePlannedContext,
  strategyMatchPercent?: number,
): Partial<Record<CoachMtfTimeframe, TimeframeVisualAnalysis>> {
  const enriched: Partial<Record<CoachMtfTimeframe, TimeframeVisualAnalysis>> = {}

  for (const [tf, analysis] of Object.entries(timeframes)) {
    if (!analysis) continue
    const understanding = buildTimeframeChartUnderstanding({
      timeframe: tf as CoachMtfTimeframe,
      analysis,
      context,
      strategyMatchPercent,
      allTimeframes: timeframes,
      provider: analysis.provider,
    })
    enriched[tf as CoachMtfTimeframe] = {
      ...analysis,
      structureQuality: understanding.structureQuality,
      overextended: understanding.overextended,
      riskExplanation: understanding.riskExplanation,
      setupGradeReason: understanding.setupGradeReason,
      strategyMatchPercent: understanding.strategyMatchPercent,
      annotations: understanding.annotations,
    }
  }

  return enriched
}

async function analyzeTimeframeHeuristic(
  timeframe: CoachMtfTimeframe,
  screenshotUrl: string,
  context: PreTradePlannedContext,
): Promise<TimeframeVisualAnalysis> {
  const vision = await analyzeChartVision({
    screenshotUrl,
    plannedContext: context,
    timeframe,
    providerId: "heuristic",
  })

  return {
    timeframe,
    screenshotUrl,
    provider: "heuristic",
    analyzedAt: vision.analyzedAt,
    htfTrendBias: vision.trendBias,
    trendStrength: vision.metrics.overextendedMove ? 68 : 58,
    bosDetected: vision.metrics.breakoutVsRetest === "breakout",
    chochDetected: vision.metrics.breakoutVsRetest === "retest",
    liquiditySweepDetected: vision.insights.some((item) => item.toLowerCase().includes("liquidity")),
    emaAlignmentScore: vision.metrics.emaAlignment,
    emaAlignmentState:
      vision.metrics.emaAlignment >= 70
        ? "aligned"
        : vision.metrics.emaAlignment <= 45
          ? "counter"
          : "mixed",
    supplyDemandZones:
      vision.metrics.supportResistanceProximity >= 70 ? ["Key S/R interaction inferred from plan"] : [],
    confirmationCandleDetected: vision.metrics.confirmationCandleQuality >= 55,
    confirmationCandleQuality: vision.metrics.confirmationCandleQuality,
    countertrendEntry: vision.metrics.countertrend,
    rrQuality: vision.metrics.rrQuality,
    entryQuality: vision.executionQuality,
    detectedSetup: vision.detectedSetup,
    structureNotes: vision.insights,
    warnings: vision.warnings,
    strengths: vision.strengths,
    confidence: vision.confidence,
    summary: vision.summary,
  }
}

async function analyzeAllTimeframes(input: {
  screenshots: MtfScreenshotMap
  context: PreTradePlannedContext
  provider: ChartVisionProviderId
  playbook?: StrategyPlaybookRecord | null
}): Promise<{
  timeframes: Partial<Record<CoachMtfTimeframe, TimeframeVisualAnalysis>>
  fallbackWarnings: string[]
}> {
  let lastError: string | null = null
  const requestedEngine =
    input.provider === "heuristic" ? "heuristic" : (input.provider as "openai" | "claude" | "gemini")

  const tasks = MTF_TIMEFRAME_IDS.filter((tf) => Boolean(input.screenshots[tf])).map(
    async (timeframe) => {
      const screenshotUrl = input.screenshots[timeframe]
      if (!screenshotUrl) return null

      try {
        if (requestedEngine !== "heuristic" && isAiProviderConfigured(requestedEngine)) {
          const result = await analyzeTimeframeWithAiProvider({
            screenshotUrl,
            plannedContext: input.context,
            timeframe,
            playbook: input.playbook,
            providerId: requestedEngine,
          })
          return [timeframe, result] as const
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
        console.error(`AI vision failed for ${timeframe} (${requestedEngine}):`, error)
      }

      const fallback = await analyzeTimeframeHeuristic(timeframe, screenshotUrl, input.context)
      return [timeframe, fallback] as const
    },
  )

  const entries = (await Promise.all(tasks)).filter(Boolean) as Array<
    readonly [CoachMtfTimeframe, TimeframeVisualAnalysis]
  >

  const timeframes = Object.fromEntries(entries)
  return {
    timeframes,
    fallbackWarnings: buildVisionFallbackWarnings({
      requestedEngine,
      timeframes,
      lastError,
    }),
  }
}

function mapPlaybookComparison(
  match: NonNullable<MtfAnalysisResult["playbookMatch"]>,
): VisualPlaybookComparison {
  return {
    playbookId: match.playbookId,
    strategyName: match.strategyName,
    matchScore: match.matchScore,
    setupQualityScore: match.setupQualityScore ?? match.matchScore,
    ruleAdherenceScore: match.ruleAdherenceScore ?? match.matchScore,
    executionTimingScore: match.executionTimingScore ?? match.matchScore,
    setupGrade: match.setupGrade,
    recommendation: match.recommendation,
    rulesPassed: match.rulesPassed,
    rulesFailed: match.rulesFailed,
    violations: match.violations,
    summary: match.summary,
  }
}

export async function analyzeMultiTimeframeWithVision(input: {
  screenshots: MtfScreenshotMap
  context: PreTradePlannedContext
  playbook?: StrategyPlaybookRecord | null
}): Promise<{
  mtfAnalysis: MtfAnalysisResult
  visualAnalysis: VisualAnalysisResult
  chartAnalysis: ChartAnalysisResult
}> {
  const selectedProvider: ChartVisionProviderId = resolveRequestedVisionEngine()

  const { timeframes, fallbackWarnings } = await analyzeAllTimeframes({
    screenshots: input.screenshots,
    context: input.context,
    provider: selectedProvider,
    playbook: input.playbook,
  })
  const actualProvider = resolveActualVisionEngine(
    timeframes,
    selectedProvider === "heuristic" ? "heuristic" : selectedProvider,
  ) as ChartVisionProviderId

  const chartsProvided = Object.keys(timeframes).length
  const chartsMissing = MTF_TIMEFRAME_IDS.filter((tf) => !input.screenshots[tf])
  const confidencePenalty = chartsMissing.length * 6

  const weekly = timeframes.weekly
  const daily = timeframes.daily
  const h4 = timeframes.h4
  const biasAlignment = scoreBiasAlignmentFromVision(weekly, daily, h4, input.context.direction)
  const bias: MtfBiasAnalysis = {
    weeklyBias: weekly?.htfTrendBias ?? "neutral",
    dailyBias: daily?.htfTrendBias ?? "neutral",
    h4Bias: h4?.htfTrendBias ?? "neutral",
    overallBias: biasAlignment.overallBias,
    biasAlignmentScore: biasAlignment.score,
    biasWarnings: biasAlignment.warnings,
  }
  const entry = buildEntryAnalysisFromVision(
    timeframes.h1,
    timeframes.m15,
    bias.overallBias,
    input.context,
  )

  let playbookMatch: MtfAnalysisResult["playbookMatch"] = null
  let playbookComparison: VisualPlaybookComparison | null = null

  const interimMtf: MtfAnalysisResult = {
    version: 2,
    bias,
    entry,
    chartsProvided,
    chartsMissing,
    confidencePenalty,
    overallScore: 0,
    visionScore: 0,
    recommendation: "CAUTION",
    summary: "",
    analyzedAt: new Date().toISOString(),
    provider: actualProvider,
  }

  if (input.playbook) {
    const visualStub: VisualAnalysisResult = {
      version: 1,
      provider: actualProvider,
      analyzedAt: new Date().toISOString(),
      chartsAnalyzed: chartsProvided,
      chartsRequested: MTF_TIMEFRAME_IDS.length,
      timeframes,
      aggregate: buildAggregate(
        timeframes,
        bias,
        entry,
        input.context,
        chartsProvided,
        confidencePenalty,
        null,
        actualProvider,
      ),
    }

    playbookMatch = evaluateStrategyPlaybook({
      playbook: input.playbook,
      mtfAnalysis: interimMtf,
      context: {
        ...input.context,
        visual_analysis: visualStub,
      },
      screenshots: input.screenshots,
      visualAnalysis: visualStub,
    })
    playbookComparison = mapPlaybookComparison(playbookMatch)
  }

  const aggregate = buildAggregate(
    timeframes,
    bias,
    entry,
    input.context,
    chartsProvided,
    confidencePenalty,
    playbookComparison,
    actualProvider,
  )

  if (fallbackWarnings.length > 0) {
    aggregate.warnings = [...new Set([...fallbackWarnings, ...aggregate.warnings])].slice(0, 10)
  }

  const enrichedTimeframes = enrichTimeframesWithAnnotations(
    timeframes,
    input.context,
    playbookComparison?.matchScore,
  )

  const visualAnalysisDraft: VisualAnalysisResult = {
    version: 1,
    provider: actualProvider,
    model: getVisionModelForEngine(actualProvider === "heuristic" ? "heuristic" : actualProvider),
    analyzedAt: new Date().toISOString(),
    chartsAnalyzed: chartsProvided,
    chartsRequested: MTF_TIMEFRAME_IDS.length,
    timeframes: enrichedTimeframes,
    aggregate,
    playbookComparison,
  }

  const chartAnnotations: ChartAnnotationBundle = buildChartAnnotationBundle({
    visualAnalysis: visualAnalysisDraft,
    context: input.context,
  })

  const visualAnalysis: VisualAnalysisResult = {
    ...visualAnalysisDraft,
    chartAnnotations,
  }

  const mtfAnalysis: MtfAnalysisResult = {
    version: 2,
    bias,
    entry,
    chartsProvided,
    chartsMissing,
    confidencePenalty,
    overallScore: aggregate.visionScore,
    visionScore: aggregate.visionScore,
    recommendation: aggregate.recommendation,
    summary: aggregate.summary,
    analyzedAt: new Date().toISOString(),
    provider: actualProvider,
    visualAnalysis,
    playbookMatch,
  }

  const chartAnalysis = mtfAnalysisToChartAnalysis(mtfAnalysis, input.context)
  chartAnalysis.insights = [
    aggregate.bosDetected ? "BOS detected" : "",
    aggregate.chochDetected ? "CHOCH detected" : "",
    aggregate.liquiditySweepDetected ? "Liquidity sweep" : "",
    aggregate.supplyDemandPresent ? "Supply/demand zone" : "",
    aggregate.emaAlignmentScore >= 70 ? "EMA aligned" : "",
    getProviderDisplayLabel(actualProvider),
    `Vision ${aggregate.recommendation}`,
  ].filter(Boolean)

  if (actualProvider === "heuristic" && chartsProvided > 0 && aggregate.visionScore < 50) {
    const heuristicFallback = analyzeMultiTimeframeVision({
      screenshots: input.screenshots,
      context: input.context,
    })
    mtfAnalysis.overallScore = Math.max(mtfAnalysis.overallScore, heuristicFallback.overallScore)
    mtfAnalysis.visionScore = mtfAnalysis.overallScore
  }

  return { mtfAnalysis, visualAnalysis, chartAnalysis }
}

export function buildVisualAnalysisMessages(visual: VisualAnalysisResult): string[] {
  const agg = visual.aggregate
  const messages = [agg.summary]

  messages.push(
    `Visual read: HTF ${agg.overallBias} · Bias ${agg.biasAlignmentScore}/100 · Entry ${agg.entryConfirmationScore}/100 · Quality ${agg.tradeQualityScore}/100 (${agg.tradeQualityGrade}).`,
  )

  if (agg.bosDetected || agg.chochDetected || agg.liquiditySweepDetected) {
    messages.push(
      `Structure: ${[
        agg.bosDetected ? "BOS" : "",
        agg.chochDetected ? "CHOCH" : "",
        agg.liquiditySweepDetected ? "Liquidity sweep" : "",
      ]
        .filter(Boolean)
        .join(" · ")}.`,
    )
  }

  if (agg.warnings.length > 0) {
    messages.push(`Vision warnings: ${agg.warnings.slice(0, 3).join(" · ")}.`)
  }

  if (agg.strengths.length > 0) {
    messages.push(`Vision strengths: ${agg.strengths.slice(0, 3).join(" · ")}.`)
  }

  messages.push(
    `Verdict: ${agg.recommendation} — ${agg.shouldTake === "yes" ? "process supports taking the trade" : agg.shouldTake === "caution" ? "proceed with caution" : "stand down for now"}.`,
  )

  if (visual.playbookComparison) {
    messages.push(`Playbook: ${visual.playbookComparison.summary}`)
  }

  return messages
}
