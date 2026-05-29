export type ResearchImportSource = "mt5_csv" | "mt5_webhook" | "manual"

export type ResearchStrategyRecord = {
  id: string
  user_id: string
  name: string
  description: string
  magic_number: number | null
  playbook_id: string | null
  account_type: "demo"
  is_active: boolean
  color: string
  created_at: string
  updated_at: string
}

export type ResearchStrategyInput = {
  name: string
  description?: string
  magic_number?: number | null
  color?: string
}

export type ResearchImportBatchRecord = {
  id: string
  user_id: string
  research_strategy_id: string
  source: "mt5_csv"
  filename: string | null
  row_count: number
  imported_count: number
  skipped_count: number
  error_count: number
  status: "pending" | "completed" | "failed"
  errors: ResearchImportError[]
  created_at: string
  completed_at: string | null
}

export type ResearchImportError = {
  row: number
  ticket?: string
  message: string
}

export type Mt5CsvRow = Record<string, string>

export type NormalizedResearchTrade = {
  external_ticket: string
  pair: string
  direction: "BUY" | "SELL"
  result: "WIN" | "LOSS" | "BE"
  pnl: number
  trade_date: string
  opened_at: string | null
  closed_at: string | null
  entry_price?: number | null
  lots: number | null
  commission: number | null
  swap: number | null
  stop_loss: number | null
  take_profit: number | null
  risk_reward: number | null
  magic_number: number | null
  account_login: string | null
  broker: string | null
  trade_notes: string | null
  session: string | null
  raw_payload: Record<string, string>
}

export type ParsedMt5CsvResult = {
  headers: string[]
  rows: Mt5CsvRow[]
  format: "deals" | "orders" | "history" | "unknown"
  delimiter?: string
  headerMapping?: Record<string, string>
  columnDiagnostics?: import("@/lib/journal/journal-csv-mapper").JournalCsvColumnDiagnostics
}

export type ImportPreviewRow = {
  rowNumber: number
  external_ticket: string
  pair: string
  direction: string
  result: string
  pnl: number
  closed_at: string | null
  status: "ready" | "duplicate" | "invalid"
  message?: string
}

export type CsvImportResult = {
  batchId: string
  imported: number
  skipped: number
  errors: ResearchImportError[]
  preview?: ImportPreviewRow[]
}

export type AnalyticsTradeScope = "manual" | "research" | "all"
