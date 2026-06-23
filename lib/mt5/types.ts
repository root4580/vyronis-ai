export type Mt5TradeWebhookPayload = {
  api_key?: string
  ticket: string | number
  symbol: string
  direction: string
  profit: number
  volume?: number
  open_price?: number
  close_price?: number
  sl?: number
  tp?: number
  commission?: number
  swap?: number
  magic?: number
  open_time?: string
  close_time?: string
  trade_date?: string
  comment?: string
  account_login?: string | number
  broker?: string
  balance?: number
  equity?: number
  research_strategy_id?: string
  replace?: boolean
}

export type Mt5TradeWebhookBatchPayload = {
  api_key?: string
  trades: Mt5TradeWebhookPayload[]
}

import type { Mt5PipelineReport } from "@/lib/mt5/pipeline-log"

export type Mt5TradeWebhookResult = {
  ok: true
  duplicate?: boolean
  trade_id?: string
  ticket: string
  result: "WIN" | "LOSS" | "BE"
  trade_date: string
  message?: string
  pipeline?: Mt5PipelineReport
}

export type Mt5TradeWebhookBatchResult = {
  ok: true
  imported: number
  duplicates: number
  errors: Array<{ ticket?: string; message: string }>
  results: Mt5TradeWebhookResult[]
}
