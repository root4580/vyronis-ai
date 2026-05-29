import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { evaluateEmotionCheck } from "@/lib/strategy-brain/emotion-engine"
import {
  saveEmotionCheck,
  StrategyBrainTableMissingError,
} from "@/lib/strategy-brain/server-service"
import type { EmotionCheckAnswers } from "@/lib/strategy-brain/types"

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
      pair?: string
      trade_id?: string
      answers: EmotionCheckAnswers
    }

    if (!body.answers) {
      return NextResponse.json({ error: "Answers required" }, { status: 400 })
    }

    const result = evaluateEmotionCheck(body.answers)
    const saved = await saveEmotionCheck(
      supabase,
      user.id,
      body.pair?.trim().toUpperCase() ?? null,
      body.answers,
      body.trade_id,
    )

    return NextResponse.json({ ...saved, result })
  } catch (error) {
    if (error instanceof StrategyBrainTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Emotion check failed" },
      { status: 500 },
    )
  }
}
