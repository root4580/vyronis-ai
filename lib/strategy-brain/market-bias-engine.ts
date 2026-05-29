import type {
  BiasDirection,
  MarketBiasEvaluation,
  MarketBiasInput,
} from "@/lib/strategy-brain/types"

function isDirectional(bias: BiasDirection): boolean {
  return bias === "Bullish" || bias === "Bearish"
}

function conflicts(a: BiasDirection, b: BiasDirection): boolean {
  if (!isDirectional(a) || !isDirectional(b)) return false
  return a !== b
}

function dominantDirection(biases: BiasDirection[]): BiasDirection | null {
  const directional = biases.filter(isDirectional)
  if (directional.length < 2) return null
  const bullish = directional.filter((b) => b === "Bullish").length
  const bearish = directional.filter((b) => b === "Bearish").length
  if (bullish === directional.length) return "Bullish"
  if (bearish === directional.length) return "Bearish"
  return null
}

export function evaluateMarketBias(input: MarketBiasInput): MarketBiasEvaluation {
  const { weekly_bias, daily_bias, h4_bias } = input
  const layers = [weekly_bias, daily_bias, h4_bias]
  const conflictsList: string[] = []

  if (conflicts(weekly_bias, daily_bias)) {
    conflictsList.push("Daily conflicts with Weekly")
  }
  if (conflicts(weekly_bias, h4_bias)) {
    conflictsList.push("H4 conflicts with Weekly")
  }
  if (conflicts(daily_bias, h4_bias)) {
    conflictsList.push("H4 conflicts with Daily")
  }

  const clearConflict = conflictsList.length > 0
  const dominant = dominantDirection(layers)
  const allAlign =
    !clearConflict &&
    dominant !== null &&
    layers.every((b) => b === "Neutral" || b === dominant)

  const neutralCount = layers.filter((b) => b === "Neutral").length
  const directional_permission =
    allAlign && dominant !== null && neutralCount <= 1

  const setup_valid = !clearConflict

  let alignment_summary: string
  if (clearConflict) {
    alignment_summary = "HTF bias conflict — setup invalid until alignment clears."
  } else if (directional_permission) {
    alignment_summary = `Weekly, Daily, and H4 align ${dominant} — directional permission granted.`
  } else if (dominant) {
    alignment_summary = `${dominant} bias forming — wait for full HTF alignment before sizing up.`
  } else {
    alignment_summary = "No clear directional bias — trade only range plans or wait for structure."
  }

  const conflict_summary = clearConflict ? conflictsList.join(" · ") : null

  return {
    weekly_bias,
    daily_bias,
    h4_bias,
    directional_permission,
    setup_valid,
    conflict_summary,
    alignment_summary,
  }
}

export function biasAlignsWithPair(
  market: MarketBiasEvaluation,
  pairBias: BiasDirection,
): boolean {
  if (!isDirectional(pairBias)) return true
  if (!market.directional_permission) return false
  const dominant = dominantDirection([
    market.weekly_bias,
    market.daily_bias,
    market.h4_bias,
  ])
  return dominant === pairBias
}
