import type { TradeCoachSessionRecord, TradeQualityResult } from "@/lib/trade-coach/types"
import { TRADE_QUALITY_BLOCK_THRESHOLD } from "@/lib/trade-coach/trade-quality-engine"

export function resolveTradeQualityFromSession(
  session: TradeCoachSessionRecord | null | undefined,
): TradeQualityResult | null {
  if (!session) return null

  const fromAnalysis = session.planned_context?.coach_analysis?.tradeQuality
  if (fromAnalysis) return fromAnalysis

  if (session.quality_score == null || !session.quality_grade) return null

  return {
    score: session.quality_score,
    grade: session.quality_grade,
    recommendation: session.recommendation || "CAUTION",
    confidence: session.confidence_score ?? 0,
    warnings: session.warnings || [],
    strengths: session.strengths || [],
    breakdown: session.score_breakdown || {
      psychology: 0,
      risk: 0,
      setup: 0,
      discipline: 0,
      historicalEdge: 0,
    },
    blockExecution: session.quality_score < TRADE_QUALITY_BLOCK_THRESHOLD,
  }
}
