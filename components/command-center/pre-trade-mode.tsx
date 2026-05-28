"use client"

import { TradeCoachPanel } from "@/components/dashboard/trade-coach-modal"
import { useAIContext } from "@/providers/ai-context-provider"

export function PreTradeMode() {
  const {
    mode,
    coachSessionId,
    coachPlannedContext,
    maxRiskPerTrade,
    handleCoachSessionChange,
    handleCoachCompleted,
    returnToCompanion,
  } = useAIContext()

  const active = mode === "pre_trade"

  return (
    <TradeCoachPanel
      active={active}
      embedded
      showHeader={false}
      plannedContext={coachPlannedContext}
      maxRiskPerTrade={maxRiskPerTrade}
      sessionId={coachSessionId}
      onSessionChange={handleCoachSessionChange}
      onCompleted={handleCoachCompleted}
      onClose={() => void returnToCompanion()}
    />
  )
}
