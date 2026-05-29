import { evaluateConfirmation } from "@/lib/strategy-brain/confirmation-engine"
import { evaluateEmotionCheck } from "@/lib/strategy-brain/emotion-engine"
import { evaluateMarketBias } from "@/lib/strategy-brain/market-bias-engine"
import { calculateAPlusScore } from "@/lib/strategy-brain/aplus-scoring-engine"
import { findSimilarTradeMemory } from "@/lib/strategy-brain/trade-memory-engine"
import type {
  BiasDirection,
  MarketBiasInput,
  StrategySetupEvaluationInput,
  StrategySetupEvaluationResult,
  TradeMemoryTrade,
} from "@/lib/strategy-brain/types"

export function evaluateStrategySetup(
  input: StrategySetupEvaluationInput,
  context?: {
    storedBias?: MarketBiasInput | null
    historicalTrades?: TradeMemoryTrade[]
  },
): StrategySetupEvaluationResult {
  const marketBiasInput: MarketBiasInput = input.market_bias ??
    context?.storedBias ?? {
      weekly_bias: "Neutral",
      daily_bias: "Neutral",
      h4_bias: "Neutral",
    }

  const marketBias = evaluateMarketBias(marketBiasInput)
  const pairBias: BiasDirection = input.pair_bias ?? "Neutral"
  const confirmation = evaluateConfirmation(input.confirmation)

  let emotionScore: number | null = null
  let majorNewsRisk = false
  if (input.emotion_answers) {
    const emotion = evaluateEmotionCheck(input.emotion_answers)
    emotionScore = emotion.emotion_score
    majorNewsRisk = emotion.major_news_risk
  }

  const scoring = calculateAPlusScore({
    marketBias,
    pairBias,
    confirmation: input.confirmation,
    aoiReached: input.aoi_reached ?? false,
    riskReward: input.risk_reward ?? null,
    emotionScore,
    majorNewsRisk,
  })

  const memoryInsight =
    context?.historicalTrades && context.historicalTrades.length > 0
      ? findSimilarTradeMemory({
          pair: input.pair,
          trades: context.historicalTrades,
          confirmation: input.confirmation,
          emotionUnstable: emotionScore !== null && emotionScore < 60,
        })
      : null

  return {
    marketBias,
    confirmation,
    scoring,
    memoryInsight,
  }
}
