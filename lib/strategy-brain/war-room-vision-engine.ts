import { getOpenAiClient, getOpenAiVisionModel, isOpenAiConfigured } from "@/lib/ai/providers/openai-provider"
import { fetchImageDataUrl } from "@/lib/ai/providers/vision-shared"
import {
  analyzeChartVisionForContext,
} from "@/lib/coach/chart-vision-engine"
import type { BiasDirection } from "@/lib/strategy-brain/types"
import type { WarRoomVisionAutofill, WarRoomVisionFrame } from "@/lib/strategy-brain/war-room-vision-types"

const MAX_IMAGES = 6

function normalizePairSymbol(raw: unknown, hint?: string): string {
  const text = String(raw || hint || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
  if (text.length >= 6) return text.slice(0, 6)
  if (text.length >= 3) return text
  return hint?.toUpperCase().replace(/[^A-Z]/g, "") || "EURUSD"
}

function normalizeBiasDirection(raw: unknown): BiasDirection {
  const text = String(raw || "").toLowerCase()
  if (text.includes("bull")) return "Bullish"
  if (text.includes("bear")) return "Bearish"
  return "Neutral"
}

function parsePrice(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null
  const parsed = Number(String(raw).replace(/,/g, ""))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function ensureAoiOrder(low: number | null, high: number | null): {
  aoi_low: number | null
  aoi_high: number | null
} {
  if (low == null || high == null) return { aoi_low: low, aoi_high: high }
  if (low <= high) return { aoi_low: low, aoi_high: high }
  return { aoi_low: high, aoi_high: low }
}

function buildWarRoomVisionPrompt(imageCount: number, pairHint?: string): string {
  return [
    "You are Vyronis AI filling a forex trader's Weekly War Room from TradingView screenshots.",
    `You receive ${imageCount} chart image(s) in upload order (index 0 = first uploaded).`,
    "",
    "For EACH image:",
    "1. Read the symbol from the chart title (e.g. EUR/USD → EURUSD).",
    "2. Read the timeframe from toolbar/axis (Weekly, Daily, 4H, 1H, 15m, etc.).",
    "3. Read visible price axis labels and any drawn zones (rectangles, horizontal lines, arrows).",
    "4. Infer trend bias: Bullish, Bearish, or Neutral for that timeframe.",
    "",
    "Synthesize top-down (Weekly → Daily → H4 → H1 → M15):",
    "- Weekly directional bias for the pair this week",
    "- AOI zone: numeric low/high from the main supply/demand or consolidation box on H4 or Daily (use axis prices)",
    "- Invalidation: price where the weekly idea is wrong (below AOI for shorts, above for longs)",
    "- One-line weekly thesis and short execution notes",
    "- Market bias engine fields: weekly_bias, daily_bias, h4_bias (Bullish|Bearish|Neutral)",
    "",
    pairHint ? `Trader hint pair: ${pairHint}` : "",
    "If prices are not clearly readable, return null for aoi_low/aoi_high/invalidation — do not guess random small integers.",
    "",
    "Return ONLY valid JSON:",
    `{`,
    `  "pair": "EURUSD",`,
    `  "directional_bias": "Bullish|Bearish|Neutral",`,
    `  "aoi_low": number|null,`,
    `  "aoi_high": number|null,`,
    `  "invalidation": number|null,`,
    `  "weekly_thesis": "one sentence",`,
    `  "notes": "execution notes",`,
    `  "weekly_bias": "Bullish|Bearish|Neutral",`,
    `  "daily_bias": "Bullish|Bearish|Neutral",`,
    `  "h4_bias": "Bullish|Bearish|Neutral",`,
    `  "confidence": 0-100,`,
    `  "inferredStack": "W1/D1/H4/H1/M15",`,
    `  "comparisonSummary": "2 sentences max — structure + what would make it tradable",`,
    `  "setupGrade": "A|B|C|D|F",`,
    `  "recommendation": "TAKE|CAUTION|SKIP",`,
    `  "frames": [`,
    `    {`,
    `      "imageIndex": 0,`,
    `      "inferredTimeframe": "weekly|daily|h4|h1|m15|unknown",`,
    `      "displayLabel": "W1|D1|H4|...",`,
    `      "trendBias": "Bullish|Bearish|Neutral",`,
    `      "summary": "one sentence"`,
    `    }`,
    `  ]`,
    `}`,
  ]
    .filter(Boolean)
    .join("\n")
}

type AiPayload = {
  pair?: string
  directional_bias?: string
  aoi_low?: unknown
  aoi_high?: unknown
  invalidation?: unknown
  weekly_thesis?: string
  notes?: string
  weekly_bias?: string
  daily_bias?: string
  h4_bias?: string
  confidence?: unknown
  inferredStack?: string
  comparisonSummary?: string
  setupGrade?: string
  recommendation?: string
  frames?: Array<{
    imageIndex?: number
    inferredTimeframe?: string
    displayLabel?: string
    trendBias?: string
    summary?: string
  }>
}

function parsePayload(
  raw: string,
  imageUrls: string[],
  pairHint?: string,
): WarRoomVisionAutofill {
  let parsed: AiPayload = {}
  try {
    parsed = JSON.parse(raw) as AiPayload
  } catch {
    parsed = {}
  }

  const aoi = ensureAoiOrder(parsePrice(parsed.aoi_low), parsePrice(parsed.aoi_high))

  const frames: WarRoomVisionFrame[] = imageUrls.map((_, index) => {
    const match =
      parsed.frames?.find((f) => Number(f.imageIndex) === index) ?? parsed.frames?.[index] ?? {}
    return {
      imageIndex: index,
      inferredTimeframe: String(match.inferredTimeframe || "unknown"),
      displayLabel: String(match.displayLabel || `Chart ${index + 1}`),
      trendBias: normalizeBiasDirection(match.trendBias),
      summary: String(match.summary || "").slice(0, 280),
    }
  })

  return {
    available: true,
    pair: normalizePairSymbol(parsed.pair, pairHint),
    directional_bias: normalizeBiasDirection(parsed.directional_bias),
    ...aoi,
    invalidation: parsePrice(parsed.invalidation),
    weekly_thesis: String(parsed.weekly_thesis || "").slice(0, 500),
    notes: String(parsed.notes || "").slice(0, 500),
    weekly_bias: normalizeBiasDirection(parsed.weekly_bias),
    daily_bias: normalizeBiasDirection(parsed.daily_bias),
    h4_bias: normalizeBiasDirection(parsed.h4_bias),
    confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 55)),
    inferredStack: String(parsed.inferredStack || frames.map((f) => f.displayLabel).join("/")),
    comparisonSummary: String(parsed.comparisonSummary || "Charts analyzed."),
    frames,
    setupGrade: parsed.setupGrade,
    recommendation: parsed.recommendation,
  }
}

