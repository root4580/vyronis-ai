"use client"

import { CognitiveSurface } from "@/components/command-center/cognitive-surface"
import { TradingOsAlertStrip } from "@/components/trading-os/trading-os-alert-strip"
import { TradeCoachPanel } from "@/components/dashboard/trade-coach-modal"
import { useAIContext } from "@/providers/ai-context-provider"

export function PreTradeMode() {
  const {
    context,
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
    <div className="command-center-pre-trade flex min-h-0 flex-1 flex-col gap-1.5 sm:gap-2">
      <TradingOsAlertStrip tradingOs={context?.tradingOs} />
      <CognitiveSurface cognitive={context?.cognitive} />
      <div className="mobile-safe-scroll min-h-0 flex-1 overflow-hidden">
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
      </div>
    </div>
  )
}
