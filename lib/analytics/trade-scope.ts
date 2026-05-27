import type { AnalyticsTradeScope } from "@/lib/research/types"

/** Manual journal trades only — excludes MT5 research imports. */
export function isManualImportSource(importSource: string | null | undefined): boolean {
  return !importSource || importSource === "manual"
}

export function isResearchImportSource(importSource: string | null | undefined): boolean {
  return importSource === "mt5_csv" || importSource === "mt5_webhook"
}

export function filterTradesByScope<T extends { import_source?: string | null }>(
  trades: T[],
  scope: AnalyticsTradeScope,
): T[] {
  if (scope === "all") return trades

  if (scope === "manual") {
    return trades.filter((trade) => isManualImportSource(trade.import_source))
  }

  return trades.filter((trade) => isResearchImportSource(trade.import_source))
}

/** Supabase PostgREST filter for trade queries. */
export function manualTradesOrFilter(): string {
  return "import_source.eq.manual,import_source.is.null"
}

export function researchTradesOrFilter(): string {
  return "import_source.eq.mt5_csv,import_source.eq.mt5_webhook"
}
