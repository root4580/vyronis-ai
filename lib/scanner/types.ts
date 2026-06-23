export type ScannerSignalGrade = "A+ Sniper" | "A Strong" | "B Watchlist" | "Skip"

export type ScannerSignalStatus = "active" | "watchlist" | "expired"

export type Mt5ScannerWebhookPayload = {
  api_key?: string
  setup_id: string
  pair: string
  direction: "BUY" | "SELL"
  grade: ScannerSignalGrade | string
  score: number
  daily_bias: string
  h4_bias: string
  zone_type: string
  confirmation_type: string
  risk_reward: number
  session: string
  sweep?: string
  choch?: string
  status?: ScannerSignalStatus
  entry?: number
  stop_loss?: number
  take_profit?: number
  detected_at?: string
  bos_bonus?: boolean
}

export type ScannerWebhookResult = {
  setup_id: string
  signal_id: string
  duplicate: boolean
  status: ScannerSignalStatus
}

export type ScannerSignalRow = {
  id: string
  setup_id: string
  pair: string
  direction: "BUY" | "SELL"
  grade: string
  score: number
  daily_bias: string
  h4_bias: string
  zone_type: string
  confirmation_type: string
  risk_reward: number
  session: string
  sweep: string | null
  choch: string | null
  status: ScannerSignalStatus
  entry_price: number | null
  stop_loss: number | null
  take_profit: number | null
  detected_at: string
  raw_payload?: Record<string, unknown>
}
