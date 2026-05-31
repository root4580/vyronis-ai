export type TradePlanDirection = "BUY" | "SELL"

export type TradePlanInput = {
  pair: string
  direction: TradePlanDirection
  accountSize: number
  riskPercent: number
  entryPrice: number
  stopLoss: number
  takeProfit: number
}

export type TradePlanWarning = {
  id: string
  message: string
}

export type TradePlanSuggestedAction = "plan_valid" | "adjust_plan" | "skip_plan"

/** Lifecycle status for a saved pre-trade plan row. */
export type TradePlanStatus = "active" | "executed" | "skipped" | "expired"

export type TradePlanCalculation = {
  pair: string
  direction: TradePlanDirection
  accountSize: number
  riskPercent: number
  entryPrice: number
  stopLoss: number
  takeProfit: number
  slPips: number
  tpPips: number
  rr: number | null
  riskAmount: number
  pipValuePerStandardLot: number
  recommendedLots: number | null
  warnings: TradePlanWarning[]
  suggestedAction: TradePlanSuggestedAction
  suggestedActionLabel: string
}

export type SavedTradePlan = TradePlanCalculation & {
  id: string
  user_id: string
  status: TradePlanStatus
  created_at: string
}
