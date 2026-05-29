import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  CommandCenterTableMissingError,
  getCommandCenterContext,
} from "@/lib/intelligence/command-center-server-service"
import type { CommandCenterMode } from "@/lib/command-center/types"

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

    const { searchParams } = new URL(request.url)
    const mode = (searchParams.get("mode") || "companion") as CommandCenterMode
    const focusId = searchParams.get("focusId")
    const sessionThreadId = searchParams.get("sessionId")
    const fresh = searchParams.get("fresh") === "1"

    const lean = searchParams.get("lean") === "1"

    const context = await getCommandCenterContext(
      supabase,
      user.id,
      mode,
      focusId || null,
      { sessionThreadId, fresh, lean },
    )
    return NextResponse.json(context)
  } catch (error) {
    if (error instanceof CommandCenterTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Command center context error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load context" },
      { status: 500 },
    )
  }
}
