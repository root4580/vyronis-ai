import type { SupabaseClient } from "@supabase/supabase-js"
import { MTF_SLOTS, type CoachMtfTimeframe } from "@/lib/coach/mtf-constants"
import type { ChartVisionResult } from "@/lib/coach/types"
import type { TimeframeBundleAnalysis } from "@/lib/intelligence/command-center-bundle-types"
import { mergeMtfIntoContext } from "@/lib/trade-coach/mtf-session"
import type { ChartAnalysisResult, PreTradePlannedContext, TradeCoachSessionRecord } from "@/lib/trade-coach/types"

export async function linkChartAnalysisToCoachSession(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  input: {
    imageUrl: string
    vision: ChartVisionResult
    legacy: ChartAnalysisResult
  },
): Promise<void> {
  const { data: session, error } = await supabase
    .from("trade_coach_sessions")
    .select("planned_context, status")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error || !session || session.status !== "in_progress") return

  const context = (session.planned_context || {}) as PreTradePlannedContext
  const updatedContext: PreTradePlannedContext = {
    ...context,
    chart_url: input.imageUrl,
    screenshot_url: input.imageUrl,
    vision_score: input.vision.visionScore,
    chart_analysis: input.legacy,
  }

  await supabase
    .from("trade_coach_sessions")
    .update({
      planned_context: updatedContext,
      chart_url: input.imageUrl,
      screenshot_url: input.imageUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("user_id", userId)
}

function screenshotsFromBundle(bundle: TimeframeBundleAnalysis): Partial<
  Record<CoachMtfTimeframe, string>
> {
  const map: Partial<Record<CoachMtfTimeframe, string>> = {}
  for (const frame of bundle.frames) {
    if (frame.inferredTimeframe === "unknown" || frame.inferredTimeframe === "m5") continue
    const tf = frame.inferredTimeframe as CoachMtfTimeframe
    if (!map[tf]) map[tf] = frame.imageUrl
  }
  return map
}

export async function linkBundleAnalysisToCoachSession(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  input: {
    bundle: TimeframeBundleAnalysis
    vision: ChartVisionResult
    legacy: ChartAnalysisResult
  },
): Promise<void> {
  const { data: session, error } = await supabase
    .from("trade_coach_sessions")
    .select(
      "planned_context, status, weekly_screenshot_url, daily_screenshot_url, h4_screenshot_url, h1_screenshot_url, m15_screenshot_url, screenshot_url, chart_url",
    )
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error || !session || session.status !== "in_progress") return

  const context = (session.planned_context || {}) as PreTradePlannedContext
  const shotMap = screenshotsFromBundle(input.bundle)
  const primaryUrl =
    shotMap.m15 ||
    shotMap.h1 ||
    shotMap.h4 ||
    shotMap.daily ||
    shotMap.weekly ||
    input.bundle.imageUrls[0] ||
    null

  const mtfAnalysis = input.bundle.mtfAnalysis
  let updatedContext: PreTradePlannedContext = {
    ...context,
    chart_url: primaryUrl || undefined,
    screenshot_url: primaryUrl,
    vision_score: input.vision.visionScore,
    chart_analysis: input.legacy,
    timeframe_bundle_id: input.bundle.sessionId,
    timeframe_bundle: {
      sessionId: input.bundle.sessionId,
      imageUrls: input.bundle.imageUrls,
      inferredStack: input.bundle.inferredStack,
      comparisonSummary: input.bundle.comparisonSummary,
      frames: input.bundle.frames.map((f) => ({
        index: f.index,
        imageUrl: f.imageUrl,
        inferredTimeframe: f.inferredTimeframe,
        displayLabel: f.displayLabel,
      })),
    },
  }

  if (mtfAnalysis) {
    updatedContext = mergeMtfIntoContext(updatedContext, session as TradeCoachSessionRecord, mtfAnalysis)
    updatedContext.mtf_analysis = mtfAnalysis
  }

  const rowUpdate: Record<string, unknown> = {
    planned_context: updatedContext,
    chart_url: primaryUrl,
    screenshot_url: primaryUrl,
    updated_at: new Date().toISOString(),
  }

  for (const slot of MTF_SLOTS) {
    const url = shotMap[slot.id]
    if (url) rowUpdate[slot.urlField] = url
  }

  if (mtfAnalysis) {
    rowUpdate.mtf_analysis = mtfAnalysis
    rowUpdate.bias_alignment_score = mtfAnalysis.bias.biasAlignmentScore
    rowUpdate.entry_confirmation_score = mtfAnalysis.entry.entryConfirmationScore
    rowUpdate.vision_score = mtfAnalysis.visionScore
    rowUpdate.recommendation = mtfAnalysis.recommendation
    if (mtfAnalysis.visualAnalysis) {
      rowUpdate.visual_analysis = mtfAnalysis.visualAnalysis
      rowUpdate.chart_annotations = mtfAnalysis.visualAnalysis.chartAnnotations ?? {}
      rowUpdate.vision_analyzed_at = mtfAnalysis.visualAnalysis.analyzedAt
    }
  }

  await supabase
    .from("trade_coach_sessions")
    .update(rowUpdate)
    .eq("id", sessionId)
    .eq("user_id", userId)
}
