import type { SupabaseClient } from "@supabase/supabase-js"
import { Mt5WebhookError } from "@/lib/mt5/webhook-server-service"
import { recordMt5Ping } from "@/lib/mt5/ping-service"
import type {
  Mt5ScannerStatePayload,
  ScannerPairStateRow,
  ScannerScanState,
  ScannerStateSyncResult,
} from "@/lib/scanner/types"

function isMissingPairStateTable(message: string): boolean {
  return /scanner_pair_state|does not exist|PGRST205/i.test(message)
}

function normalizePair(pair: string): string {
  const clean = pair.replace(/[.\s]/g, "").toUpperCase()
  if (clean.length === 6) {
    return `${clean.slice(0, 3)}/${clean.slice(3)}`
  }
  return pair
}

function normalizeScanState(value?: string): ScannerScanState {
  const v = (value ?? "idle").toLowerCase().replace(/\s+/g, "_")
  if (v === "building") return "building"
  if (v === "waiting_confirmation" || v === "waiting") return "waiting_confirmation"
  if (v === "confirmed") return "confirmed"
  if (v === "alerted") return "alerted"
  return "idle"
}

function parseScannedAt(value?: string): string {
  if (value?.trim()) {
    const parsed = Date.parse(value.replace(/\./g, "-"))
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString()
  }
  return new Date().toISOString()
}

export async function ingestMt5ScannerState(
  supabase: SupabaseClient,
  userId: string,
  raw: Mt5ScannerStatePayload,
): Promise<ScannerStateSyncResult> {
  const pairs = raw.pairs
  if (!Array.isArray(pairs) || pairs.length === 0) {
    throw new Mt5WebhookError("Missing pairs array.", 400)
  }

  const scannedAt = parseScannedAt(raw.scanned_at)
  const now = new Date().toISOString()
  let upserted = 0

  for (const item of pairs) {
    const symbol = (item.pair ?? "").trim()
    if (!symbol) continue

    const pair = normalizePair(symbol)
    const row = {
      user_id: userId,
      pair,
      symbol,
      weekly_bias: item.weekly_bias ?? "Neutral",
      daily_bias: item.daily_bias ?? "Neutral",
      h4_bias: item.h4_bias ?? "Neutral",
      scan_state: normalizeScanState(item.scan_state),
      grade: item.grade ?? "Skip",
      zone_type: item.zone_type ?? null,
      session: item.session ?? null,
      score: Math.round(Number(item.score) || 0),
      direction:
        item.direction === "BUY" || item.direction === "SELL" ? item.direction : null,
      last_scan_at: scannedAt,
      updated_at: now,
    }

    const { error } = await supabase.from("scanner_pair_state").upsert(row, {
      onConflict: "user_id,pair",
    })

    if (error) {
      if (isMissingPairStateTable(error.message)) {
        throw new Mt5WebhookError("Run supabase/049-scanner-pair-state.sql first.", 503)
      }
      throw new Mt5WebhookError(error.message, 500)
    }
    upserted++
  }

  await recordMt5Ping(
    supabase,
    userId,
    { ping: true, ea_version: "scanner-v1.31" },
    `A+ Scanner watchlist sync OK (${upserted} pairs).`,
  )

  return { upserted, scanned_at: scannedAt }
}

export type ScannerWatchlistStats = {
  totalScanned: number
  building: number
  waitingConfirmation: number
  activeSignals: number
}

export function computeWatchlistStats(
  pairs: ScannerPairStateRow[],
  activeSignalCount: number,
): ScannerWatchlistStats {
  return {
    totalScanned: pairs.length,
    building: pairs.filter((p) => p.scan_state === "building").length,
    waitingConfirmation: pairs.filter((p) => p.scan_state === "waiting_confirmation").length,
    activeSignals: activeSignalCount,
  }
}
