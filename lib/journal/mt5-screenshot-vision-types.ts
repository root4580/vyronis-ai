export type Mt5ScreenshotSource =
  | "mt5_positions"
  | "mt5_history"
  | "mt5_order"
  | "mt5_chart"
  | "unknown"

export type Mt5ScreenshotAutofill = {
  available: boolean
  source: Mt5ScreenshotSource
  pair: string
  direction: "BUY" | "SELL" | ""
  entry_price: number | null
  stop_loss: number | null
  take_profit: number | null
  close_price: number | null
  volume_lots: number | null
  profit: number | null
  result: "WIN" | "LOSS" | "BREAKEVEN" | ""
  trade_date: string | null
  session: string | null
  /** Opening time as printed on MT5 (broker server clock). */
  open_time_raw: string | null
  close_time_raw: string | null
  /** Human label after conversion, e.g. "11:49 AM EDT → New York". */
  session_est_label: string | null
  summary: string
  confidence: number
}
