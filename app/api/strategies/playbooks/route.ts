import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  createStrategyPlaybook,
  listStrategyPlaybooks,
  StrategyPlaybookTableMissingError,
} from "@/lib/strategy/server-service"
import type { StrategyPlaybookInput } from "@/lib/strategy/types"

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

    const playbooks = await listStrategyPlaybooks(supabase, user.id)
    return NextResponse.json(playbooks)
  } catch (error) {
    if (error instanceof StrategyPlaybookTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Strategy playbooks list error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch strategy playbooks" },
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

    const body = (await request.json()) as Partial<StrategyPlaybookInput>
    const playbook = await createStrategyPlaybook(supabase, user.id, body)
    return NextResponse.json(playbook)
  } catch (error) {
    if (error instanceof StrategyPlaybookTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Strategy playbook create error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create strategy playbook" },
      { status: 500 },
    )
  }
}
