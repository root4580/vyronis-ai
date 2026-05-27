import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { buildJournalIntelligenceForTrade } from "@/lib/learning/server-service"

type RouteContext = { params: Promise<{ tradeId: string }> }

export async function GET(_request: Request, context: RouteContext) {
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

    const journal = await buildJournalIntelligenceForTrade(supabase, user.id, tradeId)
    return NextResponse.json(journal)
  } catch (error) {
    console.error("Journal intelligence error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to build journal intelligence" },
      { status: 500 },
    )
  }
}
