import type { TradingViewSignalListItem } from "@/lib/tradingview/types"
import { getDashboardTabHref } from "@/lib/dashboard-nav"

/** Deep-link to journal + optional pre-trade coach from a TradingView signal. */
export function getTradingViewSignalHref(signal: TradingViewSignalListItem): string {
  if (signal.coach_session_id) {
    return `${getDashboardTabHref("journal")}&coach=${encodeURIComponent(signal.coach_session_id)}`
  }
  return getDashboardTabHref("journal")
}
