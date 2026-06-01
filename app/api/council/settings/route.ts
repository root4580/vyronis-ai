import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  CouncilTablesMissingError,
  updateCouncilSettings,
} from "@/lib/council/server-service"
import type { CouncilSettingsUpdateInput } from "@/lib/council/types"

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as CouncilSettingsUpdateInput
    const settings = await updateCouncilSettings(supabase, user.id, body)
    return NextResponse.json({ settings })
  } catch (error) {
    if (error instanceof CouncilTablesMissingError) {
      return NextResponse.json(
        { error: error.message, migrationPending: true },
        { status: 503 },
      )
    }
    console.error("Council settings PATCH error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update council settings" },
      { status: 500 },
    )
  }
}
