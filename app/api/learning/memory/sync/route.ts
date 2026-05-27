import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { syncTradeMemoryForUser } from "@/lib/learning/server-service"

export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await syncTradeMemoryForUser(supabase, user.id)
    return NextResponse.json(result)
  } catch (error) {
    console.error("Learning memory sync error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync trade memory" },
      { status: 500 },
    )
  }
}
