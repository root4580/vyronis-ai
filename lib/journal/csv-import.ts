import { getRawTradeDateTime } from "@/lib/journal/trade-date-parser"
import type { NormalizedResearchTrade } from "@/lib/research/types"
import { computeSetupScore } from "@/lib/trade-coach/setup-score-engine"
import type { SetupScoreTradeInput } from "@/lib/trade-coach/setup-score-engine"

export type JournalImportDateLog = {
  rowNumber: number
  ticket: string
  originalCsvDateTime: string
  parsedDate: string
  calendarDate: string
  pnl: number
}

export type JournalImportPreviewRow = {
  rowNumber: number
  external_ticket: string
  pair: string
  direction: string
  result: string
  pnl: number
  session: string | null
  risk_reward: number | null
  trade_date: string
  status: "ready" | "duplicate" | "replace" | "needs_date_fix" | "error"
  message?: string
  suggested_emotion?: string
  suggested_setup?: string
  suggested_mistake_tags?: string[]
  screenshot_url?: string | null
}

export type JournalImportResult = {
  dryRun: boolean
  preview: JournalImportPreviewRow[]
  dateLogs: JournalImportDateLog[]
  importedCount: number
  replacedCount: number
  skippedCount: number
  errorCount: number
  errors: string[]
  totalRowsFound: number
  importReadyCount: number
  validRowCount?: number
  needsDateFixCount: number
  summaryMessage: string
  parseDebug?: import("@/lib/journal/csv-parse-pipeline").JournalCsvParseDebug
  columnDiagnostics?: import("@/lib/journal/journal-csv-mapper").JournalCsvColumnDiagnostics
  calendarSummary?: {
    uniqueDates: string[]
    tradesPerDate: Record<string, number>
  }
}

export function buildJournalDateLogs(trades: NormalizedResearchTrade[]): JournalImportDateLog[] {
  return trades.map((trade, index) => ({
    rowNumber: index + 2,
    ticket: trade.external_ticket,
    originalCsvDateTime: getRawTradeDateTime(trade.raw_payload) ?? "",
    parsedDate: trade.closed_at ?? trade.opened_at ?? trade.trade_date,
    calendarDate: trade.trade_date,
    pnl: trade.pnl,
  }))
}

export function buildJournalCalendarSummary(trades: NormalizedResearchTrade[]) {
  const tradesPerDate: Record<string, number> = {}
  for (const trade of trades) {
    tradesPerDate[trade.trade_date] = (tradesPerDate[trade.trade_date] ?? 0) + 1
  }
  return {
    uniqueDates: Object.keys(tradesPerDate).sort(),
    tradesPerDate,
  }
}

export function suggestJournalTags(trade: NormalizedResearchTrade): {
  emotion: string
  setup: string
  mistake_tags: string[]
  trade_notes: string
} {
  const notes = (trade.trade_notes || "").toLowerCase()
  const mistake_tags: string[] = []

  let emotion = "Calm"
  if (trade.result === "LOSS") {
    emotion = /revenge|angry|frustrat/i.test(notes) ? "Revenge" : "Anxious"
    if (trade.risk_reward != null && trade.risk_reward < 1) {
      mistake_tags.push("Poor R:R")
    }
    mistake_tags.push("Loss management")
  } else if (trade.result === "WIN") {
    emotion = trade.risk_reward != null && trade.risk_reward >= 1.5 ? "Confident" : "Calm"
  }

  if (/fomo|chase|early/i.test(notes)) {
    emotion = "FOMO"
    mistake_tags.push("Early entry")
  }

  let setup = "B Setup"
  if (trade.result === "WIN" && (trade.risk_reward ?? 0) >= 1.5) {
    setup = "A+ Setup"
  } else if (trade.result === "LOSS") {
    setup = "C Setup"
  }

  if (trade.session?.includes("London")) {
    mistake_tags.push("London session")
  }

  const trade_notes = [
    "Imported from MT5 CSV.",
    trade.trade_notes?.trim(),
    trade.external_ticket ? `Ticket #${trade.external_ticket}` : null,
  ]
    .filter(Boolean)
    .join(" ")

  return {
    emotion,
    setup,
    mistake_tags: [...new Set(mistake_tags)],
    trade_notes,
  }
}

