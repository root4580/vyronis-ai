import { isCleanWeekWithPositiveMood } from "@/lib/coach/clean-week-mood"
import { parseMistakeTags } from "@/lib/trade-form-config"
import type { CommandCenterVisionAnalysis } from "@/lib/intelligence/command-center-vision-engine"
import { compareSetupToHistory } from "@/lib/intelligence/setup-similarity-engine"
import type { FullTraderContext } from "@/lib/intelligence/intelligence-types"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"

export type ChartStructureType =
  | "continuation"
  | "pullback"
  | "reversal"
  | "chop"
  | "unclear"

export function buildPlannedContextForSimilarity(
  context: FullTraderContext,
  chartVision?: CommandCenterVisionAnalysis | null,
): PreTradePlannedContext {
  const planned = context.activePlannedContext ?? {}
  const vision = chartVision?.vision
  const recentPair = context.recentTrades[0]?.pair
  return {
    ...planned,
    pair: planned.pair || recentPair || undefined,
    setup: planned.setup || vision?.detectedSetup || undefined,
    direction: planned.direction,
    session: planned.session || context.memory.greeting.sessionLabel,
    emotion: planned.emotion,
    higher_timeframe:
      planned.higher_timeframe ||
      (chartVision?.bundle?.inferredStack
        ? `MTF ${chartVision.bundle.inferredStack}`
        : undefined),
  }
}

const IMPULSIVE = new Set(["fomo", "revenge", "euphoric", "anxious", "tilted"])

export type ComparativeMemoryRead = {
  narrative: string | null
  winEcho: string | null
  lossEcho: string | null
  emotionalEcho: string | null
  structureContrast: string | null
}

function normalizeEmotion(value?: string | null): string {
  return String(value || "").trim().toLowerCase()
}

function detectImpulsiveLossPattern(
  context: FullTraderContext,
  structure?: ChartStructureType,
): string | null {
  const losses = context.recentTrades.filter((t) => t.result === "LOSS").slice(0, 12)
  const impulsiveLosses = losses.filter((t) =>
    IMPULSIVE.has(normalizeEmotion(t.emotion)),
  )
  if (impulsiveLosses.length < 2) return null

  const continuationLosses = impulsiveLosses.filter((t) => {
    const tags = parseMistakeTags(
      (t as { mistake_tags?: string }).mistake_tags ?? "",
    ).join(" ").toLowerCase()
    return tags.includes("chase") || tags.includes("fomo") || tags.includes("early")
  })

  if (continuationLosses.length >= 1 && structure === "continuation") {
    return "recent impulsive continuation losses"
  }
  if (impulsiveLosses.length >= 2) {
    return `repeated ${impulsiveLosses[0].emotion || "emotional"} losses`
  }
  return null
}

function strongestSetupType(context: FullTraderContext): string | null {
  const wins = context.recentTrades.filter((t) => t.result === "WIN")
  const setupCounts = new Map<string, { wins: number; total: number }>()
  for (const trade of context.recentTrades.slice(0, 30)) {
    const setup = String(
      (trade as { setup?: string }).setup ||
        (trade as { setup_classification?: string }).setup_classification ||
        "unknown",
    ).trim()
    if (!setup || setup === "unknown") continue
    const entry = setupCounts.get(setup) ?? { wins: 0, total: 0 }
    entry.total += 1
    if (trade.result === "WIN") entry.wins += 1
    setupCounts.set(setup, entry)
  }
  let best: { name: string; rate: number } | null = null
  for (const [name, stats] of setupCounts) {
    if (stats.total < 2) continue
    const rate = stats.wins / stats.total
    if (!best || rate > best.rate) best = { name, rate }
  }
  if (!best || best.rate < 0.55) return null
  return best.name
}

