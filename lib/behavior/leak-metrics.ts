import { getSignedPnL } from "@/lib/trade-utils"
import type { BehaviorTrade, LeakEvidence } from "@/lib/behavior/types"
import { isLossTrade } from "@/lib/behavior/trade-context"

export function computeLossRate(trades: BehaviorTrade[]): number {
  if (trades.length === 0) return 0
  const losses = trades.filter(isLossTrade).length
  return Math.round((losses / trades.length) * 100)
}

export function estimateMoneyLost(trades: BehaviorTrade[]): number {
  return trades.reduce((sum, trade) => {
    const signed = getSignedPnL(trade.pnl, trade.result)
    return signed < 0 ? sum + Math.abs(signed) : sum
  }, 0)
}

export function computeRecencyWeight(trades: BehaviorTrade[], allTrades: BehaviorTrade[]): number {
  if (trades.length === 0 || allTrades.length === 0) return 0
  const latest = allTrades[allTrades.length - 1]?.timestamp ?? 0
  const segmentLatest = trades[trades.length - 1]?.timestamp ?? 0
  const windowMs = 30 * 24 * 60 * 60 * 1000
  const age = Math.max(0, latest - segmentLatest)
  return Math.max(0.35, 1 - age / windowMs)
}

export function buildLeakEvidence(
  segment: BehaviorTrade[],
  universe: BehaviorTrade[],
): LeakEvidence {
  const complement = universe.filter((trade) => !segment.some((row) => row.id === trade.id))
  const segmentLossRate = computeLossRate(segment)
  const baselineLossRate = computeLossRate(complement)
  const lossRateDelta = Math.max(0, segmentLossRate - baselineLossRate)

  return {
    sampleCount: segment.length,
    frequencyPercent:
      universe.length > 0 ? Math.round((segment.length / universe.length) * 100) : 0,
    segmentLossRate,
    baselineLossRate,
    lossRateDelta,
    estimatedMoneyLost: Math.round(estimateMoneyLost(segment.filter(isLossTrade))),
    lookbackTradeCount: universe.length,
  }
}

export function scoreLeakConfidence(
  evidence: LeakEvidence,
  recencyWeight: number,
): number {
  if (evidence.sampleCount < 5) return 0

  const sampleBoost = Math.min(28, evidence.sampleCount * 2.5)
  const effectBoost = Math.min(36, evidence.lossRateDelta * 1.15)
  const moneyBoost = Math.min(14, evidence.estimatedMoneyLost / 120)
  const frequencyBoost = Math.min(10, evidence.frequencyPercent * 0.2)
  const recencyBoost = recencyWeight * 12

  return Math.round(
    Math.min(96, sampleBoost + effectBoost + moneyBoost + frequencyBoost + recencyBoost),
  )
}

export function formatMoney(amount: number): string {
  const rounded = Math.round(amount)
  if (rounded >= 1000) return `$${(rounded / 1000).toFixed(1)}k`
  return `$${rounded}`
}
