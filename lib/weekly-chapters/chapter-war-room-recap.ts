import type { BiasDirection, WeeklyPlanWithPairs } from "@/lib/strategy-brain/types"
import type { ChapterReviewTrade, ChapterWarRoomPairRecap, ChapterWarRoomRecap } from "@/lib/weekly-chapters/types"

export function normalizePairSymbol(pair: string): string {
  return pair.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
}

/** War Room and chapter reviews share the same Sunday 5:00 PM ET week key. */
export function warRoomWeekStartCandidates(chapterWeekStart: string): string[] {
  return [chapterWeekStart]
}

export function chapterWeekStartFromWarRoomWeek(warRoomWeekStart: string): string {
  return warRoomWeekStart
}

function isLongDirection(direction: string): boolean {
  const value = direction.toUpperCase()
  return value.includes("BUY") || value.includes("LONG")
}

function isShortDirection(direction: string): boolean {
  const value = direction.toUpperCase()
  return value.includes("SELL") || value.includes("SHORT")
}

export function tradeMatchesPairBias(
  bias: BiasDirection,
  direction: string,
): "aligned" | "counter" | "neutral" {
  if (bias === "Neutral") return "neutral"
  if (bias === "Bullish") {
    if (isLongDirection(direction)) return "aligned"
    if (isShortDirection(direction)) return "counter"
    return "neutral"
  }
  if (isShortDirection(direction)) return "aligned"
  if (isLongDirection(direction)) return "counter"
  return "neutral"
}

export function buildChapterWarRoomRecap(input: {
  plan: WeeklyPlanWithPairs | null
  trades: ChapterReviewTrade[]
}): ChapterWarRoomRecap | null {
  const { plan, trades } = input
  const hasPlanContent = plan
    ? plan.pairs.length > 0 ||
      Boolean(plan.session_focus?.trim()) ||
      Boolean(plan.expected_scenarios?.trim()) ||
      Boolean(plan.session_notes?.trim())
    : false

  if (!hasPlanContent && trades.length === 0) {
    return null
  }

  const plannedByPair = new Map<string, WeeklyPlanWithPairs["pairs"][number]>()
  for (const pairPlan of plan?.pairs ?? []) {
    plannedByPair.set(normalizePairSymbol(pairPlan.pair), pairPlan)
  }

  const tradesByPair = new Map<string, ChapterReviewTrade[]>()
  for (const trade of trades) {
    const key = normalizePairSymbol(trade.pair)
    const bucket = tradesByPair.get(key) ?? []
    bucket.push(trade)
    tradesByPair.set(key, bucket)
  }

  const plannedPairs = [...plannedByPair.keys()]
  const tradedPairs = [...tradesByPair.keys()]
  const unplannedTrades = tradedPairs.filter((pair) => !plannedByPair.has(pair))
  const untouchedPairs = plannedPairs.filter((pair) => !tradesByPair.has(pair))

  const pairRecaps: ChapterWarRoomPairRecap[] = plannedPairs.map((pairKey) => {
    const pairPlan = plannedByPair.get(pairKey)!
    const pairTrades = tradesByPair.get(pairKey) ?? []
    const alignments = pairTrades.map((trade) =>
      tradeMatchesPairBias(pairPlan.directional_bias, trade.direction),
    )
    const hasCounter = alignments.includes("counter")
    const hasAligned = alignments.includes("aligned")
    const alignment =
      pairTrades.length === 0
        ? ("no_trades" as const)
        : hasCounter && !hasAligned
          ? ("counter" as const)
          : hasAligned && !hasCounter
            ? ("aligned" as const)
            : hasAligned && hasCounter
              ? ("mixed" as const)
              : ("neutral" as const)

    let note = ""
    if (pairTrades.length === 0) {
      note = "On watchlist — no live trades logged."
    } else if (alignment === "aligned") {
      note = `Traded with your ${pairPlan.directional_bias} bias.`
    } else if (alignment === "counter") {
      note = `Live direction fought your ${pairPlan.directional_bias} plan.`
    } else if (alignment === "mixed") {
      note = "Mixed direction vs your weekly bias."
    } else {
      note = "Traded without a clear bias match."
    }

    return {
      pair: pairPlan.pair,
      plannedBias: pairPlan.directional_bias,
      plannedThesis: pairPlan.weekly_thesis?.trim() || pairPlan.notes?.trim() || null,
      trades: pairTrades.map((trade) => ({
        direction: trade.direction,
        result: trade.result,
        pnl: trade.pnl,
      })),
      alignment,
      note,
    }
  })

  for (const pairKey of unplannedTrades) {
    const pairTrades = tradesByPair.get(pairKey) ?? []
    pairRecaps.push({
      pair: pairTrades[0]?.pair ?? pairKey,
      plannedBias: null,
      plannedThesis: null,
      trades: pairTrades.map((trade) => ({
        direction: trade.direction,
        result: trade.result,
        pnl: trade.pnl,
      })),
      alignment: "unplanned",
      note: "Not on this week's War Room watchlist.",
    })
  }

  const summaryLines: string[] = []
  if (plan) {
    if (plannedPairs.length > 0) {
      summaryLines.push(
        `War Room watchlist: ${plannedPairs.length} pair${plannedPairs.length === 1 ? "" : "s"}.`,
      )
    }
    if (plan.session_focus?.trim()) {
      summaryLines.push(`Session focus: “${plan.session_focus.trim()}”`)
    }
  }

  if (trades.length === 0) {
    summaryLines.push("No live trades logged this chapter yet.")
  } else {
    summaryLines.push(
      `${trades.length} live trade${trades.length === 1 ? "" : "s"} across ${tradedPairs.length} pair${tradedPairs.length === 1 ? "" : "s"}.`,
    )
  }

  if (unplannedTrades.length > 0) {
    summaryLines.push(
      `${unplannedTrades.length} traded off-watchlist — review whether they matched your plan.`,
    )
  }

  if (untouchedPairs.length > 0 && trades.length > 0) {
    summaryLines.push(
      `${untouchedPairs.length} watchlist pair${untouchedPairs.length === 1 ? "" : "s"} untouched.`,
    )
  }

  const counterPairs = pairRecaps.filter((row) => row.alignment === "counter")
  if (counterPairs.length > 0) {
    summaryLines.push(
      `${counterPairs.map((row) => row.pair).join(", ")} traded counter to planned bias.`,
    )
  }

  const alignedWins = pairRecaps.filter(
    (row) =>
      row.alignment === "aligned" &&
      row.trades.some((trade) => trade.result.toUpperCase() === "WIN" || trade.pnl > 0),
  )
  if (alignedWins.length > 0) {
    summaryLines.push(
      `Bias-aligned wins: ${alignedWins.map((row) => row.pair).join(", ")}.`,
    )
  }

  return {
    hasPlan: Boolean(hasPlanContent),
    sessionFocus: plan?.session_focus?.trim() || null,
    expectedScenarios: plan?.expected_scenarios?.trim() || null,
    plannedPairs: (plan?.pairs ?? []).map((pair) => pair.pair),
    tradedPairs: trades.map((trade) => trade.pair),
    unplannedTradePairs: unplannedTrades.map(
      (key) => tradesByPair.get(key)?.[0]?.pair ?? key,
    ),
    untouchedPairs: untouchedPairs.map((key) => plannedByPair.get(key)!.pair),
    pairRecaps,
    summaryLines: summaryLines.slice(0, 6),
  }
}
