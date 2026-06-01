import { TRADE_PLANNER_PAIRS } from "@/lib/trade-planner/forex-pairs"
import type { CalendarWatchlistCurrency } from "@/lib/economic-calendar/constants"

const FOREX_PAIRS = TRADE_PLANNER_PAIRS.filter((pair) => !pair.startsWith("XAU") && !pair.startsWith("XAG"))

export function pairContainsCurrency(pair: string, currency: string): boolean {
  const normalized = pair.replace(/[^A-Za-z]/g, "").toUpperCase()
  const code = currency.toUpperCase()
  return normalized.startsWith(code) || normalized.endsWith(code)
}

export function pairsInvolvingCurrency(currency: string): string[] {
  return FOREX_PAIRS.filter((pair) => pairContainsCurrency(pair, currency))
}

export function pairsAvoidingCurrency(currency: string, limit = 6): string[] {
  return FOREX_PAIRS.filter((pair) => !pairContainsCurrency(pair, currency)).slice(0, limit)
}

export function pairsAvoidingCurrencies(currencies: string[], limit = 6): string[] {
  const blocked = new Set(currencies.map((currency) => currency.toUpperCase()))
  return FOREX_PAIRS.filter((pair) => {
    const base = pair.slice(0, 3)
    const quote = pair.slice(3, 6)
    return !blocked.has(base) && !blocked.has(quote)
  }).slice(0, limit)
}

export function formatPairForSpeech(pair: string): string {
  const normalized = pair.replace(/[^A-Za-z]/g, "").toUpperCase()
  if (normalized.length < 6) return normalized
  return `${normalized.slice(0, 3)}/${normalized.slice(3, 6)}`
}

export function isWatchlistCurrency(value: string): value is CalendarWatchlistCurrency {
  return ["USD", "EUR", "AUD", "GBP", "CHF", "NZD", "CAD", "JPY"].includes(value.toUpperCase())
}
