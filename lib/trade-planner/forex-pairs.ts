/** Standard contract size for one forex lot (units of base currency). */
export const STANDARD_LOT_UNITS = 100_000

/** All pairs supported in Trade Planner (forex + metals; excludes index CFDs). */
export const TRADE_PLANNER_PAIRS = [
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "USDCHF",
  "USDCAD",
  "AUDUSD",
  "NZDUSD",
  "EURGBP",
  "EURJPY",
  "EURCHF",
  "EURCAD",
  "EURAUD",
  "EURNZD",
  "GBPJPY",
  "GBPCHF",
  "GBPCAD",
  "GBPAUD",
  "GBPNZD",
  "AUDJPY",
  "AUDCHF",
  "AUDCAD",
  "AUDNZD",
  "NZDJPY",
  "NZDCHF",
  "NZDCAD",
  "CADJPY",
  "CADCHF",
  "CHFJPY",
  "XAUUSD",
  "XAGUSD",
] as const

export type TradePlannerPair = (typeof TRADE_PLANNER_PAIRS)[number]

export function normalizeTradePlannerPair(pair: string): string {
  return pair.replace(/[^A-Za-z]/g, "").toUpperCase()
}

export function isSupportedPlannerPair(pair: string): boolean {
  const normalized = normalizeTradePlannerPair(pair)
  return TRADE_PLANNER_PAIRS.includes(normalized as TradePlannerPair)
}

/** Pip size in price terms for the pair. */
export function getPipSize(pair: string): number {
  const normalized = normalizeTradePlannerPair(pair)
  if (normalized.startsWith("XAU")) return 0.01
  if (normalized.startsWith("XAG")) return 0.001
  if (normalized.endsWith("JPY")) return 0.01
  return 0.0001
}

/** Approximate USD pip value per 1.0 standard lot (100k units). Uses entry for dynamic pairs. */
export function getPipValuePerStandardLot(pair: string, entryPrice: number): number {
  const normalized = normalizeTradePlannerPair(pair)
  const pipSize = getPipSize(normalized)
  const safeEntry = entryPrice > 0 ? entryPrice : getDefaultQuoteRate(normalized)

  if (normalized.startsWith("XAU")) return 1
  if (normalized.startsWith("XAG")) return 5

  const base = normalized.slice(0, 3)
  const quote = normalized.slice(3, 6)

  // Quote is USD — e.g. EURUSD, GBPUSD, AUDUSD, NZDUSD → ~$10/pip/lot
  if (quote === "USD" && base !== "USD") {
    return pipSize * STANDARD_LOT_UNITS
  }

  // Base is USD — e.g. USDJPY, USDCAD, USDCHF
  if (base === "USD" && quote !== "USD") {
    return (pipSize * STANDARD_LOT_UNITS) / safeEntry
  }

  // JPY crosses — e.g. EURJPY, GBPJPY
  if (quote === "JPY") {
    return (pipSize * STANDARD_LOT_UNITS) / safeEntry
  }

  // Other quote currencies — static USD approximations for planning
  if (quote === "CAD") return 7.3
  if (quote === "CHF") return 10.5
  if (quote === "GBP") return 12.5
  if (quote === "AUD") return 6.5
  if (quote === "NZD") return 6.0

  return 10
}

function getDefaultQuoteRate(pair: string): number {
  const normalized = normalizeTradePlannerPair(pair)
  if (normalized === "USDJPY" || normalized.endsWith("JPY")) return 150
  if (normalized === "USDCAD") return 1.35
  if (normalized === "USDCHF") return 0.88
  if (normalized.startsWith("XAU")) return 2300
  if (normalized.startsWith("XAG")) return 28
  if (normalized.endsWith("GBP")) return 0.85
  if (normalized.endsWith("AUD")) return 0.65
  if (normalized.endsWith("NZD")) return 0.6
  if (normalized.endsWith("CAD")) return 1.35
  if (normalized.endsWith("CHF")) return 0.88
  return 1.1
}
