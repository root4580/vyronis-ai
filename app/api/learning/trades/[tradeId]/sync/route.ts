import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { syncTradeMemoryForTrade } from "@/lib/learning/server-service"

type RouteContext = { params: Promise<{ tradeId: string }> }

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { tradeId } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await syncTradeMemoryForTrade(supabase, user.id, tradeId)
    return NextResponse.json(result)
  } catch (error) {
    console.error("Trade learning sync error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync trade memory" },
      { status: 500 },
    )
  }
}