export function buildComparativeMemoryRead(input: {
  context: FullTraderContext
  chartVision?: CommandCenterVisionAnalysis | null
  htfCleaner?: boolean
}): ComparativeMemoryRead {
  const planned = buildPlannedContextForSimilarity(input.context, input.chartVision)
  const structure = input.chartVision?.bundle?.structureType
  const similarity = compareSetupToHistory({
    planned,
    trades: input.context.recentTrades,
    minScore: 38,
  })

  const winMatch = similarity.topMatches.find(
    (m) => m.result === "WIN" && m.similarityScore >= 58,
  )
  const lossMatch = similarity.topMatches.find(
    (m) => m.result === "LOSS" && m.similarityScore >= 58,
  )

  const winEcho = winMatch
    ? `Your ${winMatch.pair} ${winMatch.result} from a similar profile (${winMatch.similarityScore}% match) — ${winMatch.summary}`
    : null

  const lossEcho = lossMatch
    ? `Your ${lossMatch.pair} ${lossMatch.result} looked like this (${lossMatch.similarityScore}% match) — ${lossMatch.summary}`
    : null

  const cleanWeekPositive = isCleanWeekWithPositiveMood(input.context)
  const impulsivePattern = cleanWeekPositive
    ? null
    : detectImpulsiveLossPattern(input.context, structure)
  const emotionalEcho = cleanWeekPositive
    ? null
    : impulsivePattern
      ? `You've tagged ${impulsivePattern} in your journal recently.`
      : input.context.emotionalState.dominantEmotion &&
          IMPULSIVE.has(normalizeEmotion(input.context.emotionalState.dominantEmotion))
        ? `Mood lately: ${input.context.emotionalState.dominantEmotion} — that emotion has hurt execution before.`
        : null

  let structureContrast: string | null = null
  if (cleanWeekPositive && input.htfCleaner) {
    structureContrast = "HTF alignment is solid and lower timeframes confirm."
  } else if (impulsivePattern && input.htfCleaner) {
    structureContrast = "HTF alignment is cleaner here than those impulsive reads."
  } else if (lossMatch && input.chartVision?.bundle?.htfAlignment === "aligned") {
    structureContrast = "HTF alignment is cleaner than that losing snapshot."
  }

  const strongest = strongestSetupType(input.context)
  let narrative: string | null = null

  if (cleanWeekPositive && input.htfCleaner) {
    narrative =
      "No trades logged this week — chart structure leads today. HTF is bullish and lower timeframes confirm; size down until you have live confirmation."
  } else if (cleanWeekPositive) {
    narrative =
      "No trades logged this week — today's mood check-in is positive, so journal history stays in the background."
  } else if (impulsivePattern && structureContrast) {
    narrative = `In past sessions (not this week), setups resembled your ${impulsivePattern}, but ${structureContrast.charAt(0).toLowerCase()}${structureContrast.slice(1)}`
  } else if (winMatch && lossMatch) {
    narrative = `Journal split: you've won and lost on similar ${winMatch.pair} profiles — execution and timing decide this one.`
  } else if (lossEcho && structureContrast) {
    narrative = `This resembles a past loss pattern, though ${structureContrast.charAt(0).toLowerCase()}${structureContrast.slice(1)}`
  } else if (winEcho) {
    narrative = `This rhymes with a past winner — ${winEcho.split("—")[0]?.trim()}.`
  } else if (lossEcho) {
    narrative = `Careful — ${lossEcho.split("—")[0]?.trim()}.`
  } else if (emotionalEcho) {
    narrative = emotionalEcho
  } else if (strongest && planned.setup?.toLowerCase().includes(strongest.toLowerCase().slice(0, 4))) {
    narrative = `${strongest} has been your stronger setup type in the journal.`
  } else if (similarity.matchCount > 0) {
    narrative = similarity.narrative
  }

  const compressed = input.context.compressedMemories[0]
  if (!narrative && compressed) {
    narrative = `From memory: ${compressed.insight}`
  }

  return {
    narrative,
    winEcho,
    lossEcho,
    emotionalEcho,
    structureContrast,
  }
}

export function buildComparativeMemoryLine(input: {
  context: FullTraderContext
  chartVision?: CommandCenterVisionAnalysis | null
}): string | null {
  const htfCleaner =
    input.chartVision?.bundle?.htfAlignment === "aligned" ||
    (input.chartVision?.vision?.metrics.emaAlignment ?? 0) >= 68

  const read = buildComparativeMemoryRead({
    context: input.context,
    chartVision: input.chartVision,
    htfCleaner,
  })

  return read.narrative
}
