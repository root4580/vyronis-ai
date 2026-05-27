import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getRecentAiReviews } from "@/lib/learning/server-service"

export async function GET(request: NextRequest) {
  try {
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? "4")
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const reviews = await getRecentAiReviews(supabase, user.id, Number.isFinite(limit) ? limit : 4)
    return NextResponse.json(reviews)
  } catch (error) {
    console.error("Learning reviews error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load reviews" },
      { status: 500 },
    )
  }
}
