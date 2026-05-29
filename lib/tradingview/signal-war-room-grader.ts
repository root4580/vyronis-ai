import {
  biasAlignsWithPair,
  evaluateMarketBias,
} from "@/lib/strategy-brain/market-bias-engine"
import type { MarketBiasRecord, SetupGrade, WeeklyPlanWithPairs } from "@/lib/strategy-brain/types"
import {
  evaluateWeeklyWatchlistGate,
  normalizePairSymbol,
} from "@/lib/strategy-brain/weekly-watchlist"
import type {
  TradingViewAiRecommendation,
  TradingViewSetupVerdict,
  TradingViewSignalAnalysis,
  TradingViewWarRoomAlignment,
} from "@/lib/tradingview/types"

export function setupVerdictLabel(verdict: TradingViewSetupVerdict): string {
  switch (verdict) {
    case "trade_ready":
      return "Trade ready"
    case "tradable":
      return "Tradable (B+)"
    case "wait":
      return "Wait"
    case "low_quality":
      return "Low quality — skip"
    default:
      return verdict
  }
}

export function gradeMeetsMinimum(grade: SetupGrade): boolean {
  return grade === "A+" || grade === "B"
}

function directionAlignsPair(
  direction: "BUY" | "SELL",
  pairBias: string | null | undefined,
): boolean {
  if (!pairBias || pairBias === "Neutral") return true
  if (direction === "BUY" && pairBias === "Bullish") return true
  if (direction === "SELL" && pairBias === "Bearish") return true
  return false
}

function mapVerdict(grade: SetupGrade): TradingViewSetupVerdict {
  if (grade === "A+") return "trade_ready"
  if (grade === "B") return "tradable"
  if (grade === "C") return "wait"
  return "low_quality"
}

function mapRecommendation(grade: SetupGrade): TradingViewAiRecommendation {
  if (grade === "A+" || grade === "B") return "TAKE"
  if (grade === "C") return "CAUTION"
  return "SKIP"
}

function deriveGrade(input: {
  compositeScore: number
  pairOnList: boolean
  aoiStatus: string | null
  directionAligned: boolean
  marketValid: boolean
}): SetupGrade {
  if (!input.pairOnList) return "D"
  if (input.aoiStatus === "INVALIDATED") return "D"
  if (!input.directionAligned && input.compositeScore < 70) return "D"
  if (input.aoiStatus === "WAITING") {
    if (input.compositeScore >= 58) return "C"
    return "D"
  }
  if (!input.marketValid && input.compositeScore < 65) return "C"
  if (input.compositeScore >= 82 && input.directionAligned && input.marketValid) {
    if (input.aoiStatus === "CONFIRMING" || input.aoiStatus === "INSIDE_AOI") return "A+"
  }
  if (input.compositeScore >= 68 && input.directionAligned) return "B"
  if (input.compositeScore >= 48) return "C"
  return "D"
}