async function analyzeWithOpenAi(
  imageUrls: string[],
  pairHint?: string,
): Promise<WarRoomVisionAutofill> {
  const openai = getOpenAiClient()
  if (!openai) throw new Error("OPENAI_API_KEY is not configured")

  const dataUrls = await Promise.all(
    imageUrls.map((url) => fetchImageDataUrl(url).catch(() => url)),
  )

  const completion = await openai.chat.completions.create({
    model: getOpenAiVisionModel(),
    temperature: 0.2,
    max_tokens: 2200,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: buildWarRoomVisionPrompt(imageUrls.length, pairHint) },
          ...dataUrls.map((url) => ({
            type: "image_url" as const,
            image_url: { url, detail: "high" as const },
          })),
        ],
      },
    ],
  })

  const content = completion.choices[0]?.message?.content
  if (!content) throw new Error("Vision returned an empty response")
  return parsePayload(content, imageUrls, pairHint)
}

async function analyzeFallback(
  imageUrls: string[],
  pairHint?: string,
): Promise<WarRoomVisionAutofill> {
  const visions = await Promise.all(
    imageUrls.map((url) =>
      analyzeChartVisionForContext(url, {
        pair: pairHint,
        chart_url: url,
        screenshot_url: url,
      }).catch(() => null),
    ),
  )

  const trends = visions
    .map((v) => v?.vision?.metrics.trendDirection)
    .filter((t) => t === "bullish" || t === "bearish" || t === "neutral" || t === "mixed")
  const bearish = trends.filter((t) => t === "bearish").length
  const bullish = trends.filter((t) => t === "bullish").length
  const directional_bias: BiasDirection =
    bearish > bullish ? "Bearish" : bullish > bearish ? "Bullish" : "Neutral"

  const summaries = visions
    .map((v, i) => v?.vision?.summary)
    .filter(Boolean)
    .slice(0, 3)

  return {
    available: true,
    pair: normalizePairSymbol(pairHint, pairHint),
    directional_bias,
    aoi_low: null,
    aoi_high: null,
    invalidation: null,
    weekly_thesis: summaries[0]?.slice(0, 500) || "Structure read from charts — add AOI prices manually.",
    notes: "Timeframe labels not parsed in fallback mode. Enable OpenAI for full autofill.",
    weekly_bias: directional_bias,
    daily_bias: directional_bias,
    h4_bias: "Neutral",
    confidence: 42,
    inferredStack: `${imageUrls.length} chart(s)`,
    comparisonSummary:
      summaries.join(" ") ||
      "Heuristic read only — set OPENAI_API_KEY for TradingView price and zone extraction.",
    frames: imageUrls.map((_, index) => ({
      imageIndex: index,
      inferredTimeframe: "unknown",
      displayLabel: `Chart ${index + 1}`,
      trendBias: normalizeBiasDirection(visions[index]?.vision?.metrics.trendDirection),
      summary: visions[index]?.vision?.summary?.slice(0, 200) || "",
    })),
  }
}

export async function analyzeWarRoomCharts(input: {
  imageUrls: string[]
  pairHint?: string
}): Promise<WarRoomVisionAutofill> {
  const imageUrls = input.imageUrls.filter(Boolean).slice(0, MAX_IMAGES)
  if (imageUrls.length === 0) {
    throw new Error("Upload at least one chart screenshot")
  }

  if (isOpenAiConfigured()) {
    try {
      return await analyzeWithOpenAi(imageUrls, input.pairHint)
    } catch (error) {
      console.error("War room OpenAI vision error:", error)
      return analyzeFallback(imageUrls, input.pairHint)
    }
  }

  return {
    ...(await analyzeFallback(imageUrls, input.pairHint)),
    available: false,
    comparisonSummary:
      "OpenAI is not configured. Add OPENAI_API_KEY in .env.local for full autofill (pair, AOI prices, HTF bias).",
  }
}
