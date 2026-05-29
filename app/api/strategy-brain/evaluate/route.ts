import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  runSetupEvaluation,
  StrategyBrainTableMissingError,
} from "@/lib/strategy-brain/server-service"
import type { StrategySetupEvaluationInput } from "@/lib/strategy-brain/types"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as StrategySetupEvaluationInput
    if (!body.pair?.trim()) {
      return NextResponse.json({ error: "Pair is required" }, { status: 400 })
    }

    const result = await runSetupEvaluation(supabase, user.id, {
      ...body,
      pair: body.pair.trim().toUpperCase(),
      save_snapshot: body.save_snapshot ?? true,
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof StrategyBrainTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Strategy evaluate error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Evaluation failed" },
      { status: 500 },
    )
  }
}
