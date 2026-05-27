import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  deleteStrategyPlaybook,
  getStrategyPlaybook,
  StrategyPlaybookTableMissingError,
  updateStrategyPlaybook,
} from "@/lib/strategy/server-service"
import type { StrategyPlaybookInput } from "@/lib/strategy/types"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const playbook = await getStrategyPlaybook(supabase, user.id, id)
    if (!playbook) {
      return NextResponse.json({ error: "Playbook not found" }, { status: 404 })
    }

    return NextResponse.json(playbook)
  } catch (error) {
    if (error instanceof StrategyPlaybookTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Strategy playbook fetch error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch strategy playbook" },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as Partial<StrategyPlaybookInput>
    const playbook = await updateStrategyPlaybook(supabase, user.id, id, body)
    return NextResponse.json(playbook)
  } catch (error) {
    if (error instanceof StrategyPlaybookTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Strategy playbook update error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update strategy playbook" },
      { status: 500 },
    )
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await deleteStrategyPlaybook(supabase, user.id, id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof StrategyPlaybookTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Strategy playbook delete error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete strategy playbook" },
      { status: 500 },
    )
  }
}
