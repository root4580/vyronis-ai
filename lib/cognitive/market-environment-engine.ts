import type { CommandCenterVisionAnalysis } from "@/lib/intelligence/command-center-vision-engine"
import type { CognitiveEngineInput, MarketEnvironmentSnapshot, MarketEnvironmentLabel } from "@/lib/cognitive/types"

export function evaluateMarketEnvironment(
  input: CognitiveEngineInput,
): MarketEnvironmentSnapshot {
  const { context, chartVision } = input
  const labels: MarketEnvironmentLabel[] = []
  const bundle = chartVision?.bundle
  const vision = chartVision?.vision
  const vol = vision?.metrics?.volatilityState ?? "normal"
  const sessionCtx = context.autonomous?.session?.marketContext

  if (vol === "expanded") labels.push("expanding_volatility")
  if (vol === "compressed") labels.push("compression")

  if (bundle?.structureType === "continuation" || bundle?.htfAlignment === "aligned") {
    labels.push("continuation_conditions")
  }
  if (bundle?.structureType === "reversal" || vision?.metrics?.countertrend) {
    labels.push("reversal_conditions")
  }
  if (bundle?.structureType === "chop") labels.push("choppy")
  if (bundle?.htfAlignment === "aligned" && bundle.ltfConfirmsHtf) {
    labels.push("trending")
  }
  const entryText = [
    ...(bundle?.mtfAnalysis?.entry?.entryStrengths ?? []),
    ...(bundle?.mtfAnalysis?.entry?.entryWarnings ?? []),
    bundle?.mtfAnalysis?.summary ?? "",
  ].join(" ")
  if (/sweep|liquidity|stop hunt/i.test(entryText)) {
    labels.push("liquidity_sweep")
  }

  if (sessionCtx === "low_liquidity") labels.push("choppy")
  if (sessionCtx === "news_volatility") labels.push("expanding_volatility")
  if (sessionCtx === "asia_compression") labels.push("compression")
  if (sessionCtx === "london_continuation") labels.push("continuation_conditions")
  if (sessionCtx === "ny_reversal") labels.push("reversal_conditions")

  const unique = [...new Set(labels)]
  const primary: MarketEnvironmentLabel =
    unique[0] ?? (context.autonomous?.session?.marketContext === "neutral" ? "neutral" : "neutral")

  const tradingBias =
    context.autonomous?.session?.tradingBias ??
    (primary === "continuation_conditions"
      ? "With-trend continuation"
      : primary === "reversal_conditions"
        ? "Reversal / fade with confirmation"
        : primary === "compression"
          ? "Range — wait for expansion"
          : "Neutral — playbook-led")

  const narrative =
    unique.length > 0
      ? `Market environment: ${unique.slice(0, 3).join(", ").replace(/_/g, " ")}. ${context.autonomous?.session?.narrative ?? ""}`
      : context.autonomous?.session?.narrative ?? "Neutral market read — trade your playbook."

  return {
    primary: unique[0] ?? "neutral",
    labels: unique.length > 0 ? unique : ["neutral"],
    narrative: narrative.trim(),
    tradingBias,
    usedInVerdict: Boolean(chartVision),
    confidence: chartVision ? 72 : 48,
  }
}
