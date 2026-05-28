import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  CommandCenterTableMissingError,
  listArchivedCompanionSessions,
} from "@/lib/intelligence/command-center-server-service"

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

    const sessions = await listArchivedCompanionSessions(supabase, user.id)
    return NextResponse.json({ sessions })
  } catch (error) {
    if (error instanceof CommandCenterTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("List companion sessions error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list sessions" },
      { status: 500 },
    )
  }
}
