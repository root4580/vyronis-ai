export type ScannerSignalGrade = "A+ Sniper" | "A Strong" | "B Watchlist" | "Skip"

export type ScannerSignalStatus = "active" | "watchlist" | "expired"

export type ScannerScanState =
  | "idle"
  | "building"
  | "waiting_confirmation"
  | "confirmed"
  | "alerted"

export type Mt5ScannerWebhookPayload = {
  api_key?: string
  setup_id: string
  pair: string
  direction: "BUY" | "SELL"
  grade: ScannerSignalGrade | string
  score: number
  weekly_bias?: string
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

export type Mt5ScannerStatePair = {
  pair: string
  weekly_bias?: string
  daily_bias?: string
  h4_bias?: string
  scan_state?: string
  grade?: string
  zone_type?: string
  session?: string
  score?: number
  direction?: string
}

export type Mt5ScannerStatePayload = {
  api_key?: string
  scanned_at?: string
  pairs: Mt5ScannerStatePair[]
}

export type ScannerStateSyncResult = {
  upserted: number
  scanned_at: string
}

export type ScannerWebhookResult = {
  setup_id: string
  signal_id: string
  duplicate: boolean
  status: ScannerSignalStatus
  email_sent?: boolean
  email_skipped?: string
}

export type ScannerSignalRow = {
  id: string
  setup_id: string
  pair: string
  direction: "BUY" | "SELL"
  grade: string
  score: number
  weekly_bias?: string | null
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

export type ScannerPairStateRow = {
  id: string
  pair: string
  symbol: string
  weekly_bias: string
  daily_bias: string
  h4_bias: string
  scan_state: ScannerScanState
  grade: string
  zone_type: string | null
  session: string | null
  score: number
  direction: string | null
  last_scan_at: string
}
