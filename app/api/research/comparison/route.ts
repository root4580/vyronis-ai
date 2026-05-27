import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { assertResearchLabEnabled, ResearchLabDisabledError } from "@/lib/research/feature-flag"
import { fetchUserTradesForAnalytics } from "@/lib/analytics/fetch-trades"
import { buildResearchStrategyComparison } from "@/lib/research/strategy-comparison"
import { listResearchStrategies } from "@/lib/research/server-service"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await assertResearchLabEnabled(supabase, user.id)

    const [tradesResult, strategies] = await Promise.all([
      fetchUserTradesForAnalytics(supabase, user.id, "research"),
      listResearchStrategies(supabase, user.id),
    ])

    if (tradesResult.error) {
      return NextResponse.json({ error: tradesResult.error }, { status: 500 })
    }

    const comparison = buildResearchStrategyComparison(tradesResult.trades, strategies)
    return NextResponse.json(comparison)
  } catch (error) {
    if (error instanceof ResearchLabDisabledError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    console.error("Research comparison GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load comparison" },
      { status: 500 },
    )
  }
}
