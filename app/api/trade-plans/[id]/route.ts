import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { TradePlanDirection } from "@/lib/trade-planner/types"

function mapRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    pair: String(row.pair),
    direction: row.direction as TradePlanDirection,
    accountSize: Number(row.account_size),
    riskPercent: Number(row.risk_percent),
    entryPrice: Number(row.entry_price),
    stopLoss: Number(row.stop_loss),
    takeProfit: Number(row.take_profit),
    slPips: Number(row.sl_pips),
    tpPips: Number(row.tp_pips),
    rr: row.rr != null ? Number(row.rr) : null,
    riskAmount: Number(row.risk_amount),
    recommendedLots: row.recommended_lots != null ? Number(row.recommended_lots) : null,
    pipValuePerStandardLot: row.pip_value_per_lot != null ? Number(row.pip_value_per_lot) : 0,
    warnings: Array.isArray(row.warnings) ? row.warnings : [],
    suggestedAction: String(row.suggested_action),
    status: String(row.status),
    executed_trade_id: row.executed_trade_id != null ? String(row.executed_trade_id) : null,
    created_at: String(row.created_at),
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
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

    const { data, error } = await supabase
      .from("trade_plans")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") {
        return NextResponse.json(
          { error: "Run supabase/032-plan-journal-link.sql", code: "MIGRATION_PENDING" },
          { status: 503 },
        )
      }
      throw error
    }

    if (!data) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    return NextResponse.json({ plan: mapRow(data) })
  } catch (error) {
    console.error("Trade plan GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load trade plan" },
      { status: 500 },
    )
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: planId } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as {
      action?: "execute" | "skip"
      tradeId?: string
    }

    if (body.action === "skip") {
      const { data, error } = await supabase
        .from("trade_plans")
        .update({ status: "skipped", updated_at: new Date().toISOString() })
        .eq("id", planId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .select("*")
        .maybeSingle()

      if (error) throw error
      if (!data) {
        return NextResponse.json({ error: "Plan not found or not active" }, { status: 404 })
      }

      return NextResponse.json({ plan: mapRow(data) })
    }

    if (body.action !== "execute" || !body.tradeId) {
      return NextResponse.json({ error: "Provide action execute with tradeId" }, { status: 400 })
    }

    const tradeId = body.tradeId

    const { data: plan, error: planError } = await supabase
      .from("trade_plans")
      .select("*")
      .eq("id", planId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (planError) throw planError
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }
    if (plan.status !== "active") {
      return NextResponse.json({ error: "Plan is no longer active" }, { status: 409 })
    }

    const { data: trade, error: tradeError } = await supabase
      .from("trades")
      .select("id")
      .eq("id", tradeId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (tradeError) throw tradeError
    if (!trade) {
      return NextResponse.json({ error: "Trade not found" }, { status: 404 })
    }

    const { error: linkTradeError } = await supabase
      .from("trades")
      .update({ plan_id: planId })
      .eq("id", tradeId)
      .eq("user_id", user.id)

    if (linkTradeError) {
      if (/plan_id|column|schema cache/i.test(linkTradeError.message)) {
        return NextResponse.json(
          { error: "Run supabase/032-plan-journal-link.sql", code: "MIGRATION_PENDING" },
          { status: 503 },
        )
      }
      throw linkTradeError
    }

    const { data: updatedPlan, error: updatePlanError } = await supabase
      .from("trade_plans")
      .update({
        status: "executed",
        executed_trade_id: tradeId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", planId)
      .eq("user_id", user.id)
      .select("*")
      .single()

    if (updatePlanError) throw updatePlanError

    return NextResponse.json({ plan: mapRow(updatedPlan) })
  } catch (error) {
    console.error("Trade plan PATCH error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update trade plan" },
      { status: 500 },
    )
  }
}
