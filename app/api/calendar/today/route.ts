import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getTodayCalendarSnapshot } from "@/lib/economic-calendar/service"

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

    const snapshot = await getTodayCalendarSnapshot()
    return NextResponse.json(snapshot)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch calendar" },
      { status: 500 },
    )
  }
}
