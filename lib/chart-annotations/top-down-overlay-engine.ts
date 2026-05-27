import type { CoachMtfTimeframe } from "@/lib/coach/mtf-constants"
import { ENTRY_TIMEFRAMES } from "@/lib/coach/mtf-constants"
import type { MtfBiasDirection } from "@/lib/coach/mtf-types"
import type {
  AnnotationSource,
  ChartAnnotation,
  ChartAnnotationKind,
  ChartAnnotationTone,
  OpenAiChartAnnotationPayload,
  ReplayOverlayMoment,
  TopDownConfidenceBreakdown,
} from "@/lib/chart-annotations/types"
import { defaultToneForKind } from "@/lib/chart-annotations/theme"
import type { TimeframeVisualAnalysis } from "@/lib/coach/visual-analysis-types"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"

const HTF_WEIGHT = 0.4
const H4_WEIGHT = 0.25
const H1_WEIGHT = 0.2
const M15_WEIGHT = 0.15

const MEANINGFUL_AOI = /supply|demand|aoi|order block|\bob\b|bos|mitigation|retest|breaker|flip/i
const MITIGATION = /mitigation|breaker|flip|rebalance/i
const RETEST = /retest|pullback|reclaim|tap/i
const DISPLACEMENT = /displacement|impulse|expansion|displacement candle|large body/i
const CHOPPY = /choppy|messy|unclear|no clean|range bound|whipsaw/i

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

export type TopDownStackContext = {
  weeklyBias: MtfBiasDirection
  dailyBias: MtfBiasDirection
  h4Bias: MtfBiasDirection
  overallHtfBias: MtfBiasDirection
  h4ConfirmsHtf: boolean
  htfConflict: boolean
  tradeAlignedWithHtf: boolean
  h1Clean: boolean
  h1Choppy: boolean
  m15Confirmed: boolean
  m15EarlyOrChase: boolean
  countertrendSetup: boolean
}

export function buildTopDownStackContext(input: {
  timeframes: Partial<Record<CoachMtfTimeframe, TimeframeVisualAnalysis>>
  context: PreTradePlannedContext
}): TopDownStackContext {
  const weekly = input.timeframes.weekly
  const daily = input.timeframes.daily
  const h4 = input.timeframes.h4
  const h1 = input.timeframes.h1
  const m15 = input.timeframes.m15

  const weeklyBias = weekly?.htfTrendBias ?? "neutral"
  const dailyBias = daily?.htfTrendBias ?? "neutral"
  const h4Bias = h4?.htfTrendBias ?? "neutral"

  const biases = [weeklyBias, dailyBias, h4Bias].filter((b) => b !== "neutral")
  const bullish = biases.filter((b) => b === "bullish").length
  const bearish = biases.filter((b) => b === "bearish").length
  let overallHtfBias: MtfBiasDirection = "neutral"
  if (bullish > 0 && bearish > 0) overallHtfBias = "mixed"
  else if (bullish >= 2) overallHtfBias = "bullish"
  else if (bearish >= 2) overallHtfBias = "bearish"
  else if (bullish === 1) overallHtfBias = "bullish"
  else if (bearish === 1) overallHtfBias = "bearish"

  const h4ConfirmsHtf =
    h4Bias === "neutral" ||
    overallHtfBias === "neutral" ||
    overallHtfBias === "mixed" ||
    h4Bias === overallHtfBias ||
    (weeklyBias !== "neutral" && dailyBias !== "neutral" && weeklyBias === dailyBias && h4Bias === weeklyBias)

  const htfConflict =
    overallHtfBias === "mixed" ||
    (weeklyBias !== "neutral" && dailyBias !== "neutral" && weeklyBias !== dailyBias) ||
    (h4Bias !== "neutral" && weeklyBias !== "neutral" && h4Bias !== weeklyBias) ||
    (h4Bias !== "neutral" && dailyBias !== "neutral" && h4Bias !== dailyBias)

  const tradeAlignedWithHtf =
    overallHtfBias === "neutral" ||
    overallHtfBias === "mixed" ||
    biasMatchesTrade(overallHtfBias, input.context.direction)

  const h1Choppy =
    Boolean(h1) &&
    ((h1?.entryQuality ?? 0) < 50 ||
      (h1?.warnings ?? []).some((w) => CHOPPY.test(w)) ||
      (h1?.structureNotes ?? []).some((n) => CHOPPY.test(n)))

  const h1Clean = Boolean(h1) && !h1Choppy && (h1?.entryQuality ?? 0) >= 60

  const m15Confirmed =
    Boolean(m15) &&
    Boolean(m15?.confirmationCandleDetected) &&
    (m15?.confirmationCandleQuality ?? 0) >= 55 &&
    (m15?.entryQuality ?? 0) >= 55

  const m15EarlyOrChase =
    Boolean(m15) &&
    (!m15?.confirmationCandleDetected ||
      (m15?.entryQuality ?? 0) < 50 ||
      m15?.overextended === true ||
      (m15?.warnings ?? []).some((w) => /early|chase|fomo|before close|expansion|displacement/i.test(w)))

  const countertrendSetup =
    !tradeAlignedWithHtf ||
    Boolean(h4?.countertrendEntry) ||
    Boolean(h1?.countertrendEntry) ||
    Boolean(m15?.countertrendEntry)

  return {
    weeklyBias,
    dailyBias,
    h4Bias,
    overallHtfBias,
    h4ConfirmsHtf,
    htfConflict,
    tradeAlignedWithHtf,
    h1Clean,
    h1Choppy,
    m15Confirmed,
    m15EarlyOrChase,
    countertrendSetup,
  }
}

