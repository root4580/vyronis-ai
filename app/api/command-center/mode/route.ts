import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  CommandCenterTableMissingError,
  switchCommandCenterMode,
} from "@/lib/intelligence/command-center-server-service"
import type { CommandCenterMode } from "@/lib/command-center/types"

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

    const body = (await request.json()) as {
      mode?: CommandCenterMode
      focusId?: string | null
      label?: string
      direction?: "enter" | "exit"
    }

    const mode = body.mode ?? "companion"
    const context = await switchCommandCenterMode(supabase, user.id, {
      mode,
      focusId: body.focusId ?? null,
      label: body.label,
      direction: body.direction,
    })

    return NextResponse.json(context)
  } catch (error) {
    if (error instanceof CommandCenterTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Command center mode switch error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to switch mode" },
      { status: 500 },
    )
  }
}
