import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { buildFullTraderContext } from "@/lib/intelligence/trader-context-builder"
import { syncAutonomousPersistence } from "@/lib/autonomous/server-service"

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
    const focusId = searchParams.get("focusId")

    const context = await buildFullTraderContext(supabase, user.id, {
      focusId,
    })

    return NextResponse.json({
      autonomous: context.autonomous,
      engines: context.autonomous ? "active" : null,
    })
  } catch (error) {
    console.error("Autonomous intelligence error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load autonomous intelligence" },
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

    const body = (await request.json().catch(() => ({}))) as {
      focusId?: string | null
      persistShadow?: boolean
      coachSessionId?: string | null
    }

    const context = await buildFullTraderContext(supabase, user.id, {
      focusId: body.focusId ?? null,
    })

    if (context.autonomous) {
      await syncAutonomousPersistence(supabase, user.id, context.autonomous, {
        persistShadow: body.persistShadow,
        coachSessionId: body.coachSessionId ?? undefined,
      })
    }

    return NextResponse.json({ autonomous: context.autonomous, persisted: true })
  } catch (error) {
    console.error("Autonomous sync error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync autonomous intelligence" },
      { status: 500 },
    )
  }
}