export function scoreTopDownConfidence(input: {
  stack: TopDownStackContext
  timeframes: Partial<Record<CoachMtfTimeframe, TimeframeVisualAnalysis>>
}): TopDownConfidenceBreakdown {
  const { stack, timeframes } = input
  const weekly = timeframes.weekly
  const daily = timeframes.daily
  const h4 = timeframes.h4
  const h1 = timeframes.h1
  const m15 = timeframes.m15

  let htfBiasScore = 45
  if (weekly && daily) {
    htfBiasScore = 52
    if (stack.weeklyBias === stack.dailyBias && stack.weeklyBias !== "neutral") htfBiasScore += 18
    if (stack.tradeAlignedWithHtf) htfBiasScore += 14
    if (stack.htfConflict) htfBiasScore -= 22
    if (!stack.tradeAlignedWithHtf) htfBiasScore -= 18
    htfBiasScore += Math.round(((weekly.trendStrength + daily.trendStrength) / 2 - 50) * 0.2)
  } else if (weekly || daily) {
    htfBiasScore = 55
  }

  let h4StructureScore = h4 ? h4.entryQuality : 45
  if (h4) {
    if (stack.h4ConfirmsHtf) h4StructureScore += 10
    else h4StructureScore -= 14
    if (h4.bosDetected) h4StructureScore += 8
    if (h4.chochDetected && !h4.bosDetected) h4StructureScore -= 6
    if (stack.htfConflict) h4StructureScore -= 12
  }

  let h1CleanlinessScore = h1 ? h1.entryQuality : 50
  if (h1) {
    if (stack.h1Clean) h1CleanlinessScore += 10
    if (stack.h1Choppy) h1CleanlinessScore -= 18
    if (!stack.h4ConfirmsHtf) h1CleanlinessScore -= 8
    if (h1.bosDetected || h1.liquiditySweepDetected) h1CleanlinessScore += 6
  }

  let m15ConfirmationScore = m15 ? m15.confirmationCandleQuality : 40
  if (m15) {
    if (stack.m15Confirmed) m15ConfirmationScore += 12
    if (stack.m15EarlyOrChase) m15ConfirmationScore -= 20
    if (!m15.confirmationCandleDetected) m15ConfirmationScore -= 15
    if (stack.countertrendSetup) m15ConfirmationScore -= 10
  }

  const weightedScore = clamp(
    Math.round(
      htfBiasScore * HTF_WEIGHT +
        h4StructureScore * H4_WEIGHT +
        h1CleanlinessScore * H1_WEIGHT +
        m15ConfirmationScore * M15_WEIGHT,
    ),
  )

  return {
    htfBiasScore: clamp(Math.round(htfBiasScore)),
    h4StructureScore: clamp(Math.round(h4StructureScore)),
    h1CleanlinessScore: clamp(Math.round(h1CleanlinessScore)),
    m15ConfirmationScore: clamp(Math.round(m15ConfirmationScore)),
    weightedScore,
  }
}

