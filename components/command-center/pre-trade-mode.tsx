"use client"

import { useEffect, useMemo, useState } from "react"
import { CognitiveSurface } from "@/components/command-center/cognitive-surface"
import { SessionRulesStrip } from "@/components/command-center/session-rules-strip"
import { PreTradeApprovalStrip } from "@/components/vyronis-core/pre-trade-approval-strip"
import { TradingOsAlertStrip } from "@/components/trading-os/trading-os-alert-strip"
import { TradeCoachPanel } from "@/components/dashboard/trade-coach-modal"
import { useAIContext } from "@/providers/ai-context-provider"
import { fetchWeeklyPlan } from "@/lib/strategy-brain/api-client"
import { buildSessionRulesSummary } from "@/lib/session-rules-summary"
import { DEFAULT_USER_SETTINGS } from "@/lib/user-settings"
import type { CoachWorkflowPhase } from "@/lib/trade-coach/pre-trade-flow"

export function PreTradeMode() {
  const {
    context,
    mode,
    coachSessionId,
    coachPlannedContext,
    maxRiskPerTrade,
    handleCoachSessionChange,
    handleCoachCompleted,
    logPlannedTrade,
    returnToCompanion,
  } = useAIContext()

  const [coachPhase, setCoachPhase] = useState<CoachWorkflowPhase>("upload")
  const [watchlistPairs, setWatchlistPairs] = useState<string[]>([])
  const active = mode === "pre_trade"
  const showIntelStrips = coachPhase !== "upload" && coachPhase !== "questions"
  const showSessionRules = coachPhase !== "upload"

  useEffect(() => {
    void fetchWeeklyPlan()
      .then((plan) => setWatchlistPairs((plan?.pairs ?? []).map((row) => row.pair).filter(Boolean)))
      .catch(() => setWatchlistPairs([]))
  }, [])

  const sessionRulesSummary = useMemo(
    () =>
      buildSessionRulesSummary({
        watchlistPairs,
        maxRiskPerTrade,
        maxTradesPerDay: DEFAULT_USER_SETTINGS.max_trades_per_day,
        tradingOs: context?.tradingOs,
      }),
    [watchlistPairs, maxRiskPerTrade, context?.tradingOs],
  )

  return (
    <div className="command-center-pre-trade flex min-h-0 flex-1 flex-col gap-1.5 sm:gap-2">
      {showSessionRules ? <SessionRulesStrip summary={sessionRulesSummary} /> : null}
      {showIntelStrips ? (
        <>
          <TradingOsAlertStrip tradingOs={context?.tradingOs} />
          <PreTradeApprovalStrip vyronisCore={context?.vyronisCore} />
          <CognitiveSurface cognitive={context?.cognitive} />
        </>
      ) : null}
      <div className="mobile-safe-scroll min-h-0 flex-1 overflow-y-auto">
        <TradeCoachPanel
          active={active}
          embedded
          showHeader={false}
          plannedContext={coachPlannedContext}
          maxRiskPerTrade={maxRiskPerTrade}
          sessionId={coachSessionId}
          onSessionChange={handleCoachSessionChange}
          onCompleted={handleCoachCompleted}
          onLogPlannedTrade={logPlannedTrade}
          onWorkflowPhaseChange={setCoachPhase}
          onClose={() => void returnToCompanion()}
        />
      </div>
    </div>
  )
}
