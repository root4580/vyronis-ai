import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { buildFullTraderContext } from "@/lib/intelligence/trader-context-builder"
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const context = await buildFullTraderContext(supabase, user.id, {})
  const cognitive = context.cognitive

  return NextResponse.json({
    cognitive,
    computedAt: cognitive?.computedAt ?? null,
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    tradeId?: string
    coachSessionId?: string
    persist?: boolean
  }

  const context = await buildFullTraderContext(supabase, user.id, {})
  const cognitive = context.cognitive

  if (body.persist && cognitive) {
    const { error: persistError } = await supabase.from("cognitive_snapshots").insert({
      user_id: user.id,
      trade_id: body.tradeId ?? null,
      coach_session_id: body.coachSessionId ?? null,
      snapshot: cognitive,
    })
    if (persistError) {
      // Table may not exist until migration 019 is applied
    }
  }

  return NextResponse.json({ cognitive })
}