function isMeaningfulAoiZone(zone: string, analysis: TimeframeVisualAnalysis): boolean {
  if (!zone.trim()) return false
  if (!MEANINGFUL_AOI.test(zone)) return false
  return (
    analysis.bosDetected ||
    analysis.liquiditySweepDetected ||
    analysis.chochDetected ||
    MEANINGFUL_AOI.test(zone)
  )
}

function zoneIsValid(
  zone: string,
  analysis: TimeframeVisualAnalysis,
  stack: TopDownStackContext,
  timeframe: CoachMtfTimeframe,
): boolean {
  if (!isMeaningfulAoiZone(zone, analysis)) return false
  if (stack.countertrendSetup) return false
  if (timeframe === "h4" && !stack.h4ConfirmsHtf) return false
  if (ENTRY_TIMEFRAMES.includes(timeframe) && stack.h1Choppy && timeframe === "h1") return false
  if (timeframe === "m15" && !stack.m15Confirmed) return false
  return true
}

function biasTone(bias: MtfBiasDirection): ChartAnnotationTone {
  if (bias === "bullish") return "bullish"
  if (bias === "bearish") return "bearish"
  if (bias === "mixed") return "caution"
  return "neutral"
}

function makeAnnotation(input: {
  id: string
  kind: ChartAnnotationKind
  label: string
  tone: ChartAnnotationTone
  confidence: number
  x: number
  y: number
  width: number
  height: number
  source: AnnotationSource
  validity?: ChartAnnotation["validity"]
  commentary?: string
  replayMoment?: ReplayOverlayMoment
  arrowTo?: ChartAnnotation["arrowTo"]
  dashed?: boolean
}): ChartAnnotation {
  return {
    id: input.id,
    kind: input.kind,
    label: input.label,
    tone: input.tone,
    confidence: clamp(input.confidence),
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    source: input.source,
    validity: input.validity,
    commentary: input.commentary,
    replayMoment: input.replayMoment,
    arrowTo: input.arrowTo,
    dashed: input.dashed,
  }
}

