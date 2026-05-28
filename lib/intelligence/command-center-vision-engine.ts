import { isOpenAiConfigured } from "@/lib/ai/providers/openai-provider"
import type { ChartVisionResult } from "@/lib/coach/types"
import {
  analyzeChartVisionForContext,
} from "@/lib/coach/chart-vision-engine"
import { buildChartAnalysisMessages } from "@/lib/trade-coach/chart-analysis-engine"
import type { ChartAnalysisResult, PreTradePlannedContext } from "@/lib/trade-coach/types"
import type { TimeframeBundleAnalysis } from "@/lib/intelligence/command-center-bundle-types"

export type CommandCenterVisionAnalysis = {
  available: boolean
  imageUrl: string
  /** Present when multiple charts were uploaded as one bundle session. */
  imageUrls?: string[]
  bundle?: TimeframeBundleAnalysis | null
  vision: ChartVisionResult | null
  legacy: ChartAnalysisResult | null
  summary: string
  checklist: Array<{ label: string; value: string; status: "good" | "warn" | "neutral" }>
}

export { analyzeCommandCenterBundle } from "@/lib/intelligence/command-center-bundle-vision-engine"

const VISION_FALLBACK =
  "Image received. Vision analysis needs OpenAI key enabled."

function trendLabel(value: ChartVisionResult["metrics"]["trendDirection"]): string {
  switch (value) {
    case "bullish":
      return "Bullish"
    case "bearish":
      return "Bearish"
    case "mixed":
      return "Mixed / unclear"
    default:
      return "Neutral / ranging"
  }
}

function scoreLabel(score: number): "good" | "warn" | "neutral" {
  if (score >= 70) return "good"
  if (score < 50) return "warn"
  return "neutral"
}

export function buildVisionChecklist(vision: ChartVisionResult) {
  const { metrics } = vision
  return [
    {
      label: "Trend direction",
      value: trendLabel(metrics.trendDirection),
      status: metrics.countertrend ? ("warn" as const) : ("good" as const),
    },
    {
      label: "HTF / EMA alignment",
      value: `${metrics.emaAlignment}% aligned`,
      status: scoreLabel(metrics.emaAlignment),
    },
    {
      label: "Confirmation quality",
      value: `${metrics.confirmationCandleQuality}%`,
      status: scoreLabel(metrics.confirmationCandleQuality),
    },
    {
      label: "Risk:reward structure",
      value: `${metrics.rrQuality}%`,
      status: scoreLabel(metrics.rrQuality),
    },
    {
      label: "Breakout vs retest",
      value: metrics.breakoutVsRetest,
      status: metrics.breakoutVsRetest === "retest" ? ("good" as const) : ("neutral" as const),
    },
    {
      label: "Volatility",
      value: metrics.volatilityState,
      status: metrics.volatilityState === "expanded" ? ("warn" as const) : ("neutral" as const),
    },
    {
      label: "Overextended entry",
      value: metrics.overextendedMove ? "Yes — caution" : "No",
      status: metrics.overextendedMove ? ("warn" as const) : ("good" as const),
    },
    {
      label: "Counter-trend risk",
      value: metrics.countertrend ? "Elevated" : "Low",
      status: metrics.countertrend ? ("warn" as const) : ("good" as const),
    },
  ]
}

export function serializeVisionForLlm(analysis: CommandCenterVisionAnalysis): string {
  if (!analysis.vision) return ""

  const checklist = analysis.checklist
    .map((item) => `- ${item.label}: ${item.value}`)
    .join("\n")

  const warnings = analysis.vision.warnings.length
    ? analysis.vision.warnings.map((w) => `- ${w}`).join("\n")
    : "- None flagged"

  const strengths = analysis.vision.strengths.length
    ? analysis.vision.strengths.map((s) => `- ${s}`).join("\n")
    : "- None highlighted"

  return [
    "## Chart vision analysis (ground truth from screenshot)",
    `Setup detected: ${analysis.vision.detectedSetup}`,
    `Trend bias: ${analysis.vision.trendBias}`,
    `Vision score: ${analysis.vision.visionScore}/100`,
    `Execution quality: ${analysis.vision.executionQuality}/100`,
    `Summary: ${analysis.vision.summary}`,
    "Checklist:",
    checklist,
    "Warnings:",
    warnings,
    "Strengths:",
    strengths,
    "Insights:",
    ...analysis.vision.insights.map((i) => `- ${i}`),
  ].join("\n")
}

export async function analyzeCommandCenterChart(input: {
  imageUrl: string
  plannedContext?: PreTradePlannedContext | null
}): Promise<CommandCenterVisionAnalysis> {
  const context = input.plannedContext ?? {}

  if (!isOpenAiConfigured()) {
    return {
      available: false,
      imageUrl: input.imageUrl,
      vision: null,
      legacy: null,
      summary: VISION_FALLBACK,
      checklist: [],
    }
  }

  try {
    const { vision, legacy } = await analyzeChartVisionForContext(input.imageUrl, {
      ...context,
      chart_url: input.imageUrl,
      screenshot_url: input.imageUrl,
    })

    const checklist = buildVisionChecklist(vision)
    const summary = [vision.summary, ...buildChartAnalysisMessages(legacy).slice(0, 2)].join(" ")

    return {
      available: true,
      imageUrl: input.imageUrl,
      vision,
      legacy,
      summary,
      checklist,
    }
  } catch (error) {
    console.error("Command center vision error:", error)
    return {
      available: false,
      imageUrl: input.imageUrl,
      vision: null,
      legacy: null,
      summary: VISION_FALLBACK,
      checklist: [],
    }
  }
}

export function buildVisionConversationReply(
  analysis: CommandCenterVisionAnalysis,
  options?: {
    traderName?: string | null
    memoryLine?: string | null
  },
): string {
  if (!analysis.available || !analysis.vision) {
    return VISION_FALLBACK
  }

  const name = options?.traderName?.split(" ")[0] || "you"
  const vision = analysis.vision
  const trend = trendLabel(vision.metrics.trendDirection)
  const summary = vision.summary.split(".").slice(0, 2).join(".").trim()

  const parts = [
    `${name}, quick chart read — **${trend}** on ${vision.detectedSetup} (${vision.visionScore}/100).`,
    summary || vision.summary,
  ]

  if (vision.warnings.length > 0) {
    parts.push(vision.warnings[0])
  }
  if (options?.memoryLine) {
    parts.push(options.memoryLine)
  }

  return parts.filter(Boolean).join(" ")
}
