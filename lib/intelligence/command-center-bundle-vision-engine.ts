import { randomUUID } from "crypto"
import { getOpenAiClient, getOpenAiVisionModel, isOpenAiConfigured } from "@/lib/ai/providers/openai-provider"
import { fetchImageDataUrl } from "@/lib/ai/providers/vision-shared"
import type { CoachMtfTimeframe } from "@/lib/coach/mtf-constants"
import { MTF_TIMEFRAME_IDS } from "@/lib/coach/mtf-constants"
import type { MtfScreenshotMap } from "@/lib/coach/mtf-types"
import { mtfAnalysisToChartAnalysis } from "@/lib/coach/multi-timeframe-vision-engine"
import { analyzeMultiTimeframeWithVision } from "@/lib/coach/visual-mtf-engine"
import {
  chartVisionToLegacyAnalysis,
  analyzeChartVisionForContext,
} from "@/lib/coach/chart-vision-engine"
import type { ChartVisionResult } from "@/lib/coach/types"
import type { ChartAnalysisResult, PreTradePlannedContext } from "@/lib/trade-coach/types"
import {
  BUNDLE_TIMEFRAME_DISPLAY,
  BUNDLE_TIMEFRAME_ORDER,
  type InferredBundleTimeframe,
  type TimeframeBundleAnalysis,
  type TimeframeBundleFrame,
} from "@/lib/intelligence/command-center-bundle-types"
import type { CommandCenterVisionAnalysis } from "@/lib/intelligence/command-center-vision-engine"
import { buildVisionChecklist } from "@/lib/intelligence/command-center-vision-engine"

const MAX_BUNDLE_IMAGES = 6
const BUNDLE_FALLBACK =
  "Timeframe bundle received. Vision analysis needs OpenAI key enabled."

const COACH_MTF_SET = new Set<string>(MTF_TIMEFRAME_IDS)

function normalizeInferredTimeframe(raw: unknown): InferredBundleTimeframe {
  const text = String(raw || "")
    .toLowerCase()
    .replace(/\s+/g, "")
  if (!text || text === "unknown" || text.includes("unknown")) return "unknown"
  if (text.includes("week") || text === "w1" || text === "1w") return "weekly"
  if (text.includes("daily") || text === "d1" || text === "1d") return "daily"
  if (text.includes("h4") || text === "4h" || text.includes("240")) return "h4"
  if (text.includes("h1") || text === "1h" || (text.includes("60m") && !text.includes("15")))
    return "h1"
  if (text.includes("m15") || text === "15m" || text.includes("15min")) return "m15"
  if (text.includes("m5") || text === "5m" || text.includes("5min")) return "m5"
  return "unknown"
}

function displayLabelFor(tf: InferredBundleTimeframe, rawLabel?: string): string {
  if (tf === "unknown") return BUNDLE_TIMEFRAME_DISPLAY.unknown
  if (rawLabel?.trim()) return rawLabel.trim()
  return BUNDLE_TIMEFRAME_DISPLAY[tf]
}

function sortFramesTopDown(frames: TimeframeBundleFrame[]): TimeframeBundleFrame[] {
  const order = new Map(BUNDLE_TIMEFRAME_ORDER.map((tf, index) => [tf, index]))
  return [...frames].sort(
    (a, b) => (order.get(a.inferredTimeframe) ?? 99) - (order.get(b.inferredTimeframe) ?? 99),
  )
}

function buildInferredStack(frames: TimeframeBundleFrame[]): string {
  const labels = sortFramesTopDown(frames)
    .filter((f) => f.inferredTimeframe !== "unknown")
    .map((f) => f.displayLabel)
  if (labels.length === 0) {
    const unknownCount = frames.filter((f) => f.inferredTimeframe === "unknown").length
    return unknownCount > 0 ? `${unknownCount} chart(s) — timeframe unclear` : "No charts"
  }
  return labels.join("/")
}

