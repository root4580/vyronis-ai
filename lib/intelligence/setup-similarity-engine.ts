import { parseMistakeTags } from "@/lib/trade-form-config"
import { getTradeRiskReward } from "@/lib/trade-form-utils"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"
import type { RecentTradeMemory } from "@/lib/intelligence/conversational-types"
import type {
  SetupSimilarityMatch,
  SetupSimilarityResult,
  SimilarityDimension,
} from "@/lib/intelligence/intelligence-types"

type HistoricalTrade = RecentTradeMemory & {
  setup?: string | null
  setup_classification?: string | null
  mistake_tags?: string | null
  confirmation_signal?: string | null
  risk_reward?: number | null
  entry_price?: number | null
  stop_loss?: number | null
  take_profit?: number | null
  higher_timeframe?: string | null
}

function normalizeText(value?: string | null): string {
  return String(value || "")
    .trim()
    .toLowerCase()
}

function scoreDimension(match: boolean, partial = false): number {
  if (match) return 100
  if (partial) return 45
  return 0
}

function comparePair(planned: PreTradePlannedContext, trade: HistoricalTrade): SimilarityDimension {
  const plannedPair = normalizeText(planned.pair)
  const tradePair = normalizeText(trade.pair)
  const match = plannedPair.length > 0 && plannedPair === tradePair
  return {
    key: "pair",
    label: "Pair",
    score: scoreDimension(match),
    match,
    detail: match ? `${trade.pair} matches` : `${trade.pair} vs ${planned.pair || "unknown"}`,
  }
}

function compareSession(planned: PreTradePlannedContext, trade: HistoricalTrade): SimilarityDimension {
  const plannedSession = normalizeText(planned.session)
  const tradeSession = normalizeText(trade.session)
  const match = plannedSession.length > 0 && plannedSession === tradeSession
  const partial =
    !match &&
    plannedSession.length > 0 &&
    tradeSession.length > 0 &&
    (plannedSession.includes(tradeSession) || tradeSession.includes(plannedSession))
  return {
    key: "session",
    label: "Session",
    score: scoreDimension(match, partial),
    match: match || partial,
    detail: match
      ? `Same session (${trade.session})`
      : partial
        ? `Related session (${trade.session})`
        : `Different session (${trade.session || "unknown"})`,
  }
}

function compareSetupType(planned: PreTradePlannedContext, trade: HistoricalTrade): SimilarityDimension {
  const plannedSetup = normalizeText(planned.setup || planned.strategy_name)
  const tradeSetup = normalizeText(trade.setup || trade.setup_classification)
  const match =
    plannedSetup.length > 0 &&
    tradeSetup.length > 0 &&
    (plannedSetup === tradeSetup ||
      plannedSetup.includes(tradeSetup) ||
      tradeSetup.includes(plannedSetup))
  return {
    key: "setup",
    label: "Setup type",
    score: scoreDimension(match),
    match,
    detail: match
      ? `Similar setup (${trade.setup || trade.setup_classification})`
      : `Different setup (${trade.setup || trade.setup_classification || "unknown"})`,
  }
}

function compareMistakes(_planned: PreTradePlannedContext, trade: HistoricalTrade): SimilarityDimension {
  const tradeTags = parseMistakeTags(trade.mistake_tags)
  if (tradeTags.length === 0) {
    return {
      key: "mistakes",
      label: "Mistakes",
      score: 35,
      match: false,
      detail: "No tagged mistakes on historical trade",
    }
  }
  return {
    key: "mistakes",
    label: "Mistakes",
    score: 65,
    match: true,
    detail: `Historical mistakes: ${tradeTags.slice(0, 3).join(", ")}`,
  }
}

function compareEmotion(planned: PreTradePlannedContext, trade: HistoricalTrade): SimilarityDimension {
  const plannedEmotion = normalizeText(planned.emotion)
  const tradeEmotion = normalizeText(trade.emotion)
  const match = plannedEmotion.length > 0 && plannedEmotion === tradeEmotion
  const risky = ["fomo", "revenge", "euphoric", "anxious", "tilted"].includes(plannedEmotion)
  return {
    key: "emotion",
    label: "Emotion",
    score: match ? 100 : risky && trade.result === "LOSS" ? 70 : 25,
    match,
    detail: match
      ? `Same emotion (${trade.emotion})`
      : risky
        ? `Planned ${planned.emotion} — similar trades often struggled`
        : `Emotion ${trade.emotion || "unknown"}`,
  }
}

