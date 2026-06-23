import type { ScannerBias } from "@/lib/scanner/scoring"
import type { ScannerPairStateRow, ScannerScanState } from "@/lib/scanner/types"
import type { ScannerWatchlistPair } from "@/lib/scanner/signal-types"

function parseBias(value: string): ScannerBias {
  const v = value.toLowerCase()
  if (v === "bullish") return "Bullish"
  if (v === "bearish") return "Bearish"
  return "Neutral"
}

function scanStateLabel(state: ScannerScanState): string {
  switch (state) {
    case "building":
      return "Building"
    case "waiting_confirmation":
      return "Waiting Confirmation"
    case "confirmed":
      return "Confirmed"
    case "alerted":
      return "Alerted"
    default:
      return "Idle"
  }
}

export function rowToWatchlistPair(row: ScannerPairStateRow): ScannerWatchlistPair {
  return {
    id: row.id,
    pair: row.pair,
    weeklyBias: parseBias(row.weekly_bias),
    dailyBias: parseBias(row.daily_bias),
    h4Bias: parseBias(row.h4_bias),
    session: row.session ?? "Off",
    scanState: scanStateLabel(row.scan_state),
    grade: row.grade,
    zoneType: row.zone_type ?? "None",
    score: row.score,
    direction: row.direction === "BUY" || row.direction === "SELL" ? row.direction : null,
    lastScanAt: row.last_scan_at,
  }
}
