import { buildPostTradeReview } from "@/lib/trade-coach/post-trade-review-engine"
import { sanitizePostTradeCopy } from "@/lib/trade-coach/trade-coach-mode"
import type {
  CoachInsightLabel,
  DisciplineAnalysis,
  PostTradeCoachInput,
  PostTradeCoachResult,
  PreTradePlannedContext,
} from "@/lib/trade-coach/types"

function buildCoachingInsights(input: PostTradeCoachInput, ruleGaps: string[]): CoachInsightLabel[] {
  const insights: CoachInsightLabel[] = []
  const { trade, maxRiskPerTrade } = input
  const actualRisk = trade.risk_percent ?? 0

  if (actualRisk > 0 && actualRisk <= maxRiskPerTrade) {
    insights.push("Risk within challenge limit")
  }
  if (actualRisk > maxRiskPerTrade) {
    insights.push(`Risk gap: above ${maxRiskPerTrade}% challenge limit`)
  }

  if (trade.rule_followed === true) insights.push("Rules marked followed")
  if (["Calm", "Confident", "Disciplined"].includes(trade.emotion)) insights.push("Stable entry emotion")
  if (trade.result === "WIN" && trade.rule_followed !== false) insights.push("Process held on a win")
  if (trade.result === "LOSS" && ruleGaps.length === 0) insights.push("Discipline intact on a loss")

  return [...new Set(insights)].slice(0, 6)
}

export function generatePostTradeCoachFeedback(
  input: PostTradeCoachInput,
): PostTradeCoachResult {
  const review = buildPostTradeReview(input)
  const { executionReview, plannedVsActual, ruleGaps } = review
  const coachingInsights = buildCoachingInsights(input, ruleGaps)

  const disciplineAnalysis: DisciplineAnalysis = {
    score: executionReview.disciplineScore,
    strengths: executionReview.executedWell,
    weaknesses: executionReview.ruleGaps.map(sanitizePostTradeCopy),
    ruleAdherence:
      executionReview.disciplineGrade === "A" || executionReview.disciplineGrade === "A+"
        ? "strong"
        : executionReview.disciplineGrade === "B"
          ? "mixed"
          : "weak",
    emotionalControl: ["FOMO", "Revenge", "Euphoric", "Anxious", "Fearful"].includes(input.trade.emotion)
      ? "risky"
      : "stable",
    coachingInsights,
    executionReview,
  }

  const coachingSummary = sanitizePostTradeCopy(
    `Post-trade review · ${input.trade.pair} ${input.trade.result} · Strategy ${executionReview.strategyGrade} (${executionReview.strategyScore}) · Discipline ${executionReview.disciplineGrade} (${executionReview.disciplineScore}) · Final ${executionReview.overallGrade} (${executionReview.finalScore}). ${executionReview.postTradeVerdict}`,
  )

  const feedbackPoints = [
    executionReview.postTradeVerdict,
    ...executionReview.executedWell.slice(0, 3).map((item) => `What went well: ${item}`),
    ...executionReview.ruleGaps.slice(0, 2).map((item) => `Rule gap: ${item}`),
    executionReview.improveNextTime[0] ? `Next time: ${executionReview.improveNextTime[0]}` : null,
    executionReview.repeatableReason,
    executionReview.riskReward.note,
  ]
    .filter(Boolean)
    .map((item) => sanitizePostTradeCopy(String(item)))

  return {
    coachMode: "post_trade",
    executionReview,
    plannedVsActual,
    disciplineAnalysis,
    coachingSummary,
    feedbackPoints: [...new Set(feedbackPoints)].slice(0, 7),
    coachingInsights,
    disciplineScore: executionReview.finalScore,
  }
}

export function extractPreTradeResponses(
  messages: Array<{ role: string; question_key: string | null; content: string }>,
): Record<string, string> {
  const responses: Record<string, string> = {}
  for (const message of messages) {
    if (message.role === "user" && message.question_key) {
      responses[message.question_key] = message.content
    }
  }
  return responses
}

export function mergePlannedContext(
  sessionContext: PreTradePlannedContext,
  fallback: PreTradePlannedContext,
): PreTradePlannedContext {
  return {
    ...fallback,
    ...sessionContext,
    coach_analysis: sessionContext.coach_analysis ?? fallback.coach_analysis,
  }
}
