import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { ScannerPairStateRow } from "@/lib/scanner/types"
import { rowToWatchlistPair } from "@/lib/scanner/map-pair-state"
import { computeWatchlistStats } from "@/lib/scanner/scanner-state-service"
import { MOCK_WATCHLIST } from "@/lib/scanner/mock-data"

export const dynamic = "force-dynamic"

const LIVE_GRADES = ["A+ Sniper", "A Strong", "A+", "A"]

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: pairRows, error: pairError } = await supabase
    .from("scanner_pair_state")
    .select("*")
    .eq("user_id", user.id)
    .order("pair", { ascending: true })

  if (pairError) {
    if (/scanner_pair_state|does not exist|PGRST205/i.test(pairError.message)) {
      return NextResponse.json({
        pairs: MOCK_WATCHLIST,
        stats: {
          totalScanned: MOCK_WATCHLIST.length,
          building: 1,
          waitingConfirmation: 1,
          activeSignals: 1,
        },
        tableMissing: true,
      })
    }
    return NextResponse.json({ error: pairError.message }, { status: 500 })
  }

  const { count: activeCount } = await supabase
    .from("scanner_signals")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "active")
    .in("grade", LIVE_GRADES)

  const pairs = (pairRows as ScannerPairStateRow[]).map(rowToWatchlistPair)
  const stats = computeWatchlistStats(pairRows as ScannerPairStateRow[], activeCount ?? 0)

  return NextResponse.json({ pairs, stats })
}