function compareRiskReward(planned: PreTradePlannedContext, trade: HistoricalTrade): SimilarityDimension {
  const plannedRr = getTradeRiskReward({
    direction: planned.direction || "LONG",
    entry_price: planned.entry_price ? Number(planned.entry_price) : null,
    stop_loss: planned.stop_loss ? Number(planned.stop_loss) : null,
    take_profit: planned.take_profit ? Number(planned.take_profit) : null,
  })
  const tradeRr = getTradeRiskReward({
    direction: trade.direction,
    risk_reward: trade.risk_reward,
    entry_price: trade.entry_price,
    stop_loss: trade.stop_loss,
    take_profit: trade.take_profit,
  })

  if (plannedRr == null || tradeRr == null) {
    return {
      key: "rr",
      label: "Risk:Reward",
      score: 40,
      match: false,
      detail: "R:R data incomplete",
    }
  }

  const delta = Math.abs(plannedRr - tradeRr)
  const match = delta <= 0.5
  const partial = delta <= 1
  return {
    key: "rr",
    label: "Risk:Reward",
    score: scoreDimension(match, partial),
    match: match || partial,
    detail: `Planned ~${plannedRr.toFixed(1)}R vs historical ${tradeRr.toFixed(1)}R`,
  }
}

function compareHtfAlignment(planned: PreTradePlannedContext, trade: HistoricalTrade): SimilarityDimension {
  const plannedHtf = normalizeText(planned.higher_timeframe)
  const tradeHtf = normalizeText(trade.higher_timeframe)
  if (!plannedHtf && !tradeHtf) {
    return {
      key: "htf",
      label: "HTF alignment",
      score: 40,
      match: false,
      detail: "HTF not logged",
    }
  }
  const match = plannedHtf.length > 0 && plannedHtf === tradeHtf
  return {
    key: "htf",
    label: "HTF alignment",
    score: scoreDimension(match),
    match,
    detail: match
      ? `Same HTF (${trade.higher_timeframe})`
      : `HTF ${trade.higher_timeframe || "unknown"} vs planned ${planned.higher_timeframe || "unknown"}`,
  }
}

function scoreTrade(
  planned: PreTradePlannedContext,
  trade: HistoricalTrade,
): SetupSimilarityMatch {
  const dimensions = [
    comparePair(planned, trade),
    compareSession(planned, trade),
    compareSetupType(planned, trade),
    compareMistakes(planned, trade),
    compareEmotion(planned, trade),
    compareRiskReward(planned, trade),
    compareHtfAlignment(planned, trade),
  ]

  const weights = [0.2, 0.12, 0.18, 0.12, 0.14, 0.12, 0.12]
  const similarityScore = Math.round(
    dimensions.reduce((sum, dim, index) => sum + dim.score * weights[index], 0),
  )

  const matchedDims = dimensions.filter((d) => d.match).map((d) => d.label.toLowerCase())
  const summary =
    matchedDims.length > 0
      ? `${trade.result} on ${trade.pair} — overlap on ${matchedDims.join(", ")} (${similarityScore}% similar)`
      : `${trade.result} on ${trade.pair} — low structural overlap (${similarityScore}%)`

  return {
    tradeId: trade.id,
    pair: trade.pair,
    result: trade.result,
    pnl: trade.pnl,
    session: trade.session ?? null,
    similarityScore,
    dimensions,
    summary,
  }
}

export function compareSetupToHistory(input: {
  planned: PreTradePlannedContext
  trades: HistoricalTrade[]
  minScore?: number
}): SetupSimilarityResult {
  const matches = input.trades
    .map((trade) => scoreTrade(input.planned, trade))
    .filter((m) => m.similarityScore >= (input.minScore ?? 35))
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, 5)

  const overallScore =
    matches.length > 0
      ? Math.round(matches.reduce((sum, m) => sum + m.similarityScore, 0) / matches.length)
      : 0

  const wins = matches.filter((m) => m.result === "WIN").length
  const losses = matches.filter((m) => m.result === "LOSS").length

  let narrative = "No strong historical matches for this setup profile yet."
  if (matches.length > 0) {
    narrative = `Found ${matches.length} similar trade${matches.length === 1 ? "" : "s"} — ${wins} win${wins === 1 ? "" : "s"}, ${losses} loss${losses === 1 ? "" : "es"}. Average similarity ${overallScore}%.`
  }

  return { overallScore, matchCount: matches.length, topMatches: matches, narrative }
}
