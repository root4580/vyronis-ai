/** Client event so all SignalAlertsBell instances refresh after ingest / test alert. */
export const TRADINGVIEW_SIGNALS_REFRESH_EVENT = "vyronis:tradingview-signals-refresh"

export function notifyTradingViewSignalsRefresh(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(TRADINGVIEW_SIGNALS_REFRESH_EVENT))
}
