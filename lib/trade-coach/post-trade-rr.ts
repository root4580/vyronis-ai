import { calculateRiskReward, formatRiskReward } from "@/lib/trade-form-utils"

export type ResolvedTradeRiskReward = {
  value: number | null
  display: string
  source: "risk_reward" | "rr" | "calculated" | "planned_chart" | "not_provided"
  note: string
  passesVyronisMinimum: boolean
}

function parsePlannedRr(raw?: string | null): number | null {
  const value = raw?.trim() ?? ""
  if (!value) return null

  const ratioMatch = value.match(/(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/)
  if (ratioMatch) {
    const left = Number(ratioMatch[1])
    const right = Number(ratioMatch[2])
    if (left > 0 && right > 0) return right / left
  }

  const numeric = Number(value.replace(/[^\d.]/g, ""))
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null
}

type RrTrade = {
  direction: string
  risk_reward?: number | null
  rr?: number | null
  entry_price?: number | null
  stop_loss?: number | null
  take_profit?: number | null
}

export function resolveTradeRiskReward(
  trade: RrTrade,
  options?: { plannedRr?: string | null },
): ResolvedTradeRiskReward {
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

  const fromPlannedChart = parsePlannedRr(options?.plannedRr)

  const value = fromRiskReward ?? fromRr ?? calculated ?? fromPlannedChart
  if (value == null) {
    return {
      value: null,
      display: "Not verified",
      source: "not_provided",
      note: "Risk:Reward: Not verified from journal data.",
      passesVyronisMinimum: false,
    }
  }

  const source = fromRiskReward
    ? "risk_reward"
    : fromRr
      ? "rr"
      : calculated != null
        ? "calculated"
        : "planned_chart"
  const display = `${value.toFixed(2)}R`
  const passesVyronisMinimum = value >= 2
  const sourceLabel =
    source === "planned_chart"
      ? "verified from pre-trade plan/chart"
      : source === "calculated"
        ? "calculated from entry, stop, and target"
        : "verified from journal"
  const note = passesVyronisMinimum
    ? `Risk:Reward: ${sourceLabel} at ${display} — passes the 1:2 Vyronis rule.`
    : value >= 1.5
      ? `Risk:Reward: ${sourceLabel} at ${display} — below the 1:2 Vyronis target.`
      : `Risk:Reward: ${sourceLabel} at ${display} — thin asymmetry on this execution.`

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
