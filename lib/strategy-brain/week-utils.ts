import { TRADE_PAIRS } from "@/lib/trade-form-config"
import {
  getTradingWeekBoundsFromStartKey,
  getTradingWeekStartKey,
} from "@/lib/trading/trading-week"

/** Week starts Sunday 5:00 PM ET (forex open). */

export function getWeekStartSunday(date = new Date()): string {
  return getTradingWeekStartKey(date, 0)
}

export function formatWeekLabel(weekStart: string): string {
  return getTradingWeekBoundsFromStartKey(weekStart).label
}

/** Same symbols as journal / trade log — majors, crosses, metals, indices. */
export const FOREX_PAIRS: readonly string[] = TRADE_PAIRS
