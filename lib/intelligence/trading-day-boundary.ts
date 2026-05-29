import type { FullTraderContext } from "@/lib/intelligence/intelligence-types"
import type { RecentTradeMemory } from "@/lib/intelligence/conversational-types"
import { getTodayTrades } from "@/lib/user-settings"

const IMPULSIVE = new Set([
  "fomo",
  "revenge",
  "euphoric",
  "anxious",
  "tilted",
  "impulsive",
  "frustrated",
])

export function getContextTodayTrades(
  context: Pick<FullTraderContext, "recentTrades">,
  now = new Date(),
): RecentTradeMemory[] {
  return getTodayTrades(context.recentTrades, now)
}

/** Local calendar day with zero logged trades — daily guardrails reset at midnight. */
export function isFreshTradingDay(
  context: Pick<FullTraderContext, "recentTrades">,
  now = new Date(),
): boolean {
  return getContextTodayTrades(context, now).length === 0
}

export function isImpulsiveEmotion(emotion: string | null | undefined): boolean {
  if (!emotion) return false
  return IMPULSIVE.has(emotion.toLowerCase().trim())
}

/** Today-only instability (planned emotion, today's journal, today's bad trades). */
export function hasActiveSessionInstability(
  context: Pick<
    FullTraderContext,
    "recentTrades" | "activePlannedContext" | "emotionalState"
  >,
  now = new Date(),
): boolean {
  const planned = String(context.activePlannedContext?.emotion || "").toLowerCase()
  if (isImpulsiveEmotion(planned)) return true

  const todayTrades = getContextTodayTrades(context, now)
  if (todayTrades.some((t) => isImpulsiveEmotion(t.emotion))) return true

  const todayLosses = todayTrades.filter((t) => t.result === "LOSS").length
  if (todayTrades.length > 0 && todayLosses >= 2) return true

  if (
    todayTrades.length > 0 &&
    context.emotionalState.trend === "volatile" &&
    context.emotionalState.impulsiveCount >= 1
  ) {
    return true
  }

  return false
}

/** Prior-day psychology alone must not trigger stand-down / critical pause. */
export function allowHistoricalStandDown(
  context: Pick<
    FullTraderContext,
    "recentTrades" | "activePlannedContext" | "emotionalState" | "sessionRecovery"
  >,
  now = new Date(),
): boolean {
  if (!isFreshTradingDay(context, now)) return true
  return hasActiveSessionInstability(context, now)
}

export function isHistoricalCautionOnly(
  context: Pick<FullTraderContext, "sessionRecovery">,
): boolean {
  const r = context.sessionRecovery
  return (
    r?.carryoverMode === "historical_caution" &&
    r.sessionGuardMode === "soft_caution"
  )
}

/** Chart coach / planned setup — not general companion chat. */
export function isPreTradeDecisionContext(
  context: Pick<FullTraderContext, "activePlannedContext">,
): boolean {
  return Boolean(context.activePlannedContext?.pair)
}

/** Strict reflection / block rules (today activity or active trade review). */
export function shouldApplyStrictPreTradeGate(
  context: Pick<
    FullTraderContext,
    "recentTrades" | "activePlannedContext" | "emotionalState" | "sessionRecovery"
  >,
  now = new Date(),
): boolean {
  if (isPreTradeDecisionContext(context)) return true
  if (!isFreshTradingDay(context, now)) return true
  return hasActiveSessionInstability(context, now)
}
