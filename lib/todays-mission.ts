import { parseMistakeTags } from "@/lib/trade-form-config"
import {
  getTodayTrades,
  type SettingsTrade,
  type UserSettingsForm,
} from "@/lib/user-settings"

export type TodaysMissionItem = {
  id: string
  label: string
  checked: boolean
  /** When false, item is aspirational until today's trades provide journal proof. */
  verifiable: boolean
}

function biasAlignedWithDirection(bias: string | null | undefined, direction: string): boolean | null {
  const normalized = bias?.trim().toLowerCase() ?? ""
  if (!normalized || normalized === "neutral") return null
  if (direction === "BUY") return normalized === "bullish"
  if (direction === "SELL") return normalized === "bearish"
  return null
}

function tradeHasConfirmation(trade: SettingsTrade & { confirmation_type?: string | null }): boolean {
  const confirmation = trade.confirmation_type?.trim().toLowerCase() ?? ""
  return confirmation !== "" && confirmation !== "none"
}

function tradeHasHtfAlignment(trade: SettingsTrade & {
  direction?: string
  weekly_bias?: string | null
  daily_bias?: string | null
  h4_bias?: string | null
}): boolean {
  const direction = trade.direction ?? "BUY"
  const biases = [
    biasAlignedWithDirection(trade.weekly_bias, direction),
    biasAlignedWithDirection(trade.daily_bias, direction),
    biasAlignedWithDirection(trade.h4_bias, direction),
  ].filter((value) => value !== null)
  return biases.length > 0 && biases.filter(Boolean).length >= 2
}

function tradeSetAndForget(trade: SettingsTrade & { mistake_tags?: string | null }): boolean {
  const tags = parseMistakeTags(trade.mistake_tags).map((tag) => tag.toLowerCase())
  return !tags.some((tag) => tag.includes("moved stop"))
}

function tradeJournaledAfterClose(trade: SettingsTrade & {
  trade_notes?: string | null
  reflection_chart_url?: string | null
  result?: string
}): boolean {
  if (!trade.result || trade.result === "OPEN") return true
  return Boolean(trade.trade_notes?.trim() || trade.reflection_chart_url?.trim())
}

export function buildTodaysMission(
  settings: UserSettingsForm,
  trades: SettingsTrade[],
  referenceDate = new Date(),
): TodaysMissionItem[] {
  const todayTrades = getTodayTrades(trades, referenceDate)
  const hasTradesToday = todayTrades.length > 0

  const riskVerifiedTrades = todayTrades.filter((trade) => trade.risk_percent != null)
  const riskCompliant =
    !hasTradesToday ||
    (riskVerifiedTrades.length === todayTrades.length &&
      riskVerifiedTrades.every((trade) => (trade.risk_percent ?? 0) <= settings.max_risk_per_trade))

  const tradesWithinLimit = todayTrades.length <= settings.max_trades_per_day

  const confirmationChecked =
    hasTradesToday && todayTrades.every((trade) => tradeHasConfirmation(trade as never))

  const htfChecked =
    hasTradesToday && todayTrades.every((trade) => tradeHasHtfAlignment(trade as never))

  const setForgetChecked =
    hasTradesToday && todayTrades.every((trade) => tradeSetAndForget(trade as never))

  const journalChecked =
    hasTradesToday && todayTrades.every((trade) => tradeJournaledAfterClose(trade as never))

  return [
    {
      id: "max-trades",
      label: `Max ${settings.max_trades_per_day} trades`,
      checked: tradesWithinLimit,
      verifiable: true,
    },
    {
      id: "risk",
      label: `Risk ${settings.max_risk_per_trade}%`,
      checked: riskCompliant,
      verifiable: hasTradesToday,
    },
    {
      id: "confirmation",
      label: "Wait for confirmation",
      checked: confirmationChecked,
      verifiable: hasTradesToday,
    },
    {
      id: "htf-bias",
      label: "Follow HTF bias",
      checked: htfChecked,
      verifiable: hasTradesToday,
    },
    {
      id: "set-forget",
      label: "Set & Forget",
      checked: setForgetChecked,
      verifiable: hasTradesToday,
    },
    {
      id: "journal",
      label: "Journal immediately after close",
      checked: journalChecked,
      verifiable: hasTradesToday,
    },
  ]
}
