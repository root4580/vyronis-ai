import type { SupabaseClient } from "@supabase/supabase-js"
import { buildTradePlanCalculation, parseTradePlanNumber } from "@/lib/trade-planner/trade-plan-engine"
import { DEFAULT_USER_SETTINGS } from "@/lib/user-settings"
import type { TradePlanDirection } from "@/lib/trade-planner/types"

type NormalizedAlert = {
  symbol: string
  direction: TradePlanDirection
  entry_price?: string | null
  stop_loss?: number | null
  take_profit?: number | null
}

export async function createTradePlanFromTradingViewAlert(
  supabase: SupabaseClient,
  userId: string,
  normalized: NormalizedAlert,
  options: { accountSize?: number; riskPercent?: number } = {},
): Promise<{ id: string } | null> {
  const entry = parseTradePlanNumber(normalized.entry_price ?? "")
  const stop = normalized.stop_loss ?? 0
  const target = normalized.take_profit ?? 0

  if (entry <= 0 || stop <= 0 || target <= 0) {
    return null
  }

  const accountSize = options.accountSize ?? DEFAULT_USER_SETTINGS.starting_balance
  const riskPercent = options.riskPercent ?? DEFAULT_USER_SETTINGS.max_risk_per_trade

  const calculation = buildTradePlanCalculation({
    pair: normalized.symbol,
    direction: normalized.direction,
    accountSize,
    riskPercent,
    entryPrice: entry,
    stopLoss: stop,
    takeProfit: target,
  })

  const { data, error } = await supabase
    .from("trade_plans")
    .insert({
      user_id: userId,
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
    .select("id")
    .single()

  if (error || !data) {
    console.error("createTradePlanFromTradingViewAlert:", error?.message)
    return null
  }

  return { id: String(data.id) }
}
