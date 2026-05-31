import { NextResponse } from "next/server"
import { buildTradePlanCalculation } from "@/lib/trade-planner/trade-plan-engine"
import type { TradePlanDirection } from "@/lib/trade-planner/types"
import { createClient } from "@/lib/supabase/server"

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
    created_at: String(row.created_at),
  }
}

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

    const { data, error } = await supabase
      .from("trade_plans")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)

    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") {
        return NextResponse.json(
          {
            error: "Run supabase/030-trade-plans.sql to enable Trade Planner saves.",
            code: "MIGRATION_PENDING",
          },
          { status: 503 },
        )
      }
      throw error
    }

    return NextResponse.json({ plans: (data || []).map(mapRow) })
  } catch (error) {
    console.error("Trade plans GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load trade plans" },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
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
      direction?: TradePlanDirection
      accountSize?: number
      riskPercent?: number
      entryPrice?: number
      stopLoss?: number
      takeProfit?: number
    }

    const calculation = buildTradePlanCalculation({
      pair: body.pair || "",
      direction: body.direction === "SELL" ? "SELL" : "BUY",
      accountSize: Number(body.accountSize) || 0,
      riskPercent: Number(body.riskPercent) || 0,
      entryPrice: Number(body.entryPrice) || 0,
      stopLoss: Number(body.stopLoss) || 0,
      takeProfit: Number(body.takeProfit) || 0,
    })

    const { data, error } = await supabase
      .from("trade_plans")
      .insert({
        user_id: user.id,
        pair: calculation.pair,
        direction: calculation.direction,
        account_size: calculation.accountSize,
        risk_percent: calculation.riskPercent,
        entry_price: calculation.entryPrice,
        stop_loss: calculation.stopLoss,
        take_profit: calculation.takeProfit,
        sl_pips: calculation.slPips,
        tp_pips: calculation.tpPips,
        rr: calculation.rr,
        risk_amount: calculation.riskAmount,
        recommended_lots: calculation.recommendedLots,
        pip_value_per_lot: calculation.pipValuePerStandardLot,
        warnings: calculation.warnings,
        suggested_action: calculation.suggestedAction,
        status: "active",
      })
      .select("*")
      .single()

    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") {
        return NextResponse.json(
          {
            error: "Run supabase/030-trade-plans.sql to enable Trade Planner saves.",
            code: "MIGRATION_PENDING",
          },
          { status: 503 },
        )
      }
      throw error
    }

    return NextResponse.json({ plan: mapRow(data) })
  } catch (error) {
    console.error("Trade plans POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save trade plan" },
      { status: 500 },
    )
  }
}
