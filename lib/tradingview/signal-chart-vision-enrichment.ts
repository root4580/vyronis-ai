import type { SupabaseClient } from "@supabase/supabase-js"
import { isOpenAiConfigured } from "@/lib/ai/providers/openai-provider"
import { analyzeChartVisionForContext } from "@/lib/coach/chart-vision-engine"
import { linkChartAnalysisToCoachSession } from "@/lib/intelligence/command-center-chart-link"
import { getWeeklyPlanWithPairs } from "@/lib/strategy-brain/server-service"
import { getWeekStartSunday } from "@/lib/strategy-brain/week-utils"
import { buildPlannedContextFromSignal } from "@/lib/tradingview/planned-context-mapper"
import {
  resolveSignalChartImageUrl,
  type SignalChartImageSource,
} from "@/lib/tradingview/signal-chart-resolution"
import { normalizeSymbol } from "@/lib/tradingview/signal-normalizer"
import type {
  TradingViewChartVisionSnapshot,
  TradingViewSignalAnalysis,
} from "@/lib/tradingview/types"

export type EnrichTradingViewChartVisionInput = {
  userId: string
  signalId: string
  coachSessionId: string
  symbol: string
  direction: "BUY" | "SELL"
  timeframe?: string | null
  strategy_name?: string | null
  entry_zone?: string | null
  entry_price?: string | null
  stop_loss?: number | null
  take_profit?: number | null
  message?: string | null
  chart_url?: string | null
  image_url?: string | null
  screenshot_url?: string | null
  analysis: TradingViewSignalAnalysis
  maxRiskPerTrade?: number
}

function mergeVisionIntoAnalysis(
  analysis: TradingViewSignalAnalysis,
  snapshot: TradingViewChartVisionSnapshot,
): TradingViewSignalAnalysis {
  const extraWarnings = snapshot.warnings?.slice(0, 3) ?? []
  const extraStrengths = snapshot.strengths?.slice(0, 2) ?? []
  const warnings = [...new Set([...analysis.warnings, ...extraWarnings])].slice(0, 8)
  const strengths = [...new Set([...analysis.strengths, ...extraStrengths])].slice(0, 6)

  let summary = analysis.summary
  if (snapshot.available && snapshot.summary) {
    summary = `${analysis.summary} Chart vision: ${snapshot.summary}`
  } else if (!snapshot.available && snapshot.skipped_reason) {
    summary = `${analysis.summary} (${snapshot.skipped_reason})`
  }

  return {
    ...analysis,
    chart_vision: snapshot,
    warnings,
    strengths,
    summary: summary.slice(0, 500),
  }
}

export async function enrichTradingViewSignalChartVision(
  supabase: SupabaseClient,
  input: EnrichTradingViewChartVisionInput,
): Promise<{ enriched: boolean; snapshot: TradingViewChartVisionSnapshot }> {
  const patchAnalysis = async (snapshot: TradingViewChartVisionSnapshot) => {
    const merged = mergeVisionIntoAnalysis(input.analysis, snapshot)
    await supabase
      .from("tradingview_signals")
      .update({
        ai_analysis: merged,
        chart_url: snapshot.image_url ?? input.chart_url ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.signalId)
      .eq("user_id", input.userId)
  }

  if (!isOpenAiConfigured()) {
    const snapshot: TradingViewChartVisionSnapshot = {
      available: false,
      image_source: "none",
      skipped_reason: "Add OPENAI_API_KEY on the server to run chart vision on alerts.",
    }
    await patchAnalysis(snapshot)
    return { enriched: false, snapshot }
  }

  let warRoomScreenshotUrls: string[] = []
  try {
    const weekPlan = await getWeeklyPlanWithPairs(
      supabase,
      input.userId,
      getWeekStartSunday(),
    )
    const pair = weekPlan?.pairs.find(
      (p) => normalizeSymbol(p.pair) === normalizeSymbol(input.symbol),
    )
    warRoomScreenshotUrls = pair?.screenshot_urls ?? []
  } catch {
    // War Room tables optional
  }

  const resolved = resolveSignalChartImageUrl({
    image_url: input.image_url,
    screenshot_url: input.screenshot_url,
    chart_url: input.chart_url,
    warRoomScreenshotUrls,
  })

  if (!resolved.url) {
    const snapshot: TradingViewChartVisionSnapshot = {
      available: false,
      image_source: "none",
      skipped_reason: resolved.skipped_reason,
    }
    await patchAnalysis(snapshot)
    return { enriched: false, snapshot }
  }

  const plannedContext = buildPlannedContextFromSignal({
    signalId: input.signalId,
    symbol: input.symbol,
    direction: input.direction,
    timeframe: input.timeframe,
    strategy_name: input.strategy_name,
    entry_zone: input.entry_zone,
    entry_price: input.entry_price,
    stop_loss: input.stop_loss,
    take_profit: input.take_profit,
    message: input.message,
    chart_url: resolved.url,
    analysis: input.analysis,
    maxRiskPerTrade: input.maxRiskPerTrade,
  })

  try {
    const { vision, legacy } = await analyzeChartVisionForContext(resolved.url, plannedContext)
    await linkChartAnalysisToCoachSession(supabase, input.userId, input.coachSessionId, {
      imageUrl: resolved.url,
      vision,
      legacy,
    })

    const { data: coachRow } = await supabase
      .from("trade_coach_sessions")
      .select("planned_context")
      .eq("id", input.coachSessionId)
      .eq("user_id", input.userId)
      .maybeSingle()

    const snapshot: TradingViewChartVisionSnapshot = {
      available: true,
      image_source: resolved.source,
      image_url: resolved.url,
      vision_score: vision.visionScore,
      summary: vision.summary,
      warnings: vision.warnings,
      strengths: vision.strengths,
      analyzed_at: vision.analyzedAt,
    }
    await patchAnalysis(snapshot)

    if (coachRow?.planned_context) {
      const ctx = coachRow.planned_context as import("@/lib/trade-coach/types").PreTradePlannedContext
      await supabase
        .from("trade_coach_sessions")
        .update({
          planned_context: {
            ...ctx,
            vision_score: vision.visionScore,
            tradingview_chart_vision: snapshot,
            chart_analysis: legacy,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.coachSessionId)
        .eq("user_id", input.userId)
    }

    return { enriched: true, snapshot }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chart vision failed"
    const snapshot: TradingViewChartVisionSnapshot = {
      available: false,
      image_source: resolved.source,
      image_url: resolved.url,
      skipped_reason: message.slice(0, 220),
    }
    await patchAnalysis(snapshot)
    return { enriched: false, snapshot }
  }
}
