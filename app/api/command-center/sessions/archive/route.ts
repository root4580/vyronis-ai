import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  archiveActiveCompanionSession,
  CommandCenterTableMissingError,
  listThreadMessages,
} from "@/lib/intelligence/command-center-server-service"

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

    const result = await archiveActiveCompanionSession(supabase, user.id, listThreadMessages)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof CommandCenterTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Archive companion session error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to archive session" },
      { status: 500 },
    )
  }
}