export function inferTopDownHeuristicAnnotations(input: {
  timeframe: CoachMtfTimeframe
  analysis: TimeframeVisualAnalysis
  stack: TopDownStackContext
  context: PreTradePlannedContext
}): ChartAnnotation[] {
  const { timeframe, analysis, stack, context } = input
  const annotations: ChartAnnotation[] = []
  const source: AnnotationSource = "heuristic"

  if (timeframe === "weekly" || timeframe === "daily") {
    annotations.push(
      makeAnnotation({
        id: `${timeframe}-htf-bias`,
        kind: "htf_bias",
        label: `${timeframe.toUpperCase()} ${analysis.htfTrendBias}`,
        tone: biasTone(analysis.htfTrendBias),
        confidence: stack.tradeAlignedWithHtf ? 78 : 62,
        x: 4,
        y: 5,
        width: 30,
        height: 8,
        source,
        commentary: stack.tradeAlignedWithHtf
          ? "HTF directional bias supports planned trade."
          : "HTF bias conflicts with planned direction.",
        replayMoment: "before_entry",
      }),
    )
  }

  if (timeframe === "h4") {
    annotations.push(
      makeAnnotation({
        id: "h4-bias",
        kind: "htf_bias",
        label: `H4 ${analysis.htfTrendBias}${stack.h4ConfirmsHtf ? " ✓ HTF" : " ⚠ conflict"}`,
        tone: stack.h4ConfirmsHtf ? biasTone(analysis.htfTrendBias) : "caution",
        confidence: stack.h4ConfirmsHtf ? 80 : 58,
        x: 4,
        y: 5,
        width: 34,
        height: 8,
        source,
        commentary: stack.h4ConfirmsHtf
          ? "H4 confirms Weekly/Daily direction."
          : "H4 disagrees with Weekly/Daily — lower score.",
        replayMoment: "before_entry",
      }),
    )
  }

  analysis.supplyDemandZones.slice(0, 2).forEach((zone, index) => {
    const valid = zoneIsValid(zone, analysis, stack, timeframe)
    const kind: ChartAnnotationKind = valid ? "aoi_valid" : "aoi_invalid"
    annotations.push(
      makeAnnotation({
        id: `${timeframe}-aoi-${index}`,
        kind,
        label: valid ? "Valid AOI" : "Invalid AOI",
        tone: valid ? "bullish" : "bearish",
        validity: valid ? "valid" : "invalid",
        confidence: valid ? 74 : 68,
        x: 8,
        y: 26 + index * 16,
        width: 84,
        height: 11,
        source,
        dashed: !valid,
        commentary: valid
          ? zone.slice(0, 120)
          : "AOI lacks BOS/supply-demand confluence or fights HTF bias.",
        replayMoment: "before_entry",
      }),
    )
  })

  if (analysis.bosDetected) {
    annotations.push(
      makeAnnotation({
        id: `${timeframe}-bos`,
        kind: "bos",
        label: "BOS",
        tone: "bullish",
        confidence: 76,
        x: 60,
        y: timeframe === "h4" ? 36 : 42,
        width: 14,
        height: 9,
        source,
        arrowTo: { x: 76, y: 46 },
        replayMoment: "before_entry",
      }),
    )
  }

  if (analysis.chochDetected) {
    annotations.push(
      makeAnnotation({
        id: `${timeframe}-choch`,
        kind: "choch",
        label: "CHOCH",
        tone: "caution",
        confidence: 72,
        x: 56,
        y: timeframe === "h4" ? 50 : 54,
        width: 16,
        height: 9,
        source,
        replayMoment: "before_entry",
      }),
    )
  }

  const zoneText = analysis.supplyDemandZones.join(" ")
  if (MITIGATION.test(zoneText) || analysis.structureNotes.some((n) => MITIGATION.test(n))) {
    annotations.push(
      makeAnnotation({
        id: `${timeframe}-mitigation`,
        kind: "mitigation",
        label: "Mitigation",
        tone: "liquidity",
        confidence: 70,
        x: 14,
        y: 44,
        width: 24,
        height: 10,
        source,
        replayMoment: "before_entry",
      }),
    )
  }

  if (
    RETEST.test(zoneText) ||
    analysis.structureNotes.some((n) => RETEST.test(n)) ||
    (analysis.bosDetected && timeframe !== "m15")
  ) {
    annotations.push(
      makeAnnotation({
        id: `${timeframe}-retest`,
        kind: "retest",
        label: "Retest",
        tone: "bullish",
        confidence: 68,
        x: 48,
        y: 62,
        width: 20,
        height: 9,
        source,
        replayMoment: timeframe === "m15" ? "entry" : "before_entry",
      }),
    )
  }

  if (analysis.liquiditySweepDetected) {
    annotations.push(
      makeAnnotation({
        id: `${timeframe}-liquidity`,
        kind: "liquidity_sweep",
        label: "Liquidity Sweep",
        tone: "liquidity",
        confidence: 77,
        x: 10,
        y: timeframe === "m15" ? 16 : 70,
        width: 22,
        height: 8,
        source,
        arrowTo: { x: 26, y: timeframe === "m15" ? 26 : 76 },
        replayMoment: timeframe === "m15" ? "entry" : "before_entry",
      }),
    )
  }

  const displacementSignal =
    analysis.overextended === true ||
    analysis.warnings.some((w) => DISPLACEMENT.test(w)) ||
    (analysis.entryQuality < 45 && analysis.trendStrength > 68)

  if (displacementSignal) {
    annotations.push(
      makeAnnotation({
        id: `${timeframe}-displacement`,
        kind: "displacement",
        label: "Displacement",
        tone: "caution",
        confidence: 73,
        x: 40,
        y: 10,
        width: 26,
        height: 8,
        source,
        commentary: "Expansion/displacement candle — avoid chasing.",
        replayMoment: "mistake",
      }),
    )
  }

  if (timeframe === "h1" && stack.h1Choppy) {
    annotations.push(
      makeAnnotation({
        id: "h1-choppy",
        kind: "chase_risk",
        label: "Choppy H1",
        tone: "caution",
        confidence: 76,
        x: 6,
        y: 84,
        width: 28,
        height: 8,
        source,
        commentary: "Messy/choppy H1 structure — wait for clean setup.",
        replayMoment: "mistake",
      }),
    )
  }

  if (timeframe === "m15") {
    if (stack.m15Confirmed) {
      annotations.push(
        makeAnnotation({
          id: "m15-confirm",
          kind: "confirmation_candle",
          label: "M15 Close ✓",
          tone: "bullish",
          confidence: 82,
          x: 66,
          y: 56,
          width: 20,
          height: 12,
          source,
          commentary: "Confirmation candle close before entry.",
          replayMoment: "entry",
        }),
      )
    } else {
      annotations.push(
        makeAnnotation({
          id: "m15-no-confirm",
          kind: "confirmation_candle",
          label: "No M15 Close",
          tone: "bearish",
          validity: "invalid",
          confidence: 78,
          x: 66,
          y: 56,
          width: 22,
          height: 12,
          source,
          dashed: true,
          commentary: "Entry before M15 confirmation close — stand down.",
          replayMoment: "mistake",
        }),
      )
    }
  }

  if (stack.countertrendSetup && (timeframe === "h4" || timeframe === "m15" || timeframe === "h1")) {
    annotations.push(
      makeAnnotation({
        id: `${timeframe}-countertrend`,
        kind: "countertrend",
        label: "Countertrend",
        tone: "bearish",
        confidence: 84,
        x: 6,
        y: 90,
        width: 32,
        height: 8,
        source,
        commentary: "Dangerous countertrend setup vs HTF bias.",
        replayMoment: "mistake",
      }),
    )
  }

  if (stack.m15EarlyOrChase && (timeframe === "m15" || timeframe === "h1")) {
    annotations.push(
      makeAnnotation({
        id: `${timeframe}-chase`,
        kind: "chase_risk",
        label: "Chase / Early",
        tone: "caution",
        confidence: 77,
        x: 38,
        y: 8,
        width: 28,
        height: 8,
        source,
        commentary: "Overextended or early entry — FOMO/chase risk.",
        replayMoment: "mistake",
      }),
    )
  }

  if (context.stop_loss && (timeframe === "h1" || timeframe === "m15")) {
    annotations.push(
      makeAnnotation({
        id: `${timeframe}-invalidation`,
        kind: "invalidation_zone",
        label: "Invalidation",
        tone: "bearish",
        confidence: 66,
        x: 8,
        y: 78,
        width: 84,
        height: 7,
        source,
        replayMoment: "mistake",
      }),
    )
  }

  return dedupeAnnotations(annotations).slice(0, 12)
}

