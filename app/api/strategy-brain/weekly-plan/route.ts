import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getOrCreateWeeklyPlan,
  getWeeklyPlanWithPairs,
  saveWeeklyPairPlans,
  StrategyBrainTableMissingError,
  updateWeeklyPlanNotes,
} from "@/lib/strategy-brain/server-service"
import { getWeekStartSunday } from "@/lib/strategy-brain/week-utils"
import type { PairPlanInput } from "@/lib/strategy-brain/types"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const week =
      request.nextUrl.searchParams.get("week") ?? getWeekStartSunday()
    let plan = await getWeeklyPlanWithPairs(supabase, user.id, week)
    if (!plan) {
      const created = await getOrCreateWeeklyPlan(supabase, user.id, week)
      plan = { ...created, pairs: [] }
    }
    return NextResponse.json(plan)
  } catch (error) {
    if (error instanceof StrategyBrainTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load weekly plan" },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest) {
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
      week_start?: string
      session_notes?: string
      pairs?: PairPlanInput[]
    }

    const week = body.week_start ?? getWeekStartSunday()
    const plan = await getOrCreateWeeklyPlan(supabase, user.id, week)

    if (typeof body.session_notes === "string") {
      await updateWeeklyPlanNotes(supabase, user.id, plan.id, body.session_notes)
    }

    if (Array.isArray(body.pairs)) {
      await saveWeeklyPairPlans(supabase, user.id, plan.id, body.pairs)
    }

    const updated = await getWeeklyPlanWithPairs(supabase, user.id, week)
    return NextResponse.json(updated ?? { ...plan, pairs: [] })
  } catch (error) {
    if (error instanceof StrategyBrainTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save weekly plan" },
      { status: 500 },
    )
  }
}
