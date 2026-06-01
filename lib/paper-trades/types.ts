export type PaperTradeResult = "PENDING" | "WIN" | "LOSS" | "BREAKEVEN"

export type PaperTradeSource = "practice" | "war_room" | "webhook"

export type PaperTradeRecord = {
  id: string
  user_id: string
  account_id: string | null
  symbol: string
  direction: string
  entry: number | null
  sl: number | null
  tp: number | null
  close_price: number | null
  result: PaperTradeResult
  pips: number | null
  rr: number | null
  pnl: number
  is_paper: boolean
  notes: string
  source: PaperTradeSource
  source_ref: string | null
  setup_grade: string | null
  entry_at: string
  created_at: string
  closed_at: string | null
}

export type PaperTradeInput = {
  symbol: string
  direction: string
  entry?: number | null
  sl?: number | null
  tp?: number | null
  notes?: string
  source?: PaperTradeSource
  source_ref?: string | null
  setup_grade?: string | null
  account_id?: string | null
}

/** Partial input for opening the paper trade modal from War Room / alerts. */
export type PaperTradeDraft = Partial<PaperTradeInput> & {
  symbol: string
  direction: string
}

export type ClosePaperTradeInput = {
  close_price: number
  result: Exclude<PaperTradeResult, "PENDING">
  pips?: number | null
  rr?: number | null
  pnl?: number | null
  notes?: string
}

export type PaperTradeStats = {
  total: number
  pending: number
  wins: number
  losses: number
  winRate: number
  totalPnL: number
  avgRR: number | null
  winStreak: number
  readyForLive: boolean
  graduationMessage: string | null
}

export type PaperVsLiveStats = {
  paper: PaperTradeStats
  live: {
    total: number
    wins: number
    losses: number
    winRate: number
    totalPnL: number
    avgRR: number | null
  }
}
