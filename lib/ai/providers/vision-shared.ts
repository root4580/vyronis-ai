import { calculateRiskReward } from "@/lib/trade-form-utils"
import type { CoachMtfTimeframe } from "@/lib/coach/mtf-constants"
import { BIAS_TIMEFRAMES } from "@/lib/coach/mtf-constants"
import type { ChartVisionResult } from "@/lib/coach/types"
import type { MtfBiasDirection } from "@/lib/coach/mtf-types"
import type {
  OpenAiTimeframeVisionPayload,
  TimeframeVisualAnalysis,
  VisualEmaAlignmentState,
} from "@/lib/coach/visual-analysis-types"
import { buildPlaybookVisionPromptSection } from "@/lib/strategy/playbook-vision-prompts"
import type { StrategyPlaybookRecord } from "@/lib/strategy/types"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"
import type { AiProviderId } from "@/lib/ai/providers/provider-interface"

export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

export function normalizeBias(value: unknown): MtfBiasDirection {
  const text = String(value || "").toLowerCase()
  if (text === "bullish" || text === "bull") return "bullish"
  if (text === "bearish" || text === "bear") return "bearish"
  if (text === "mixed" || text === "conflict") return "mixed"
  return "neutral"
}

export function normalizeEmaState(value: unknown): VisualEmaAlignmentState {
  const text = String(value || "").toLowerCase()
  if (text === "aligned") return "aligned"
  if (text === "mixed") return "mixed"
  if (text === "counter") return "counter"
  return "unknown"
}

export function asStringArray(value: unknown, max = 6): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, max)
}

export function asBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === 1
}

export function asNumber(value: unknown, fallback = 50): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? clamp(Math.round(parsed)) : fallback
}