function screenshotsFromFrames(frames: TimeframeBundleFrame[]): MtfScreenshotMap {
  const map: MtfScreenshotMap = {}
  for (const frame of sortFramesTopDown(frames)) {
    if (frame.inferredTimeframe === "unknown" || frame.inferredTimeframe === "m5") continue
    const tf = frame.inferredTimeframe as CoachMtfTimeframe
    if (COACH_MTF_SET.has(tf) && !map[tf]) {
      map[tf] = frame.imageUrl
    }
  }
  return map
}

function buildBundleVisionPrompt(imageCount: number, context: PreTradePlannedContext): string {
  return [
    "You are Vyronis AI analyzing a multi-timeframe chart bundle for a trader.",
    `You will receive ${imageCount} chart screenshot(s) in upload order (image index 0 = first uploaded).`,
    "",
    "For EACH image:",
    "1. Read visible timeframe text on the chart (TradingView labels, axis, toolbar).",
    '2. Infer timeframe: weekly, daily, h4, h1, m15, m5, or "unknown" if not visible.',
    '3. Use displayLabel like W1, D1, H4, H1, M15, M5, or "unknown timeframe".',
    "4. Note trend bias (bullish/bearish/neutral/mixed) and one-line structure read.",
    "",
    "Then synthesize top-down (Weekly → Daily → H4 → H1 → M15 → M5) — do NOT describe each image separately.",
    "Classify overall structureType: continuation | pullback | reversal | chop | unclear.",
    "Evaluate:",
    "- HTF alignment (do Weekly/Daily/H4 agree?)",
    "- Conflicts between timeframes",
    "- AOI / supply-demand zone quality",
    "- Entry timing (early, on-time, late)",
    "- Whether lower timeframe confirms higher timeframe",
    "",
    "Trader plan context:",
    `- Pair: ${context.pair || "unknown"}`,
    `- Direction: ${context.direction || "unknown"}`,
    `- Setup: ${context.setup || "unknown"}`,
    `- HTF note: ${context.higher_timeframe || "not specified"}`,
    "",
    "Response style example:",
    '"From the screenshots, I\'m reading this as D1/H4/H1/M15. Higher timeframe is bearish, but M15 entry is late."',
    "",
    "Return ONLY valid JSON:",
    `{`,
    `  "frames": [`,
    `    {`,
    `      "imageIndex": 0,`,
    `      "inferredTimeframe": "daily|weekly|h4|h1|m15|m5|unknown",`,
    `      "displayLabel": "D1|unknown timeframe|...",`,
    `      "trendBias": "bullish|bearish|neutral|mixed",`,
    `      "summary": "one sentence"`,
    `    }`,
    `  ],`,
    `  "inferredStack": "D1/H4/H1/M15",`,
    `  "comparisonSummary": "1-2 short sentences max — coach tone, conclusion first",`,
    `  "htfAlignment": "aligned|mixed|conflict|unclear",`,
    `  "conflicts": ["..."],`,
    `  "aoiQuality": "strong|acceptable|weak|unclear",`,
    `  "entryTiming": "early|on-time|late|unclear",`,
    `  "ltfConfirmsHtf": true|false|null,`,
    `  "structureType": "continuation|pullback|reversal|chop|unclear",`,
    `}`,
  ].join("\n")
}

type BundleAiPayload = {
  frames?: Array<{
    imageIndex?: number
    inferredTimeframe?: string
    displayLabel?: string
    trendBias?: string
    summary?: string
  }>
  inferredStack?: string
  comparisonSummary?: string
  htfAlignment?: string
  conflicts?: unknown
  aoiQuality?: string
  entryTiming?: string
  ltfConfirmsHtf?: boolean | null
  structureType?: string
}