function normalizeGptKind(value: unknown): ChartAnnotationKind {
  const text = String(value || "").toLowerCase().replace(/\s+/g, "_")
  const map: Record<string, ChartAnnotationKind> = {
    aoi_zone: "aoi_valid",
    aoi_valid: "aoi_valid",
    valid_aoi: "aoi_valid",
    aoi_invalid: "aoi_invalid",
    invalid_aoi: "aoi_invalid",
    bos: "bos",
    choch: "choch",
    liquidity_sweep: "liquidity_sweep",
    liquidity: "liquidity_sweep",
    confirmation_candle: "confirmation_candle",
    entry_area: "entry_area",
    invalidation_zone: "invalidation_zone",
    htf_bias: "htf_bias",
    chase_risk: "chase_risk",
    countertrend: "countertrend",
    mitigation: "mitigation",
    retest: "retest",
    displacement: "displacement",
  }
  for (const [key, kind] of Object.entries(map)) {
    if (text.includes(key)) return kind
  }
  return "aoi_valid"
}

export function parseTopDownGptAnnotations(
  raw: unknown,
  prefix: string,
  stack: TopDownStackContext,
): ChartAnnotation[] {
  if (!Array.isArray(raw)) return []

  return raw
    .map((item, index) => {
      const record = item as OpenAiChartAnnotationPayload
      const kind = normalizeGptKind(record.kind)
      const toneText = String(record.tone || "").toLowerCase()
      const validityText = String(record.validity || "").toLowerCase()
      let validity: ChartAnnotation["validity"] = "neutral"
      if (kind === "aoi_valid" || toneText.includes("valid") || validityText === "valid") {
        validity = "valid"
      }
      if (kind === "aoi_invalid" || toneText.includes("invalid") || validityText === "invalid") {
        validity = "invalid"
      }
      if (kind === "countertrend" || kind === "chase_risk") validity = "invalid"

      const tone: ChartAnnotationTone =
        validity === "invalid" || kind === "countertrend"
          ? "bearish"
          : toneText.includes("caution")
            ? "caution"
            : toneText.includes("liquidity") || kind === "liquidity_sweep" || kind === "mitigation"
              ? "liquidity"
              : defaultToneForKind(kind)

      return makeAnnotation({
        id: `${prefix}-gpt-${kind}-${index}`,
        kind: kind === "aoi_zone" ? "aoi_valid" : kind,
        label: String(record.label || kind.replace(/_/g, " ").toUpperCase()).slice(0, 48),
        tone,
        confidence: clamp(Number(record.confidence ?? 72)),
        x: clamp(Number(record.x ?? 10 + index * 4)),
        y: clamp(Number(record.y ?? 20 + index * 5)),
        width: clamp(Number(record.width ?? 18), 6, 90),
        height: clamp(Number(record.height ?? 10), 4, 80),
        source: "gpt4_vision",
        validity,
        dashed: validity === "invalid",
        commentary: record.commentary ? String(record.commentary).slice(0, 180) : undefined,
        arrowTo: record.arrowTo
          ? { x: clamp(Number(record.arrowTo.x)), y: clamp(Number(record.arrowTo.y)) }
          : undefined,
        replayMoment: normalizeReplayMoment(record.replayMoment, kind, stack),
      })
    })
    .slice(0, 12)
}

