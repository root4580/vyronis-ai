import { calculateRiskReward, formatRiskReward } from "@/lib/trade-form-utils"

export type ResolvedTradeRiskReward = {
  value: number | null
  display: string
  source: "risk_reward" | "rr" | "calculated" | "not_provided"
  note: string
  passesVyronisMinimum: boolean
}

type RrTrade = {
  direction: string
  risk_reward?: number | null
  rr?: number | null
  entry_price?: number | null
  stop_loss?: number | null
  take_profit?: number | null
}

export function resolveTradeRiskReward(trade: RrTrade): ResolvedTradeRiskReward {
  const fromRiskReward =
    trade.risk_reward != null && Number.isFinite(trade.risk_reward) && trade.risk_reward > 0
      ? trade.risk_reward
      : null
  const fromRr =
    trade.rr != null && Number.isFinite(trade.rr) && trade.rr > 0 ? trade.rr : null
  const calculated = calculateRiskReward({
    direction: trade.direction,
    entry_price: trade.entry_price?.toString() ?? "",
    stop_loss: trade.stop_loss?.toString() ?? "",
    take_profit: trade.take_profit?.toString() ?? "",
  })

  const value = fromRiskReward ?? fromRr ?? calculated
  if (value == null) {
    return {
      value: null,
      display: "Not provided",
      source: "not_provided",
      note: "Risk:Reward: Not verified from journal data.",
      passesVyronisMinimum: false,
    }
  }

  const source = fromRiskReward ? "risk_reward" : fromRr ? "rr" : "calculated"
  const display = `${value.toFixed(2)}R`
  const passesVyronisMinimum = value >= 2
  const note = passesVyronisMinimum
    ? `Risk:Reward: verified at ${display} — passes the 1:2 Vyronis rule.`
    : value >= 1.5
      ? `Risk:Reward: verified at ${display} — below the 1:2 Vyronis target.`
      : `Risk:Reward: verified at ${display} — thin asymmetry on this execution.`

  return {
    value,
    display,
    source,
    note: `${note} (${formatRiskReward(value)}).`,
    passesVyronisMinimum,
  }
}

export function riskRewardStrategyAdjustment(rr: ResolvedTradeRiskReward): number {
  if (rr.value == null) return 0
  if (rr.value >= 2) return 12
  if (rr.value >= 1.5) return 5
  return -6
}