export function plannedRrScore(context: PreTradePlannedContext): number {
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

export function buildTimeframeVisionPrompt(
  timeframe: CoachMtfTimeframe,
  context: PreTradePlannedContext,
  playbook?: StrategyPlaybookRecord | null,
): string {
  const role = BIAS_TIMEFRAMES.includes(timeframe)
    ? "HTF bias / structure chart"
    : "entry timing chart"
  const focus = BIAS_TIMEFRAMES.includes(timeframe)
    ? "Focus on HTF trend bias, market structure (BOS/CHOCH), trend strength, EMA stack, and major supply/demand zones."
    : "Focus on setup quality, confirmation candles, entry location, liquidity sweeps, and whether the entry aligns with HTF bias."
  const playbookSection = buildPlaybookVisionPromptSection(playbook, timeframe)

  return [
    `You are an expert TradingView chart analyst for a pre-trade coach.`,
    `Analyze this ${timeframe.toUpperCase()} screenshot (${role}).`,
    focus,
    playbookSection,
    "",
    "Trader plan context:",
    `- Pair: ${context.pair || "unknown"}`,
    `- Direction: ${context.direction || "unknown"}`,
    `- Setup: ${context.setup || "unknown"}`,
    `- Strategy: ${context.strategy_name || "unknown"}`,
    `- HTF note: ${context.higher_timeframe || "not specified"}`,
    `- Entry TF: ${context.entry_timeframe || "not specified"}`,
    `- Confirmation TF: ${context.confirmation_timeframe || "not specified"}`,
    `- Confirmation signal: ${context.confirmation_signal || "not specified"}`,
    `- Entry: ${context.entry_price || "—"} | SL: ${context.stop_loss || "—"} | TP: ${context.take_profit || "—"}`,
    "",
    "Multi-Timeframe FX Continuation overlay rules (strict priority):",
    "1. Sunday focus: trade only pairs aligned with weekly thesis; W/D/H4 must agree.",
    "2. No trade until price reaches pre-defined AOI — touch alone is invalid.",
    "3. Entry requires break/retest OR LTF structure shift + momentum; EMA is secondary.",
    "4. M15 requires confirmation candle CLOSE — mark missing close as mistake.",
    "5. Flag late/chase/extended entries and displacement without fresh confirmation.",
    "6. Penalize countertrend vs HTF, poor R:R, unclear SL, news risk, emotional/FOMO reads.",
    "7. Grade borderline setups: 2+ borderline items = pass (warn as Grade C risk).",
    "",
    "Annotation kinds to use on chart:",
    "aoi_valid, aoi_invalid, bos, choch, liquidity_sweep, mitigation, retest, displacement,",
    "confirmation_candle, entry_area, invalidation_zone, htf_bias, chase_risk, countertrend",
    "",
    "Return ONLY valid JSON with this exact shape:",
    `{`,
    `  "htfTrendBias": "bullish|bearish|neutral|mixed",`,
    `  "trendStrength": 0-100,`,
    `  "structureQuality": 0-100,`,
    `  "bosDetected": boolean,`,
    `  "chochDetected": boolean,`,
    `  "liquiditySweepDetected": boolean,`,
    `  "emaAlignmentScore": 0-100,`,
    `  "emaAlignmentState": "aligned|mixed|counter|unknown",`,
    `  "supplyDemandZones": ["short zone descriptions"],`,
    `  "confirmationCandleDetected": boolean,`,
    `  "confirmationCandleQuality": 0-100,`,
    `  "countertrendEntry": boolean,`,
    `  "overextended": boolean,`,
    `  "rrQuality": 0-100,`,
    `  "entryQuality": 0-100,`,
    `  "detectedSetup": "short setup label",`,
    `  "structureNotes": ["observations"],`,
    `  "warnings": ["risk warnings with WHY"],`,
    `  "strengths": ["positive structure with WHY"],`,
    `  "riskExplanation": "why this trade is risky or clean",`,
    `  "setupGradeReason": "why this is A/B/C quality",`,
    `  "confidence": 0-100,`,
    `  "summary": "one sentence chart read",`,
    `  "annotations": [`,
    `    {`,
    `      "kind": "aoi_valid|aoi_invalid|bos|choch|liquidity_sweep|mitigation|retest|displacement|confirmation_candle|entry_area|invalidation_zone|htf_bias|chase_risk|countertrend",`,
    `      "label": "short label",`,
    `      "tone": "bullish|bearish|caution|liquidity|neutral",`,
    `      "validity": "valid|invalid|neutral",`,
    `      "confidence": 0-100,`,
    `      "x": 0-100, "y": 0-100, "width": 0-100, "height": 0-100,`,
    `      "commentary": "optional note",`,
    `      "arrowTo": { "x": 0-100, "y": 0-100 },`,
    `      "replayMoment": "before_entry|entry|mistake|exit"`,
    `    }`,
    `  ]`,
    `}`,
    "",
    "Be conservative when the chart is unclear. Penalize countertrend entries vs visible HTF structure.",
  ].join("\n")
}

export function parseTimeframeVisionPayload(raw: string): OpenAiTimeframeVisionPayload {
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim()
  const parsed = JSON.parse(cleaned) as Record<string, unknown>

  return {
    htfTrendBias: normalizeBias(parsed.htfTrendBias),
    trendStrength: asNumber(parsed.trendStrength, 50),
    bosDetected: asBoolean(parsed.bosDetected),
    chochDetected: asBoolean(parsed.chochDetected),
    liquiditySweepDetected: asBoolean(parsed.liquiditySweepDetected),
    emaAlignmentScore: asNumber(parsed.emaAlignmentScore, 50),
    emaAlignmentState: normalizeEmaState(parsed.emaAlignmentState),
    supplyDemandZones: asStringArray(parsed.supplyDemandZones, 5),
    confirmationCandleDetected: asBoolean(parsed.confirmationCandleDetected),
    confirmationCandleQuality: asNumber(parsed.confirmationCandleQuality, 45),
    countertrendEntry: asBoolean(parsed.countertrendEntry),
    rrQuality: asNumber(parsed.rrQuality, 50),
    entryQuality: asNumber(parsed.entryQuality, 50),
    detectedSetup: String(parsed.detectedSetup || "Unclassified setup").slice(0, 120),
    structureNotes: asStringArray(parsed.structureNotes, 5),
    warnings: asStringArray(parsed.warnings, 6),
    strengths: asStringArray(parsed.strengths, 5),
    confidence: asNumber(parsed.confidence, 55),
    summary: String(parsed.summary || "Chart analyzed.").slice(0, 280),
    structureQuality: asNumber(parsed.structureQuality, asNumber(parsed.trendStrength, 50)),
    overextended: asBoolean(parsed.overextended),
    riskExplanation: String(parsed.riskExplanation || "").slice(0, 220) || undefined,
    setupGradeReason: String(parsed.setupGradeReason || "").slice(0, 220) || undefined,
    annotations: Array.isArray(parsed.annotations)
      ? (parsed.annotations as OpenAiTimeframeVisionPayload["annotations"])
      : [],
  }
}

export async function fetchImageDataUrl(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Could not fetch screenshot (${response.status})`)
  }
  const contentType = response.headers.get("content-type") || "image/png"
  const buffer = Buffer.from(await response.arrayBuffer())
  const base64 = buffer.toString("base64")
  return `data:${contentType};base64,${base64}`
}

export function buildTimeframeVisualAnalysis(input: {
  payload: OpenAiTimeframeVisionPayload
  screenshotUrl: string
  timeframe: CoachMtfTimeframe
  provider: AiProviderId
  plannedContext: PreTradePlannedContext
}): TimeframeVisualAnalysis {
  const rrFallback = plannedRrScore(input.plannedContext)
  return {
    timeframe: input.timeframe,
    screenshotUrl: input.screenshotUrl,
    provider: input.provider,
    analyzedAt: new Date().toISOString(),
    htfTrendBias: input.payload.htfTrendBias,
    trendStrength: input.payload.trendStrength,
    bosDetected: input.payload.bosDetected,
    chochDetected: input.payload.chochDetected,
    liquiditySweepDetected: input.payload.liquiditySweepDetected,
    emaAlignmentScore: input.payload.emaAlignmentScore,
    emaAlignmentState: input.payload.emaAlignmentState,
    supplyDemandZones: input.payload.supplyDemandZones,
    confirmationCandleDetected: input.payload.confirmationCandleDetected,
    confirmationCandleQuality: input.payload.confirmationCandleQuality,
    countertrendEntry: input.payload.countertrendEntry,
    rrQuality: Math.max(input.payload.rrQuality, rrFallback),
    entryQuality: input.payload.entryQuality,
    detectedSetup: input.payload.detectedSetup,
    structureNotes: input.payload.structureNotes,
    warnings: input.payload.warnings,
    strengths: input.payload.strengths,
    confidence: input.payload.confidence,
    summary: input.payload.summary,
    structureQuality: input.payload.structureQuality,
    overextended: input.payload.overextended,
    riskExplanation: input.payload.riskExplanation,
    setupGradeReason: input.payload.setupGradeReason,
    gptAnnotations: input.payload.annotations,
  }
}

export function timeframeAnalysisToChartVision(
  tfResult: TimeframeVisualAnalysis,
  providerId: AiProviderId,
): ChartVisionResult {
  const countertrend = tfResult.countertrendEntry
  const visionScore = clamp(
    Math.round(
      tfResult.entryQuality * 0.3 +
        tfResult.emaAlignmentScore * 0.2 +
        tfResult.confirmationCandleQuality * 0.2 +
        tfResult.trendStrength * 0.15 +
        tfResult.rrQuality * 0.15,
    ),
  )

  return {
    version: 2,
    visionScore,
    detectedSetup: tfResult.detectedSetup,
    trendBias: tfResult.htfTrendBias,
    warnings: tfResult.warnings,
    strengths: tfResult.strengths,
    executionQuality: tfResult.entryQuality,
    confidence: tfResult.confidence,
    metrics: {
      trendDirection: tfResult.htfTrendBias,
      countertrend,
      rrQuality: tfResult.rrQuality,
      impulsiveEntryDistance: tfResult.entryQuality < 45 ? 78 : 35,
      emaAlignment: tfResult.emaAlignmentScore,
      supportResistanceProximity: tfResult.supplyDemandZones.length > 0 ? 75 : 48,
      breakoutVsRetest:
        tfResult.bosDetected && !tfResult.chochDetected
          ? "breakout"
          : tfResult.chochDetected
            ? "retest"
            : "unknown",
      confirmationCandleQuality: tfResult.confirmationCandleQuality,
      overextendedMove: tfResult.entryQuality < 42 && tfResult.trendStrength > 70,
      volatilityState: tfResult.trendStrength >= 72 ? "expanded" : "normal",
    },
    provider: providerId,
    analyzedAt: tfResult.analyzedAt,
    summary: tfResult.summary,
    insights: [
      ...tfResult.structureNotes.slice(0, 2),
      tfResult.bosDetected ? "BOS detected" : "",
      tfResult.chochDetected ? "CHOCH detected" : "",
      tfResult.liquiditySweepDetected ? "Liquidity sweep" : "",
    ].filter(Boolean),
  }
}