export function screenshotToJournalInsert(
  userId: string,
  screenshotUrl: string,
  index: number,
  maxRiskPerTrade = 1,
) {
  const today = new Date().toISOString().slice(0, 10)
  const externalTicket = `journal-img-${Date.now()}-${index}`

  const setupInput: SetupScoreTradeInput = {
    direction: "BUY",
    result: "BE",
    emotion: "Calm",
    setup: "B Setup",
    strategy_name: null,
    risk_percent: maxRiskPerTrade,
    rule_followed: true,
    session: null,
    trade_date: today,
    mistake_tags: "Screenshot import",
  }

  const setupScore = computeSetupScore({ trade: setupInput, maxRiskPerTrade })

  return {
    pair: "Chart import",
    direction: "BUY" as const,
    result: "BE" as const,
    pnl: 0,
    emotion: "Calm",
    setup: "B Setup",
    strategy_name: null,
    risk_percent: maxRiskPerTrade,
    rule_followed: true,
    user_id: userId,
    trade_date: today,
    session: null,
    screenshot_url: screenshotUrl,
    trade_notes: "Imported from chart screenshot. Edit pair, result, and notes to complete the journal entry.",
    mistake_tags: "Screenshot import",
    setup_score: setupScore.score,
    setup_classification: setupScore.classification,
    setup_score_breakdown: setupScore.breakdown,
    setup_coaching_insights: setupScore.insights,
    import_source: "journal_csv" as const,
    external_ticket: externalTicket,
    research_strategy_id: null,
  }
}

export function normalizedToJournalInsert(
  trade: NormalizedResearchTrade,
  userId: string,
  maxRiskPerTrade = 1,
  screenshotUrl?: string | null,
) {
  const suggestions = suggestJournalTags(trade)

  const setupInput: SetupScoreTradeInput = {
    direction: trade.direction,
    result: trade.result,
    emotion: suggestions.emotion,
    setup: suggestions.setup,
    strategy_name: null,
    risk_percent: maxRiskPerTrade,
    rule_followed: true,
    session: trade.session,
    trade_date: trade.trade_date,
    mistake_tags: suggestions.mistake_tags.join(","),
    entry_price: null,
    stop_loss: trade.stop_loss,
    take_profit: trade.take_profit,
    risk_reward: trade.risk_reward,
  }

  const setupScore = computeSetupScore({ trade: setupInput, maxRiskPerTrade })

  return {
    pair: trade.pair,
    direction: trade.direction,
    result: trade.result,
    pnl: trade.pnl,
    emotion: suggestions.emotion,
    setup: suggestions.setup,
    strategy_name: null,
    risk_percent: maxRiskPerTrade,
    rule_followed: true,
    user_id: userId,
    trade_date: trade.trade_date,
    session: trade.session,
    entry_price: null,
    stop_loss: trade.stop_loss,
    take_profit: trade.take_profit,
    risk_reward: trade.risk_reward,
    emotion_after: trade.result === "LOSS" ? "Anxious" : trade.result === "WIN" ? "Calm" : null,
    mistake_tags: suggestions.mistake_tags.length ? suggestions.mistake_tags.join(",") : null,
    trade_notes: suggestions.trade_notes,
    screenshot_url: screenshotUrl ?? null,
    setup_score: setupScore.score,
    setup_classification: setupScore.classification,
    setup_score_breakdown: setupScore.breakdown,
    setup_coaching_insights: setupScore.insights,
    import_source: "journal_csv" as const,
    external_ticket: trade.external_ticket,
    opened_at: trade.opened_at,
    closed_at: trade.closed_at,
    lots: trade.lots,
    commission: trade.commission,
    swap: trade.swap,
    raw_payload: trade.raw_payload,
    research_strategy_id: null,
  }
}
