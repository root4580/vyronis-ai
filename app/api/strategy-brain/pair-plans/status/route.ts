import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  StrategyBrainTableMissingError,
  updatePairPlanStatus,
} from "@/lib/strategy-brain/server-service"
import type { AoiStatus } from "@/lib/strategy-brain/types"

const VALID: AoiStatus[] = ["WAITING", "INSIDE_AOI", "CONFIRMING", "INVALIDATED"]

export async function PATCH(request: NextRequest) {
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
      pair_plan_id?: string
      aoi_status?: AoiStatus
    }

    if (!body.pair_plan_id || !body.aoi_status || !VALID.includes(body.aoi_status)) {
      return NextResponse.json({ error: "Invalid pair plan status payload" }, { status: 400 })
    }

    const pair = await updatePairPlanStatus(
      supabase,
      user.id,
      body.pair_plan_id,
      body.aoi_status,
    )
    return NextResponse.json({ pair })
  } catch (error) {
    if (error instanceof StrategyBrainTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update status" },
      { status: 500 },
    )
  }
}
