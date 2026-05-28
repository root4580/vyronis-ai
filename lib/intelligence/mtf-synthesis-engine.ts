import type { TimeframeBundleAnalysis } from "@/lib/intelligence/command-center-bundle-types"
import type { ChartStructureType } from "@/lib/intelligence/comparative-memory-engine"

function biasLabel(bias: string): string {
  const b = bias.toLowerCase()
  if (b === "bullish" || b === "bull") return "bullish"
  if (b === "bearish" || b === "bear") return "bearish"
  if (b === "mixed") return "mixed"
  return "neutral"
}

function dominantHtfBias(bundle: TimeframeBundleAnalysis): string {
  const biases = ["weekly", "daily", "h4"]
    .map((tf) => bundle.frames.find((f) => f.inferredTimeframe === tf)?.trendBias)
    .filter(Boolean) as string[]

  if (biases.length === 0) {
    return bundle.mtfAnalysis?.bias.overallBias ?? "unclear"
  }

  const bulls = biases.filter((b) => biasLabel(b) === "bullish").length
  const bears = biases.filter((b) => biasLabel(b) === "bearish").length
  if (bulls > bears) return "bullish"
  if (bears > bulls) return "bearish"
  if (bulls > 0 && bears > 0) return "mixed"
  return biasLabel(biases[0])
}

function ltfBias(bundle: TimeframeBundleAnalysis): string {
  const ltf = bundle.frames.filter((f) =>
    ["h1", "m15", "m5"].includes(f.inferredTimeframe),
  )
  if (ltf.length === 0) return "unclear"
  const bulls = ltf.filter((f) => biasLabel(f.trendBias) === "bullish").length
  const bears = ltf.filter((f) => biasLabel(f.trendBias) === "bearish").length
  if (bulls > bears) return "bullish"
  if (bears > bulls) return "bearish"
  if (bulls > 0 && bears > 0) return "mixed"
  return biasLabel(ltf[0].trendBias)
}

function structurePhrase(structure: ChartStructureType): string {
  switch (structure) {
    case "continuation":
      return "continuation environment"
    case "pullback":
      return "pullback phase"
    case "reversal":
      return "reversal attempt"
    case "chop":
      return "choppy, low-conviction range"
    default:
      return "unclear structure"
  }
}

export function synthesizeMtfNarrative(bundle: TimeframeBundleAnalysis): string {
  if (bundle.comparisonSummary.length < 220) {
    const synth = buildSyntheticLine(bundle)
    if (synth) return synth
  }

  return bundle.comparisonSummary
}

function buildSyntheticLine(bundle: TimeframeBundleAnalysis): string | null {
  const htf = dominantHtfBias(bundle)
  const ltf = ltfBias(bundle)
  const structure = bundle.structureType ?? "unclear"

  if (htf === "unclear" || htf === "neutral") {
    const unknownCount = bundle.frames.filter(
      (f) => f.inferredTimeframe === "unknown",
    ).length
    if (unknownCount > 0) {
      return `Some charts are **unknown timeframe** — from what I can read on ${bundle.inferredStack}, structure looks ${structurePhrase(structure)} without a clear HTF anchor.`
    }
  }

  const htfWord = htf === "bullish" ? "bullish" : htf === "bearish" ? "bearish" : "mixed"

  if (bundle.ltfConfirmsHtf === false || (htf !== ltf && ltf !== "mixed" && ltf !== "unclear")) {
    return `Higher timeframe remains **${htfWord}**, but lower timeframe momentum is **fighting** the trend — a weak ${structurePhrase(structure)}.`
  }

  if (bundle.htfAlignment === "conflict") {
    return `Weekly, Daily, and H4 are **not aligned** — that's a conflicted ${structurePhrase(structure)}, not a clean stack.`
  }

  if (bundle.ltfConfirmsHtf === true && bundle.htfAlignment === "aligned") {
    return `HTF stays **${htfWord}** and lower timeframes **confirm** — this is a healthier ${structurePhrase(structure)} on ${bundle.inferredStack}.`
  }

  if (bundle.entryTiming === "late") {
    return `HTF bias is **${htfWord}**, but entry looks **late** — momentum may be exhausted on ${bundle.inferredStack}.`
  }

  return `Across ${bundle.inferredStack}, HTF reads **${htfWord}** with ${structurePhrase(structure)}${bundle.ltfConfirmsHtf === true ? " and LTF support" : ""}.`
}
