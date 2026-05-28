import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { buildFullTraderContext } from "@/lib/intelligence/trader-context-builder"

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

    return NextResponse.json({
      vyronisCore: context.vyronisCore,
      roadmap: context.vyronisCore?.phases ?? [],
    })
  } catch (error) {
    console.error("Vyronis core error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load Vyronis core" },
      { status: 500 },
    )
  }
}
