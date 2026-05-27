import type { AnalyticsTradeScope } from "@/lib/research/types"

/** Manual journal entries — excludes all CSV imports. */
export function isManualImportSource(importSource: string | null | undefined): boolean {
  return !importSource || importSource === "manual"
}

/** Journal CSV / screenshot imports. */
export function isJournalCsvImportSource(importSource: string | null | undefined): boolean {
  return importSource === "journal_csv"
}

/** Research Lab MT5 imports — not shown in journal. */
export function isResearchImportSource(importSource: string | null | undefined): boolean {
  return importSource === "mt5_csv" || importSource === "mt5_webhook"
}

export function isJournalTrade<T extends { import_source?: string | null }>(trade: T): boolean {
  return isManualImportSource(trade.import_source) || isJournalCsvImportSource(trade.import_source)
}

export function filterTradesByScope<T extends { import_source?: string | null }>(
  trades: T[],
  scope: AnalyticsTradeScope,
): T[] {
  if (scope === "all") return trades

  if (scope === "manual") {
    return trades.filter((trade) => isJournalTrade(trade))
  }

  return trades.filter((trade) => isResearchImportSource(trade.import_source))
}

/** Journal list: manual entries + journal CSV imports (excludes research lab). */
export function journalTradesOrFilter(): string {
  return "import_source.eq.manual,import_source.eq.journal_csv,import_source.is.null"
}

/** @deprecated Use journalTradesOrFilter — kept for backwards compatibility. */
export function manualTradesOrFilter(): string {
  return journalTradesOrFilter()
}

export function researchTradesOrFilter(): string {
  return "import_source.eq.mt5_csv,import_source.eq.mt5_webhook"
}
