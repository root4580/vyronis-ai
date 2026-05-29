import { parseMistakeTags } from "@/lib/trade-form-config"
import type { ConfirmationChecklist, TradeMemoryTrade } from "@/lib/strategy-brain/types"

const EARLY_TAGS = new Set([
  "Early entry",
  "Late entry",
  "No confirmation",
  "Chased price",
  "Poor timing",
])

const LOSS_RESULTS = new Set(["loss", "Loss", "LOSS", "breakeven"])

export function findSimilarTradeMemory(input: {
  pair: string
  trades: TradeMemoryTrade[]
  confirmation: ConfirmationChecklist
  emotionUnstable?: boolean
}): string | null {
  const { pair, trades, confirmation, emotionUnstable } = input
  const normalizedPair = pair.toUpperCase().replace(/\s/g, "")
  const pairTrades = trades.filter(
    (t) => t.pair.toUpperCase().replace(/\s/g, "") === normalizedPair,
  )
  if (pairTrades.length === 0) return null

  const losses = pairTrades.filter((t) => LOSS_RESULTS.has(t.result) || t.pnl < 0)
  if (losses.length === 0) return null

  const earlyEntryLosses = losses.filter((t) => {
    const tags = parseMistakeTags(t.mistake_tags)
    return tags.some((tag) => EARLY_TAGS.has(tag))
  })

  const noConfirmation =
    !confirmation.break_and_retest && !confirmation.ltf_structure_shift

  if (earlyEntryLosses.length >= 2 && noConfirmation) {
    const recent = earlyEntryLosses.slice(0, 3)
    const pairLabel = pair.toUpperCase()
    return `This resembles your last ${recent.length} ${pairLabel} loss${recent.length > 1 ? "es" : ""} where entry was taken before full confirmation.`
  }

  if (emotionUnstable) {
    const emotionalLosses = losses.filter((t) => {
      const e = (t.emotion || "").toLowerCase()
      return e.includes("fomo") || e.includes("revenge") || e.includes("anxious")
    })
    if (emotionalLosses.length >= 2) {
      return `This resembles ${emotionalLosses.length} prior ${pair.toUpperCase()} losses taken under emotional pressure — wait for reset before sizing.`
    }
  }

  const continuationLosses = losses.filter((t) => {
    const sig = (t.confirmation_signal || "").toLowerCase()
    return sig.includes("continuation") || sig.includes("breakout")
  })
  if (continuationLosses.length >= 3 && noConfirmation) {
    return `This resembles your last ${Math.min(3, continuationLosses.length)} continuation losses after emotional overtrading on ${pair.toUpperCase()}.`
  }

  const lastLoss = losses[0]
  if (lastLoss && noConfirmation) {
    return `Last ${pair.toUpperCase()} loss (${lastLoss.trade_date ?? "recent"}) — compare confirmation before repeating the same entry pace.`
  }

  return null
}
