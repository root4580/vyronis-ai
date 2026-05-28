import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { buildFullTraderContext } from "@/lib/intelligence/trader-context-builder"
import {
  loadLifeContextHistory,
  upsertLifeContextEntry,
} from "@/lib/adaptive-cognition/server-service"
import type { LifeContextEntry } from "@/lib/adaptive-cognition/types"

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

    const context = await buildFullTraderContext(supabase, user.id, {})
    const lifeHistory = await loadLifeContextHistory(supabase, user.id, 14)

    return NextResponse.json({
      adaptiveCognition: context.adaptiveCognition,
      lifeContextHistory: lifeHistory,
    })
  } catch (error) {
    console.error("Adaptive cognition GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load" },
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

    const body = (await request.json()) as {
      lifeContext?: LifeContextEntry
      reflection?: { mode: string; reflection: string }
    }

    if (body.lifeContext) {
      const result = await upsertLifeContextEntry(supabase, user.id, body.lifeContext)
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
    }

    if (body.reflection?.mode && body.reflection.reflection) {
      await supabase.from("personal_os_checkins").insert({
        user_id: user.id,
        mode: body.reflection.mode,
        reflection: body.reflection.reflection,
      })
    }

    const context = await buildFullTraderContext(supabase, user.id, {})

    return NextResponse.json({ adaptiveCognition: context.adaptiveCognition, saved: true })
  } catch (error) {
    console.error("Adaptive cognition POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save" },
      { status: 500 },
    )
  }
}
