import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getTodayCoachSessionMood,
  saveTodayCoachSessionMood,
} from "@/lib/coach/daily-mood-service"

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

    const mood = await getTodayCoachSessionMood(supabase, user.id)
    return NextResponse.json({ mood })
  } catch (error) {
    console.error("Coach session mood fetch error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load mood" },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as { mood?: string }
    const mood = await saveTodayCoachSessionMood(supabase, user.id, body.mood ?? "")
    return NextResponse.json({ mood })
  } catch (error) {
    console.error("Coach session mood save error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save mood" },
      { status: 400 },
    )
  }
}