function normalizeStructureType(raw: unknown): import("@/lib/intelligence/chart-review-format").ChartStructureType {
  const text = String(raw || "").toLowerCase()
  if (text.includes("continu")) return "continuation"
  if (text.includes("pull")) return "pullback"
  if (text.includes("revers")) return "reversal"
  if (text.includes("chop") || text.includes("range") || text.includes("messy")) return "chop"
  return "unclear"
}

function parseBundlePayload(
  raw: string,
  imageUrls: string[],
): Omit<TimeframeBundleAnalysis, "sessionId" | "mtfAnalysis"> {
  let parsed: BundleAiPayload
  try {
    parsed = JSON.parse(raw) as BundleAiPayload
  } catch {
    parsed = {}
  }

  const rawFrames = Array.isArray(parsed.frames) ? parsed.frames : []
  const frames: TimeframeBundleFrame[] = imageUrls.map((imageUrl, index) => {
    const match =
      rawFrames.find((f) => Number(f.imageIndex) === index) ?? rawFrames[index] ?? {}
    const inferredTimeframe = normalizeInferredTimeframe(match.inferredTimeframe)
    return {
      imageUrl,
      index,
      inferredTimeframe,
      displayLabel: displayLabelFor(inferredTimeframe, match.displayLabel),
      trendBias: String(match.trendBias || "neutral"),
      summary: String(match.summary || "Chart captured for bundle review."),
    }
  })

  const inferredStack = parsed.inferredStack?.trim() || buildInferredStack(frames)
  const conflicts = Array.isArray(parsed.conflicts)
    ? parsed.conflicts.map((c) => String(c).trim()).filter(Boolean).slice(0, 6)
    : []

  return {
    imageUrls,
    frames,
    inferredStack,
    comparisonSummary:
      parsed.comparisonSummary?.trim() ||
      `From the screenshots, I'm reading this as ${inferredStack}. Review the timeframe stack for alignment and entry timing.`,
    htfAlignment: String(parsed.htfAlignment || "unclear"),
    conflicts,
    aoiQuality: String(parsed.aoiQuality || "unclear"),
    entryTiming: String(parsed.entryTiming || "unclear"),
    ltfConfirmsHtf:
      parsed.ltfConfirmsHtf === true || parsed.ltfConfirmsHtf === false
        ? parsed.ltfConfirmsHtf
        : null,
    structureType: normalizeStructureType(parsed.structureType),
  }
}

async function analyzeBundleWithOpenAi(
  imageUrls: string[],
  context: PreTradePlannedContext,
): Promise<Omit<TimeframeBundleAnalysis, "sessionId">> {
  const openai = getOpenAiClient()
  if (!openai) throw new Error("OPENAI_API_KEY is not configured")

  const dataUrls = await Promise.all(
    imageUrls.map((url) => fetchImageDataUrl(url).catch(() => url)),
  )

  const completion = await openai.chat.completions.create({
    model: getOpenAiVisionModel(),
    temperature: 0.2,
    max_tokens: 2000,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: buildBundleVisionPrompt(imageUrls.length, context) },
          ...dataUrls.map((url) => ({
            type: "image_url" as const,
            image_url: { url, detail: "high" as const },
          })),
        ],
      },
    ],
  })

  const content = completion.choices[0]?.message?.content
  if (!content) throw new Error("OpenAI Vision returned an empty bundle response")

  const base = parseBundlePayload(content, imageUrls)
  const screenshots = screenshotsFromFrames(base.frames)
  let mtfAnalysis: TimeframeBundleAnalysis["mtfAnalysis"] = null

  if (Object.keys(screenshots).length > 0) {
    try {
      const visionResult = await analyzeMultiTimeframeWithVision({
        screenshots,
        context,
      })
      mtfAnalysis = visionResult.mtfAnalysis
      if (!base.comparisonSummary.includes("From the screenshots")) {
        base.comparisonSummary = visionResult.mtfAnalysis.summary
      }
    } catch (error) {
      console.error("Bundle MTF vision merge error:", error)
    }
  }

  return { ...base, mtfAnalysis }
}

