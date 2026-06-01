import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getPaperVsLiveStats,
  PaperTradesTableMissingError,
  resolvePaperTradeContext,
} from "@/lib/paper-trades/paper-trade-service"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { accountId } = await resolvePaperTradeContext(supabase, user.id, request)
    const stats = await getPaperVsLiveStats(supabase, user.id, accountId)
    return NextResponse.json(stats)
  } catch (error) {
    if (error instanceof PaperTradesTableMissingError) {
      return NextResponse.json(
        {
          paper: {
            total: 0,
            pending: 0,
            wins: 0,
            losses: 0,
            winRate: 0,
            totalPnL: 0,
            avgRR: null,
            winStreak: 0,
            readyForLive: false,
            graduationMessage: null,
          },
          live: { total: 0, wins: 0, losses: 0, winRate: 0, totalPnL: 0, avgRR: null },
          migrationPending: true,
        },
        { status: 200 },
      )
    }
    console.error("Paper stats GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load paper stats" },
      { status: 500 },
    )
  }
}
