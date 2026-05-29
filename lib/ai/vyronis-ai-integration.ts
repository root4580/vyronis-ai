/**
 * Vyronis AI Router — feature wiring (server-side only).
 */
import {
  getConfiguredVyronisAIProviders,
  runVyronisAI,
} from "@/lib/ai/ai-router"
import type { AiDebriefTextInput } from "@/lib/ai/providers/provider-interface"
import type { SetupGrade } from "@/lib/strategy-brain/types"
import type {
  TradingViewChartVisionSnapshot,
  TradingViewSignalAnalysis,
  TradingViewWhyEngine,
} from "@/lib/tradingview/types"
import type { VyronisAIGrade, VyronisAIResponse } from "@/lib/ai/vyronis-ai-types"

export type VyronisAIEnrichment = {
  provider: string
  score: number
  grade: VyronisAIGrade
  summary: string
  reasons: string[]
  warnings: string[]
  confidence: number
  is_mock: boolean
}

export function isVyronisMockResponse(response: VyronisAIResponse): boolean {
  return response.provider.startsWith("mock-")
}

export function toVyronisAIEnrichment(response: VyronisAIResponse): VyronisAIEnrichment {
  return {
    provider: response.provider,
    score: response.score,
    grade: response.grade,
    summary: response.summary,
    reasons: response.reasons,
    warnings: response.warnings,
    confidence: response.confidence,
    is_mock: isVyronisMockResponse(response),
  }
}

/** Map router grades (A+|A|B|Skip) to journal / War Room SetupGrade (A+|B|C|D). */
export function mapVyronisGradeToSetupGrade(grade: VyronisAIGrade): SetupGrade {
  switch (grade) {
    case "A+":
      return "A+"
    case "A":
      return "B"
    case "B":
      return "C"
    case "Skip":
      return "D"
    default:
      return "C"
  }
}

export function hasVyronisAIConfigured(): boolean {
  return getConfiguredVyronisAIProviders().length > 0
}

export function mergeVyronisIntoWhyEngine(
  why: TradingViewWhyEngine,
  ai: VyronisAIEnrichment,
): TradingViewWhyEngine {
  if (ai.is_mock) {
    return { ...why, ai_router: ai }
  }

  const strengths = [...new Set([...why.strengths, ...ai.reasons])].slice(0, 8)
  const weaknesses = [...new Set([...why.weaknesses])].slice(0, 6)
  const warnings = [...new Set([...why.warnings, ...ai.warnings])].slice(0, 8)
  const memory_insights = [...why.memory_insights]
  if (ai.summary) {
    memory_insights.unshift(`AI (${ai.provider}): ${ai.summary}`)
  }

  const blendedConfidence = Math.round(why.confidence_score * 0.65 + ai.confidence * 0.35)

  return {
    ...why,
    ai_router: ai,
    headline: ai.summary ? `${why.headline} · ${ai.summary}` : why.headline,
    confidence_score: blendedConfidence,
    strengths,
    weaknesses,
    warnings,
    memory_insights: memory_insights.slice(0, 6),
    recommendation:
      ai.grade === "Skip"
        ? "Skip — AI agrees this is below your A+ bar."
        : ai.grade === "A+" || ai.grade === "A"
          ? why.recommendation
          : `${why.recommendation} AI grade: ${ai.grade}.`,
  }
}

export function vyronisSnapshotFromScreenshotAI(
  imageUrl: string,
  imageSource: TradingViewChartVisionSnapshot["image_source"],
  ai: VyronisAIEnrichment,
): TradingViewChartVisionSnapshot {
  return {
    available: true,
    image_source: imageSource,
    image_url: imageUrl,
    vision_score: ai.score,
    summary: ai.summary,
    warnings: ai.warnings.slice(0, 5),
    strengths: ai.reasons.slice(0, 5),
    analyzed_at: new Date().toISOString(),
  }
}

export async function enrichTradingSetupWithVyronisAI(input: {
  symbol: string
  direction: "BUY" | "SELL"
  analysis: TradingViewSignalAnalysis
  why_engine: TradingViewWhyEngine
}): Promise<TradingViewWhyEngine> {
  if (!hasVyronisAIConfigured()) {
    return input.why_engine
  }

  const response = await runVyronisAI({
    taskType: "trading_setup_grading",
    prompt: [
      "Grade this TradingView alert for a disciplined prop-style trader.",
      "Respect War Room alignment, memory similarity, and minimum A+ bar.",
      "Be concise; reasons must be actionable.",
    ].join(" "),
    data: {
      symbol: input.symbol,
      direction: input.direction,
      setup_grade: input.analysis.setup_grade,
      setup_verdict: input.analysis.setup_verdict,
      war_room: input.analysis.war_room,
      recommendation: input.analysis.recommendation,
      summary: input.analysis.summary,
      why_engine: {
        headline: input.why_engine.headline,
        grade_passed: input.why_engine.grade_passed,
        pass_reasons: input.why_engine.pass_reasons,
        fail_reasons: input.why_engine.fail_reasons,
        memory_narrative: input.why_engine.memory_similarity.narrative,
        historical_confidence: input.why_engine.historical_confidence,
      },
    },
  })

  return mergeVyronisIntoWhyEngine(input.why_engine, toVyronisAIEnrichment(response))
}

export async function analyzeScreenshotWithVyronisRouter(input: {
  imageUrl: string
  symbol: string
  direction: "BUY" | "SELL"
  plannedSummary?: string
}): Promise<VyronisAIEnrichment | null> {
  if (!hasVyronisAIConfigured()) return null

  const response = await runVyronisAI({
    taskType: "screenshot_analysis",
    prompt: [
      "Analyze this chart screenshot for a pre-trade decision.",
      `Pair ${input.symbol} ${input.direction}.`,
      input.plannedSummary || "",
      "Note structure, AOI, momentum, and obvious invalidation.",
    ]
      .filter(Boolean)
      .join(" "),
    data: { imageUrl: input.imageUrl, image_url: input.imageUrl },
  })

  const enrichment = toVyronisAIEnrichment(response)
  return enrichment.is_mock ? null : enrichment
}

export async function generateFinalSummaryWithVyronisRouter(
  input: AiDebriefTextInput,
): Promise<{ narrative: string | null; provider: string | null }> {
  const response = await runVyronisAI({
    taskType: "final_summary",
    prompt: [
      "Write a 2–4 sentence weekly trading debrief for the trader.",
      "Focus on discipline, recurring mistakes, and one concrete improvement.",
      "Do not invent trades or stats not in the structured input.",
    ].join(" "),
    data: {
      summary: input.summary,
      tradeCount: input.tradeCount,
      winRate: input.winRate,
      recurringMistakes: input.recurringMistakes,
      extraPrompt: input.prompt,
    },
  })

  if (isVyronisMockResponse(response)) {
    return { narrative: null, provider: null }
  }

  const narrative = [
    response.summary,
    ...response.reasons.slice(0, 2),
    response.warnings[0] ? `Watch: ${response.warnings[0]}` : null,
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 600)

  return { narrative, provider: response.provider }
}