async function analyzeBundleFallback(
  imageUrls: string[],
  context: PreTradePlannedContext,
): Promise<Omit<TimeframeBundleAnalysis, "sessionId">> {
  const visions = await Promise.all(
    imageUrls.map((imageUrl) =>
      analyzeChartVisionForContext(imageUrl, {
        ...context,
        chart_url: imageUrl,
        screenshot_url: imageUrl,
      }).catch(() => null),
    ),
  )

  const frames: TimeframeBundleFrame[] = imageUrls.map((imageUrl, index) => {
    const vision = visions[index]?.vision
    const trend = vision?.metrics.trendDirection ?? "neutral"
    return {
      imageUrl,
      index,
      inferredTimeframe: "unknown",
      displayLabel: BUNDLE_TIMEFRAME_DISPLAY.unknown,
      trendBias: trend,
      summary: vision?.summary ?? "Chart analyzed without visible timeframe label.",
    }
  })

  const htfTrends = frames.map((f) => f.trendBias).filter((t) => t !== "neutral")
  const uniqueTrends = new Set(htfTrends)
  const conflicts: string[] = []
  if (uniqueTrends.size > 1) {
    conflicts.push("Mixed trend reads across charts — timeframe labels were not visible.")
  }

  const inferredStack = buildInferredStack(frames)
  const comparisonSummary = `From the screenshots, I'm reading ${imageUrls.length} chart(s) as ${inferredStack}. Timeframe text wasn't clear on the charts — I'm treating each as unknown timeframe and comparing structure anyway. ${
    uniqueTrends.size <= 1 && htfTrends[0]
      ? `Overall structure looks ${htfTrends[0]}.`
      : "Higher and lower timeframes may conflict — confirm on chart labels before entry."
  }`

  return {
    imageUrls,
    frames,
    inferredStack,
    comparisonSummary,
    htfAlignment: uniqueTrends.size <= 1 ? "unclear" : "mixed",
    conflicts,
    aoiQuality: "unclear",
    entryTiming: "unclear",
    ltfConfirmsHtf: null,
    structureType: "unclear",
    mtfAnalysis: null,
  }
}

function bundleToChartVision(
  bundle: TimeframeBundleAnalysis,
  legacy: ChartAnalysisResult | null,
): ChartVisionResult | null {
  if (bundle.mtfAnalysis) {
    const chartAnalysis = legacy
    if (chartAnalysis?.vision) return chartAnalysis.vision
  }
  const primary = bundle.frames[0]
  if (!primary) return null
  const bias = primary.trendBias
  const trendDirection =
    bias === "bullish" ? "bullish" : bias === "bearish" ? "bearish" : bias === "mixed" ? "mixed" : "neutral"

  const overallBias = bundle.mtfAnalysis?.bias.overallBias ?? trendDirection
  const normalizedBias: ChartVisionResult["trendBias"] =
    overallBias === "bullish" ||
    overallBias === "bearish" ||
    overallBias === "mixed" ||
    overallBias === "neutral"
      ? overallBias
      : trendDirection

  return {
    version: 2,
    visionScore: bundle.mtfAnalysis?.visionScore ?? 55,
    detectedSetup: "Multi-timeframe bundle",
    trendBias: normalizedBias,
    warnings: bundle.conflicts,
    strengths: bundle.mtfAnalysis?.entry.entryStrengths ?? [],
    executionQuality: bundle.mtfAnalysis?.entry.entryConfirmationScore ?? 50,
    confidence: bundle.mtfAnalysis ? 72 : 48,
    provider: bundle.mtfAnalysis?.provider ?? "openai",
    analyzedAt: bundle.mtfAnalysis?.analyzedAt ?? new Date().toISOString(),
    metrics: {
      trendDirection: normalizedBias,
      emaAlignment: bundle.mtfAnalysis?.bias.biasAlignmentScore ?? 50,
      confirmationCandleQuality: bundle.mtfAnalysis?.entry.m15EntryQuality ?? 50,
      rrQuality: 50,
      impulsiveEntryDistance: 50,
      supportResistanceProximity: 50,
      breakoutVsRetest: "unknown",
      volatilityState: "normal",
      overextendedMove: bundle.entryTiming === "late",
      countertrend: bundle.htfAlignment === "conflict" || bundle.htfAlignment === "mixed",
    },
    insights: [
      `Stack: ${bundle.inferredStack}`,
      `HTF alignment: ${bundle.htfAlignment}`,
      `AOI: ${bundle.aoiQuality}`,
      `Entry timing: ${bundle.entryTiming}`,
    ],
    summary: bundle.comparisonSummary,
  }
}

