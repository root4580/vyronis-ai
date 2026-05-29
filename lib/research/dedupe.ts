import type { ImportPreviewRow, NormalizedResearchTrade } from "@/lib/research/types"

export function dedupeWithinBatch(trades: NormalizedResearchTrade[]): {
  unique: NormalizedResearchTrade[]
  duplicatesInBatch: string[]
} {
  const seen = new Set<string>()
  const unique: NormalizedResearchTrade[] = []
  const duplicatesInBatch: string[] = []

  for (const trade of trades) {
    const key = trade.external_ticket
    if (seen.has(key)) {
      duplicatesInBatch.push(key)
      continue
    }
    seen.add(key)
    unique.push(trade)
  }

  return { unique, duplicatesInBatch }
}

export function buildImportPreview(
  trades: NormalizedResearchTrade[],
  existingTickets: Set<string>,
  duplicatesInBatch: string[],
  options?: { replaceExisting?: boolean },
): ImportPreviewRow[] {
  const replaceExisting = options?.replaceExisting ?? false
  const batchDupes = new Set(duplicatesInBatch)

  return trades.map((trade, index) => {
    if (batchDupes.has(trade.external_ticket)) {
      return {
        rowNumber: index + 2,
        external_ticket: trade.external_ticket,
        pair: trade.pair,
        direction: trade.direction,
        result: trade.result,
        pnl: trade.pnl,
        closed_at: trade.closed_at,
        status: "duplicate",
        message: "Duplicate ticket within this CSV batch.",
      }
    }

    if (existingTickets.has(trade.external_ticket)) {
      return {
        rowNumber: index + 2,
        external_ticket: trade.external_ticket,
        pair: trade.pair,
        direction: trade.direction,
        result: trade.result,
        pnl: trade.pnl,
        closed_at: trade.closed_at,
        status: replaceExisting ? "ready" : "duplicate",
        message: replaceExisting
          ? "Will replace existing trade by ticket."
          : "Already imported — skipped.",
      }
    }

    return {
      rowNumber: index + 2,
      external_ticket: trade.external_ticket,
      pair: trade.pair,
      direction: trade.direction,
      result: trade.result,
      pnl: trade.pnl,
      closed_at: trade.closed_at,
      status: "ready",
    }
  })
}

export function filterImportableTrades(
  trades: NormalizedResearchTrade[],
  existingTickets: Set<string>,
  options?: { replaceExisting?: boolean },
): NormalizedResearchTrade[] {
  const { unique } = dedupeWithinBatch(trades)
  if (options?.replaceExisting) return unique
  return unique.filter((trade) => !existingTickets.has(trade.external_ticket))
}
