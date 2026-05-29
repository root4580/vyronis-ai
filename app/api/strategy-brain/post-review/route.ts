import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  StrategyBrainTableMissingError,
  upsertPostTradeReview,
} from "@/lib/strategy-brain/server-service"
import type { PostTradeReviewAnswers } from "@/lib/strategy-brain/types"

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

    const body = (await request.json()) as {
      trade_id?: string
      answers?: PostTradeReviewAnswers
    }

    if (!body.trade_id || !body.answers) {
      return NextResponse.json({ error: "trade_id and answers required" }, { status: 400 })
    }

    const saved = await upsertPostTradeReview(
      supabase,
      user.id,
      body.trade_id,
      body.answers,
    )
    return NextResponse.json(saved)
  } catch (error) {
    if (error instanceof StrategyBrainTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Post review failed" },
      { status: 500 },
    )
  }
}