function buildBundleChecklist(bundle: TimeframeBundleAnalysis) {
  const items = [
    {
      label: "Inferred stack",
      value: bundle.inferredStack,
      status: bundle.frames.some((f) => f.inferredTimeframe === "unknown")
        ? ("warn" as const)
        : ("good" as const),
    },
    {
      label: "HTF alignment",
      value: bundle.htfAlignment,
      status:
        bundle.htfAlignment === "aligned"
          ? ("good" as const)
          : bundle.htfAlignment === "conflict"
            ? ("warn" as const)
            : ("neutral" as const),
    },
    {
      label: "AOI quality",
      value: bundle.aoiQuality,
      status:
        bundle.aoiQuality === "strong"
          ? ("good" as const)
          : bundle.aoiQuality === "weak"
            ? ("warn" as const)
            : ("neutral" as const),
    },
    {
      label: "Entry timing",
      value: bundle.entryTiming,
      status:
        bundle.entryTiming === "on-time"
          ? ("good" as const)
          : bundle.entryTiming === "late" || bundle.entryTiming === "early"
            ? ("warn" as const)
            : ("neutral" as const),
    },
    {
      label: "LTF confirms HTF",
      value:
        bundle.ltfConfirmsHtf === true
          ? "Yes"
          : bundle.ltfConfirmsHtf === false
            ? "No"
            : "Unclear",
      status:
        bundle.ltfConfirmsHtf === true
          ? ("good" as const)
          : bundle.ltfConfirmsHtf === false
            ? ("warn" as const)
            : ("neutral" as const),
    },
  ]

  if (bundle.mtfAnalysis) {
    const vision = bundleToChartVision(bundle, null)
    return vision ? [...items, ...buildVisionChecklist(vision).slice(0, 3)] : items
  }

  return items
}

export function serializeBundleVisionForLlm(bundle: TimeframeBundleAnalysis): string {
  const frameLines = sortFramesTopDown(bundle.frames)
    .map(
      (f) =>
        `- Image ${f.index + 1} (${f.displayLabel}): ${f.trendBias} — ${f.summary}`,
    )
    .join("\n")

  const conflictBlock =
    bundle.conflicts.length > 0
      ? bundle.conflicts.map((c) => `- ${c}`).join("\n")
      : "- None flagged"

  return [
    "## Multi-timeframe chart bundle (vision ground truth)",
    `Bundle session: ${bundle.sessionId}`,
    `Inferred stack: ${bundle.inferredStack}`,
    `Summary: ${bundle.comparisonSummary}`,
    `HTF alignment: ${bundle.htfAlignment}`,
    `AOI quality: ${bundle.aoiQuality}`,
    `Entry timing: ${bundle.entryTiming}`,
    `LTF confirms HTF: ${bundle.ltfConfirmsHtf === true ? "yes" : bundle.ltfConfirmsHtf === false ? "no" : "unclear"}`,
    `Structure type: ${bundle.structureType}`,
    "Per-chart reads:",
    frameLines,
    "Conflicts:",
    conflictBlock,
    bundle.mtfAnalysis
      ? `MTF scores: bias ${bundle.mtfAnalysis.bias.biasAlignmentScore}/100, entry ${bundle.mtfAnalysis.entry.entryConfirmationScore}/100, overall ${bundle.mtfAnalysis.visionScore}/100.`
      : "",
  ]
    .filter(Boolean)
    .join("\n")
}

