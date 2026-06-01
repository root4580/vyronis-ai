import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  accountScopeOrFilter,
  resolveActiveAccountId,
  resolveLegacyTradeAccountId,
} from "@/lib/accounts/server-active-account"
import {
  aggregateHeadline,
  buildPlanDisciplineAggregate,
  type PlanDisciplineTradeRow,
} from "@/lib/trade-planner/plan-discipline-aggregate"
import type { MatchableTradePlan } from "@/lib/trade-planner/plan-match"

function mapPlanRow(row: Record<string, unknown>): MatchableTradePlan {
  return {
    id: String(row.id),
    pair: String(row.pair),
    direction: row.direction as MatchableTradePlan["direction"],
    status: row.status as MatchableTradePlan["status"],
    created_at: String(row.created_at),
    accountSize: Number(row.account_size),
    entryPrice: Number(row.entry_price),
    stopLoss: Number(row.stop_loss),
    takeProfit: Number(row.take_profit),
    recommendedLots: row.recommended_lots != null ? Number(row.recommended_lots) : null,
    riskAmount: Number(row.risk_amount),
    rr: row.rr != null ? Number(row.rr) : null,
    riskPercent: Number(row.risk_percent),
  }
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

    let tradesQuery = supabase
      .from("trades")
      .select(
        "id, plan_id, pair, direction, result, pnl, trade_date, created_at, entry_price, stop_loss, take_profit, risk_percent, risk_reward, account_id",
      )
      .eq("user_id", user.id)
      .not("plan_id", "is", null)
      .order("trade_date", { ascending: false })
      .limit(120)

    if (accountId) {
      tradesQuery = tradesQuery.or(accountScopeOrFilter(accountId, legacyAccountId))
    }

    const { data: trades, error: tradesError } = await tradesQuery

    if (tradesError) {
      if (/plan_id|column|schema cache/i.test(tradesError.message)) {
        return NextResponse.json({
          aggregate: buildPlanDisciplineAggregate({ trades: [], plansById: new Map() }),
          headline: "Run supabase/032-plan-journal-link.sql to track plan discipline.",
          migrationPending: true,
        })
      }
      throw tradesError
    }

    const linkedTrades = (trades || []) as PlanDisciplineTradeRow[]
    const planIds = [...new Set(linkedTrades.map((trade) => trade.plan_id).filter(Boolean))] as string[]

    const plansById = new Map<string, MatchableTradePlan>()
    if (planIds.length > 0) {
      let plansQuery = supabase
        .from("trade_plans")
        .select("*")
        .eq("user_id", user.id)
        .in("id", planIds)

      if (accountId) {
        plansQuery = plansQuery.or(accountScopeOrFilter(accountId, legacyAccountId))
      }

      const { data: plans, error: plansError } = await plansQuery

      if (plansError) throw plansError
      for (const row of plans || []) {
        plansById.set(String(row.id), mapPlanRow(row as Record<string, unknown>))
      }
    }

    const aggregate = buildPlanDisciplineAggregate({
      trades: linkedTrades,
      plansById,
    })

    return NextResponse.json({
      aggregate,
      headline: aggregateHeadline(aggregate),
      migrationPending: false,
    })
  } catch (error) {
    console.error("Plan discipline summary error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load plan discipline summary" },
      { status: 500 },
    )
  }
}
