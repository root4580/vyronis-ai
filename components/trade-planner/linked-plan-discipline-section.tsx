"use client"

import { useEffect, useMemo, useState } from "react"
import { PlanDeviationFull } from "@/components/trade-planner/plan-deviation-full"
import {
  buildTradeActualForDeviation,
  computePlanDiscipline,
} from "@/lib/trade-planner/deviation-engine"
import type { MatchableTradePlan } from "@/lib/trade-planner/plan-match"
import { getTradeRiskReward } from "@/lib/trade-form-utils"

type LinkedPlanTrade = {
  id: string
  pair: string
  direction: string
  plan_id?: string | null
  entry_price?: number | null
  stop_loss?: number | null
  take_profit?: number | null
  risk_percent?: number | null
  risk_reward?: number | null
}

type LinkedPlanDisciplineSectionProps = {
  trade: LinkedPlanTrade
  className?: string
}

export function LinkedPlanDisciplineSection({ trade, className }: LinkedPlanDisciplineSectionProps) {
  const [linkedPlan, setLinkedPlan] = useState<MatchableTradePlan | null>(null)

  useEffect(() => {
    if (!trade.plan_id) {
      setLinkedPlan(null)
      return
    }

    let cancelled = false

    async function loadLinkedPlan() {
      try {
        const response = await fetch(`/api/trade-plans/${trade.plan_id}`)
        if (!response.ok || cancelled) return
        const payload = (await response.json()) as { plan?: MatchableTradePlan }
        if (!cancelled) setLinkedPlan(payload.plan ?? null)
      } catch {
        if (!cancelled) setLinkedPlan(null)
      }
    }

    void loadLinkedPlan()

    return () => {
      cancelled = true
    }
  }, [trade.plan_id])

  const planDiscipline = useMemo(() => {
    if (!linkedPlan) return null
    const riskReward = getTradeRiskReward(trade)
    return computePlanDiscipline(
      linkedPlan,
      buildTradeActualForDeviation({
        pair: trade.pair,
        direction: trade.direction,
        entryPrice: trade.entry_price ?? null,
        stopLoss: trade.stop_loss ?? null,
        takeProfit: trade.take_profit ?? null,
        lots: linkedPlan.recommendedLots,
        riskPercent: trade.risk_percent ?? null,
        riskReward: trade.risk_reward ?? riskReward,
        accountSizeForRisk: linkedPlan.accountSize,
      }),
    )
  }, [trade, linkedPlan])

  if (!trade.plan_id || !planDiscipline) return null

  return (
    <PlanDeviationFull
      pairLabel={`${trade.pair} ${trade.direction}`}
      result={planDiscipline}
      className={className}
    />
  )
}
