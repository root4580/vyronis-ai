import type { CognitiveEngineInput, PredictionSnapshot } from "@/lib/cognitive/types"
import type { CognitiveStateSnapshot } from "@/lib/cognitive/types"

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

export function buildPredictions(input: {
  cognitive: CognitiveEngineInput
  state: CognitiveStateSnapshot
}): PredictionSnapshot {
  const { context } = input.cognitive
  const { state } = input
  const shadow = context.autonomous?.shadow

  const overtradingProbability = clamp(
    shadow?.overtradingProbability ??
      (context.memory.snapshot.todayTradeCount >= context.settings.max_trades_per_day - 1
        ? 65
        : 20),
  )
  const revengeProbability = clamp(
    shadow?.revengeTradingSignal ??
      (state.primary === "revenge_driven" ? 70 : state.primary === "impulsive" ? 40 : 15),
  )
  const executionQualityForecast = clamp(
    shadow?.executionQualityPrediction ?? 55,
  )
  const disciplineStability = clamp(
    shadow?.disciplineConfidence ?? state.stability,
  )

  let emotionalRiskTrajectory: PredictionSnapshot["emotionalRiskTrajectory"] = "stable"
  if (shadow && shadow.emotionalRiskScore >= 70) emotionalRiskTrajectory = "rising"
  if (state.stability >= 72 && shadow && shadow.emotionalRiskScore < 45) {
    emotionalRiskTrajectory = "falling"
  }

  const narrative = [
    `Overtrading risk ~${overtradingProbability}%`,
    `Revenge risk ~${revengeProbability}%`,
    `Execution forecast ~${executionQualityForecast}/100`,
    `Discipline stability ~${disciplineStability}/100`,
    `Emotional trajectory: ${emotionalRiskTrajectory}`,
  ].join(" · ")

  return {
    overtradingProbability,
    revengeProbability,
    executionQualityForecast,
    disciplineStability,
    emotionalRiskTrajectory,
    narrative,
  }
}