function normalizeReplayMoment(
  value: unknown,
  kind: ChartAnnotationKind,
  stack: TopDownStackContext,
): ReplayOverlayMoment | undefined {
  const text = String(value || "").toLowerCase()
  if (text.includes("before")) return "before_entry"
  if (text.includes("mistake")) return "mistake"
  if (text.includes("exit")) return "exit"
  if (text.includes("entry")) return "entry"
  if (kind === "countertrend" || kind === "chase_risk" || kind === "displacement") return "mistake"
  if (kind === "confirmation_candle" && !stack.m15Confirmed) return "mistake"
  if (kind === "confirmation_candle") return "entry"
  return "before_entry"
}

function dedupeAnnotations(annotations: ChartAnnotation[]): ChartAnnotation[] {
  const seen = new Set<string>()
  return annotations.filter((item) => {
    const key = `${item.kind}-${item.label}-${Math.round(item.x)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function mergeTopDownAnnotations(input: {
  gptAnnotations: ChartAnnotation[]
  heuristicAnnotations: ChartAnnotation[]
  provider: string
}): ChartAnnotation[] {
  const useGpt =
    input.provider !== "heuristic" && input.gptAnnotations.length > 0
  if (!useGpt) return dedupeAnnotations(input.heuristicAnnotations)

  const gptKinds = new Set(input.gptAnnotations.map((a) => a.kind))
  const supplemental = input.heuristicAnnotations.filter((item) => {
    if (item.kind === "htf_bias" && gptKinds.has("htf_bias")) return false
    if (item.kind === "countertrend" && gptKinds.has("countertrend")) return false
    if (item.kind === "confirmation_candle" && gptKinds.has("confirmation_candle")) return false
    return !gptKinds.has(item.kind)
  })

  return dedupeAnnotations([...input.gptAnnotations, ...supplemental]).slice(0, 12)
}
