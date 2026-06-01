import { detectCoachRedFlags } from "@/lib/trade-coach/red-flags"
import {
  buildPreTradeGradeMessage,
  mapSetupGradeToBand,
  sanitizeCoachLanguage,
} from "@/lib/coach-chapters/personality"
import type {
  CoachRedFlag,
  PreTradeAnalysis,
  PreTradePlannedContext,
} from "@/lib/trade-coach/types"

function buildShouldTakeTradeSummary(
  confidenceScore: number,
  redFlags: CoachRedFlag[],
  responses: Record<string, string>,
): string {
  const ruleBreak = responses.rule_check?.toLowerCase() === "no"
  const criticalCount = redFlags.filter((flag) => flag.severity === "critical").length

  if (confidenceScore >= 75 && criticalCount === 0) {
    return "Should you take this trade? Yes — process, risk, and emotional checks look solid. Execute your plan as written."
  }

  if (confidenceScore >= 50) {
    return "Should you take this trade? Proceed with caution — reduce size or wait for better conditions before entering."
  }

  if (ruleBreak) {
    return "Should you take this trade? No — you already flagged a rule break. Stand down and wait for a cleaner setup."
  }

  return "Should you take this trade? No — multiple red flags suggest this entry has poor process quality right now."
}

function buildPreTradeInsights(
  redFlags: CoachRedFlag[],
  responses: Record<string, string>,
): string[] {
  const insights: string[] = []

  if (redFlags.some((flag) => flag.id === "fomo")) {
    insights.push("FOMO detected")
  }
  if (redFlags.some((flag) => flag.id === "revenge")) {
    insights.push("Revenge trading detected — pause before entry")
  }
  if (redFlags.some((flag) => flag.id === "euphoric")) {
    insights.push("Euphoric state — risk of oversizing")
  }
  if (redFlags.some((flag) => flag.id === "over_risking")) {
    insights.push("Over-risking vs your max rule")
  } else if (responses.planned_risk) {
    insights.push("Risk managed well")
  }
  if (redFlags.some((flag) => flag.id === "rules_break")) {
    insights.push("You broke your rules")
  } else if (responses.rule_check?.toLowerCase() === "yes") {
    insights.push("Good patience — rules acknowledged")
  }
  if (redFlags.some((flag) => flag.id === "countertrend")) {
    insights.push("Countertrend conflict flagged")
  }
  if (["Calm", "Confident", "Disciplined"].includes(responses.emotional_state || "")) {
    insights.push("Stable pre-trade emotional state")
  }

  return insights.slice(0, 6)
}

export function generatePreTradeAnalysis(
  context: PreTradePlannedContext,
  responses: Record<string, string>,
  maxRiskPerTrade: number,
): PreTradeAnalysis {
  const redFlags = detectCoachRedFlags(context, responses, maxRiskPerTrade)
  let confidenceScore = 100

  for (const flag of redFlags) {
    confidenceScore -= flag.severity === "critical" ? 18 : 10
  }

  const chartAnalysis = context.chart_analysis
  const vision = chartAnalysis?.vision
  const mtf = context.mtf_analysis ?? chartAnalysis?.mtf
  const visual = context.visual_analysis?.aggregate
  if (visual) {
    confidenceScore = Math.round(
      confidenceScore * 0.2 +
        visual.biasAlignmentScore * 0.25 +
        visual.entryConfirmationScore * 0.25 +
        visual.confidenceScore * 0.3,
    )
    if (visual.countertrend) confidenceScore -= 10
    if (visual.recommendation === "SKIP") confidenceScore -= 8
    if (visual.recommendation === "TAKE") confidenceScore += 4
  } else if (mtf) {
    confidenceScore = Math.round(
      confidenceScore * 0.25 +
        mtf.bias.biasAlignmentScore * 0.35 +
        mtf.entry.entryConfirmationScore * 0.4,
    )
    if (mtf.bias.overallBias === "mixed") confidenceScore -= 12
    if (mtf.chartsProvided < 5) confidenceScore -= mtf.confidencePenalty
    if (mtf.entry.entryConfirmationScore >= 75) confidenceScore += 6
  } else if (vision || chartAnalysis) {
    const visionScore = vision?.visionScore ?? chartAnalysis?.overallScore ?? 0
    confidenceScore = Math.round(confidenceScore * 0.4 + visionScore * 0.6)
    if (vision?.metrics.countertrend ?? chartAnalysis?.countertrend) confidenceScore -= 10
    if (vision?.metrics.overextendedMove ?? chartAnalysis?.overextendedEntry) confidenceScore -= 8
    if ((vision?.executionQuality ?? chartAnalysis?.executionQuality ?? 0) >= 75) confidenceScore += 6
  } else if (!context.stop_loss?.trim() || !context.take_profit?.trim()) {
    confidenceScore -= 6
  }

  confidenceScore = Math.max(0, Math.min(100, confidenceScore))

  const shouldTakeTrade: PreTradeAnalysis["shouldTakeTrade"] =
    confidenceScore >= 75 ? "yes" : confidenceScore >= 50 ? "caution" : "no"

  const summary = buildShouldTakeTradeSummary(confidenceScore, redFlags, responses)
  const insights = buildPreTradeInsights(redFlags, responses)

  return {
    confidenceScore,
    shouldTakeTrade,
    summary,
    redFlags,
    insights,
  }
}

export function buildPreTradeCompletionMessages(analysis: PreTradeAnalysis): string[] {
  const messages: string[] = []

  if (analysis.vyronisCoach) {
    messages.push(analysis.vyronisCoach.summary)
    messages.push(
      `State ${analysis.vyronisCoach.state_score}/100 · Setup ${analysis.vyronisCoach.setup_score}/100 · ${analysis.vyronisCoach.verdict}.`,
    )
  } else {
    messages.push(analysis.summary)
    messages.push(
      `AI confidence before entry: ${analysis.confidenceScore}/100 (${analysis.shouldTakeTrade.toUpperCase()}).`,
    )
  }

  if (analysis.redFlags.length > 0) {
    messages.push(
      `Red flags: ${analysis.redFlags.map((flag) => flag.message).join(" · ")}`,
    )
  }

  if (analysis.insights.length > 0 && !analysis.vyronisCoach) {
    messages.push(`Coaching notes: ${analysis.insights.join(" · ")}`)
  }

  if (analysis.tradeQuality) {
    const band = mapSetupGradeToBand(analysis.tradeQuality.grade)
    messages.push(
      sanitizeCoachLanguage(
        buildPreTradeGradeMessage({
          grade: band,
          missingReasons: analysis.tradeQuality.warnings,
        }),
      ),
    )
  }

  messages.push(
    sanitizeCoachLanguage(
      "Pre-trade check-in saved. Log the trade when execution is done — I'll compare plan vs outcome after close.",
    ),
  )

  return messages
}
