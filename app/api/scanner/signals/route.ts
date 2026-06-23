import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { ScannerSignalRow } from "@/lib/scanner/types"
import type { ScannerLiveSignal } from "@/lib/scanner/signal-types"
import { rowToLiveSignal } from "@/lib/scanner/map-signal-row"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("scanner_signals")
    .select("*")
    .eq("user_id", user.id)
    .in("status", ["active", "watchlist"])
    .order("detected_at", { ascending: false })
    .limit(50)

  if (error) {
    if (/scanner_signals|does not exist|PGRST205/i.test(error.message)) {
      return NextResponse.json({ signals: [], tableMissing: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const signals: ScannerLiveSignal[] = (data as ScannerSignalRow[]).map(rowToLiveSignal)
  return NextResponse.json({ signals })
}
