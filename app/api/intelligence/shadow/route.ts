import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { evaluateShadowMode } from "@/lib/autonomous/shadow-mode-engine"
import { buildFullTraderContext } from "@/lib/intelligence/trader-context-builder"
import { persistShadowAssessment } from "@/lib/autonomous/server-service"

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
      coachSessionId?: string | null
      persist?: boolean
    }

    const context = await buildFullTraderContext(supabase, user.id, {
      focusId: body.focusId ?? null,
    })

    const shadow = evaluateShadowMode({
      context,
      plannedContext: context.activePlannedContext,
    })

    if (body.persist !== false) {
      await persistShadowAssessment(supabase, user.id, shadow, {
        coachSessionId: body.coachSessionId,
        triggerSource: "api",
      })
    }

    return NextResponse.json({ shadow, autonomous: context.autonomous })
  } catch (error) {
    console.error("Shadow assessment error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Shadow assessment failed" },
      { status: 500 },
    )
  }
}
