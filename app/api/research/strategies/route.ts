import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  ResearchLabDisabledError,
  ResearchLabTableMissingError,
} from "@/lib/research/feature-flag"
import {
  createResearchStrategy,
  listResearchStrategies,
} from "@/lib/research/server-service"
import type { ResearchStrategyInput } from "@/lib/research/types"

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

    const strategies = await listResearchStrategies(supabase, user.id)
    return NextResponse.json(strategies)
  } catch (error) {
    if (error instanceof ResearchLabDisabledError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    if (error instanceof ResearchLabTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Research strategies GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load strategies" },
      { status: 500 },
    )
  }
}

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

    const body = (await request.json()) as Partial<ResearchStrategyInput>
    const strategy = await createResearchStrategy(supabase, user.id, {
      name: body.name || "",
      description: body.description,
      magic_number: body.magic_number ?? null,
      color: body.color,
    })

    return NextResponse.json(strategy)
  } catch (error) {
    if (error instanceof ResearchLabDisabledError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    if (error instanceof ResearchLabTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Research strategies POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create strategy" },
      { status: 500 },
    )
  }
}