export function applyWarRoomGrading(input: {
  symbol: string
  direction: "BUY" | "SELL"
  technical: import("@/lib/tradingview/types").TradingViewTechnicalSignalAnalysis
  weekPlan: WeeklyPlanWithPairs | null
  marketBias: MarketBiasRecord | null
}): TradingViewSignalAnalysis {
  const watchlist = evaluateWeeklyWatchlistGate({
    pair: input.symbol,
    weekPlan: input.weekPlan,
  })
  const pairPlan = watchlist.pairPlan
  const market = input.marketBias
    ? evaluateMarketBias({
        weekly_bias: input.marketBias.weekly_bias,
        daily_bias: input.marketBias.daily_bias,
        h4_bias: input.marketBias.h4_bias,
      })
    : null

  const directionAligned = directionAlignsPair(
    input.direction,
    pairPlan?.directional_bias ?? null,
  )
  const marketBiasAligned = pairPlan?.directional_bias
    ? market
      ? biasAlignsWithPair(market, pairPlan.directional_bias)
      : false
    : Boolean(market?.directional_permission)

  const warNotes: string[] = []
  const warWarnings: string[] = []
  const warStrengths: string[] = []

  if (!watchlist.pairOnList) {
    warWarnings.push(
      `${input.symbol} is not on this week's War Room watchlist — grade capped at D.`,
    )
  } else if (pairPlan) {
    warStrengths.push(`${pairPlan.pair} is on your weekly focus list.`)
    if (pairPlan.weekly_thesis?.trim()) {
      warNotes.push(pairPlan.weekly_thesis.trim().slice(0, 200))
    }
    if (pairPlan.aoi_status === "WAITING") {
      warWarnings.push("AOI status is WAITING — price not in plan zone yet.")
    } else if (pairPlan.aoi_status === "INSIDE_AOI") {
      warStrengths.push("Price is INSIDE your planned AOI.")
    } else if (pairPlan.aoi_status === "CONFIRMING") {
      warStrengths.push("AOI status: CONFIRMING — closer to execution window.")
    } else if (pairPlan.aoi_status === "INVALIDATED") {
      warWarnings.push("Weekly thesis INVALIDATED on this pair.")
    }
    if (!directionAligned && pairPlan.directional_bias !== "Neutral") {
      warWarnings.push(
        `Alert is ${input.direction} but weekly bias is ${pairPlan.directional_bias}.`,
      )
    }
  }

  if (!market) {
    warWarnings.push("HTF market bias not set in War Room.")
  } else if (!market.setup_valid) {
    warWarnings.push(market.conflict_summary ?? "HTF bias conflict — wait for alignment.")
  } else if (market.directional_permission) {
    warStrengths.push(market.alignment_summary)
  } else {
    warWarnings.push(market.alignment_summary)
  }

  let warScore = 50
  if (!watchlist.pairOnList) warScore = 12
  else if (pairPlan?.aoi_status === "INVALIDATED") warScore = 18
  else if (pairPlan?.aoi_status === "WAITING") warScore = 42
  else if (pairPlan?.aoi_status === "INSIDE_AOI") warScore = 72
  else if (pairPlan?.aoi_status === "CONFIRMING") warScore = 78

  if (directionAligned) warScore += 8
  else warScore -= 14
  if (marketBiasAligned) warScore += 6
  if (market && !market.setup_valid) warScore -= 18
  if (watchlist.severity === "blocked") warScore = Math.min(warScore, 20)

  warScore = Math.max(0, Math.min(100, warScore))

  const alignmentScore = Math.round(
    input.technical.confidence_score * 0.42 + warScore * 0.58,
  )

  const setup_grade = deriveGrade({
    compositeScore: alignmentScore,
    pairOnList: watchlist.pairOnList,
    aoiStatus: pairPlan?.aoi_status ?? null,
    directionAligned,
    marketValid: Boolean(market?.setup_valid),
  })

  const setup_verdict = mapVerdict(setup_grade)
  const meets_minimum_grade = gradeMeetsMinimum(setup_grade)
  const recommendation = mapRecommendation(setup_grade)

  const verdict_summary =
    setup_verdict === "trade_ready"
      ? `${input.symbol} ${input.direction} aligns with War Room — process supports entry if you confirm on chart.`
      : setup_verdict === "tradable"
        ? `${input.symbol} ${input.direction} meets your B+ rule — review confirmation before MT5 entry.`
        : setup_verdict === "wait"
          ? `${input.symbol} ${input.direction} — wait for AOI or HTF alignment before sizing up.`
          : `${input.symbol} ${input.direction} is low quality vs your weekly plan — skip per your rules.`

  const war_room: TradingViewWarRoomAlignment = {
    alignment_score: alignmentScore,
    pair_on_watchlist: watchlist.pairOnList,
    aoi_status: pairPlan?.aoi_status ?? null,
    pair_bias: pairPlan?.directional_bias ?? null,
    direction_aligned: directionAligned,
    market_bias_aligned: marketBiasAligned,
    headline: watchlist.headline,
    notes: [...warNotes, ...warWarnings, ...warStrengths].slice(0, 8),
  }

  const summary = `${input.symbol} ${input.direction} · Grade ${setup_grade} · ${setupVerdictLabel(setup_verdict)} · ${alignmentScore}/100`

  return {
    ...input.technical,
    confidence_score: alignmentScore,
    recommendation,
    summary,
    warnings: [...input.technical.warnings, ...warWarnings],
    strengths: [...input.technical.strengths, ...warStrengths],
    war_room,
    setup_grade,
    setup_verdict,
    meets_minimum_grade,
    verdict_summary,
  }
}

export function normalizeSymbolForWarRoom(symbol: string): string {
  return normalizePairSymbol(symbol)
}
