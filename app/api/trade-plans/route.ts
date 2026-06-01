import { NextResponse } from "next/server"
import { buildTradePlanCalculation } from "@/lib/trade-planner/trade-plan-engine"
import { planIdsToExpire } from "@/lib/trade-planner/plan-match"
import type { TradePlanDirection } from "@/lib/trade-planner/types"
import { createClient } from "@/lib/supabase/server"
import {
  accountScopeOrFilter,
  resolveActiveAccountId,
  resolveLegacyTradeAccountId,
} from "@/lib/accounts/server-active-account"
import { getTradingRulesSnapshot } from "@/lib/trading-rules/trading-rules-service"

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

async function expireStaleActivePlans(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  rows: { id: string; status: string; created_at: string }[],
) {
  const ids = planIdsToExpire(
    rows.map((row) => ({
      id: row.id,
      status: row.status as "active" | "executed" | "skipped" | "expired",
      created_at: row.created_at,
    })),
  )

  if (ids.length === 0) return rows

  await supabase
    .from("trade_plans")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .in("id", ids)
    .eq("user_id", userId)
    .eq("status", "active")

  return rows.map((row) => (ids.includes(row.id) ? { ...row, status: "expired" } : row))
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const accountId = await resolveActiveAccountId(supabase, user.id, request)
    const legacyAccountId = await resolveLegacyTradeAccountId(supabase, user.id)

    let query = supabase
      .from("trade_plans")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(40)

    if (accountId) {
      query = query.or(accountScopeOrFilter(accountId, legacyAccountId))
    }

    const { data, error } = await query

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

    const rows = await expireStaleActivePlans(supabase, user.id, data || [])

    return NextResponse.json({ plans: rows.map(mapRow) })
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

    const accountId = await resolveActiveAccountId(supabase, user.id, request)

    if (accountId) {
      const snapshot = await getTradingRulesSnapshot(supabase, user.id, accountId)
      if (snapshot && !snapshot.canSavePlan) {
        return NextResponse.json({ error: snapshot.blockReason ?? "Trading blocked" }, { status: 403 })
      }
    }

    const { data, error } = await supabase
      .from("trade_plans")
      .insert({
        user_id: user.id,
        account_id: accountId,
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
