import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { buildExecutionReplay } from "@/lib/replay/execution-replay-engine"
import {
  getCoachFeedbackForTrade,
  getLinkedSessionForTrade,
  TradeCoachTableMissingError,
} from "@/lib/trade-coach/server-service"
import { DEFAULT_USER_SETTINGS } from "@/lib/user-settings"

type RouteContext = {
  params: Promise<{ tradeId: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { tradeId } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: trade, error: tradeError } = await supabase
      .from("trades")
      .select("*")
      .eq("id", tradeId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (tradeError || !trade) {
      return NextResponse.json({ error: "Trade not found" }, { status: 404 })
    }

    const [session, feedback] = await Promise.all([
      getLinkedSessionForTrade(supabase, user.id, tradeId),
      getCoachFeedbackForTrade(supabase, user.id, tradeId),
    ])

    const { data: settings } = await supabase
      .from("user_settings")
      .select("max_risk_per_trade")
      .eq("user_id", user.id)
      .maybeSingle()

    const replay = buildExecutionReplay({
      trade: {
        id: String(trade.id),
        pair: trade.pair,
        direction: trade.direction,
        result: trade.result,
        pnl: Number(trade.pnl),
        emotion: trade.emotion,
        emotion_after: trade.emotion_after,
        setup: trade.setup,
        strategy_name: trade.strategy_name,
        risk_percent: trade.risk_percent,
        rule_followed: trade.rule_followed,
        session: trade.session,
        trade_date: trade.trade_date,
        created_at: trade.created_at,
        confirmation_signal: trade.confirmation_signal,
        trade_notes: trade.trade_notes,
        mistake_tags: trade.mistake_tags,
        entry_price: trade.entry_price,
        stop_loss: trade.stop_loss,
        take_profit: trade.take_profit,
        risk_reward: trade.risk_reward,
        screenshot_url: trade.screenshot_url,
      },
      session,
      feedback,
      postTradeAnalysis: null,
      maxRiskPerTrade: settings?.max_risk_per_trade ?? DEFAULT_USER_SETTINGS.max_risk_per_trade,
    })

    return NextResponse.json(replay)
  } catch (error) {
    if (error instanceof TradeCoachTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Execution replay error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to build execution replay" },
      { status: 500 },
    )
  }
}