export function buildBundleConversationReply(
  bundle: TimeframeBundleAnalysis,
  options?: {
    traderName?: string | null
    memoryLine?: string | null
    decisionLine?: string | null
  },
): string {
  const name = options?.traderName?.split(" ")[0] || "you"
  const summary = bundle.comparisonSummary.split(".").slice(0, 2).join(".").trim()
  const parts = [
    `${name}, from the screenshots I'm reading **${bundle.inferredStack}**.`,
    summary || bundle.comparisonSummary,
  ]

  if (bundle.structureType !== "unclear") {
    parts.push(`This reads as **${bundle.structureType}** structure.`)
  }
  if (bundle.conflicts.length > 0) {
    parts.push(`Heads-up: ${bundle.conflicts[0]}.`)
  }
  if (options?.memoryLine) {
    parts.push(options.memoryLine)
  }
  if (options?.decisionLine) {
    parts.push(options.decisionLine)
  }

  return parts.filter(Boolean).join(" ")
}

export async function analyzeCommandCenterBundle(input: {
  imageUrls: string[]
  plannedContext?: PreTradePlannedContext | null
}): Promise<CommandCenterVisionAnalysis> {
  const imageUrls = input.imageUrls.slice(0, MAX_BUNDLE_IMAGES)
  const primaryUrl = imageUrls[0] ?? ""
  const context = input.plannedContext ?? {}

  if (imageUrls.length === 0) {
    return {
      available: false,
      imageUrl: "",
      imageUrls: [],
      vision: null,
      legacy: null,
      summary: BUNDLE_FALLBACK,
      checklist: [],
    }
  }

  if (!isOpenAiConfigured()) {
    const partial = await analyzeBundleFallback(imageUrls, context)
    const bundle: TimeframeBundleAnalysis = { sessionId: randomUUID(), ...partial }
    const vision = bundleToChartVision(bundle, null)
    const legacy = vision ? chartVisionToLegacyAnalysis(vision) : null
    return {
      available: false,
      imageUrl: primaryUrl,
      imageUrls,
      bundle,
      vision,
      legacy,
      summary: BUNDLE_FALLBACK,
      checklist: buildBundleChecklist(bundle),
    }
  }

  try {
    const partial = await analyzeBundleWithOpenAi(imageUrls, context)
    const bundle: TimeframeBundleAnalysis = { sessionId: randomUUID(), ...partial }

    const mtfLegacy = bundle.mtfAnalysis
      ? mtfAnalysisToChartAnalysis(bundle.mtfAnalysis, context)
      : null
    const vision = bundleToChartVision(bundle, mtfLegacy)
    const legacy =
      mtfLegacy ?? (vision ? chartVisionToLegacyAnalysis(vision) : null)

    return {
      available: true,
      imageUrl: primaryUrl,
      imageUrls,
      bundle,
      vision,
      legacy,
      summary: bundle.comparisonSummary,
      checklist: buildBundleChecklist(bundle),
    }
  } catch (error) {
    console.error("Command center bundle vision error:", error)
    const partial = await analyzeBundleFallback(imageUrls, context)
    const bundle: TimeframeBundleAnalysis = { sessionId: randomUUID(), ...partial }
    const vision = bundleToChartVision(bundle, null)
    return {
      available: false,
      imageUrl: primaryUrl,
      imageUrls,
      bundle,
      vision,
      legacy: vision ? chartVisionToLegacyAnalysis(vision) : null,
      summary: BUNDLE_FALLBACK,
      checklist: buildBundleChecklist(bundle),
    }
  }
}
