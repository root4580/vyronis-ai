"use client"

import { useEffect, useMemo, useState } from "react"
import { PlanContextCard } from "@/components/command-center/plan-context-card"
import { SessionRulesStrip } from "@/components/command-center/session-rules-strip"
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
    handleCoachSessionLoaded,
    handleCoachCompleted,
    logPlannedTrade,
    coachPreloadedSession,
    returnToCompanion,
  } = useAIContext()

  const isTradingViewAlert = coachPlannedContext?.signal_source === "tradingview"
  const [coachPhase, setCoachPhase] = useState<CoachWorkflowPhase>(() =>
    isTradingViewAlert ? "questions" : "upload",
  )
  const [watchlistPairs, setWatchlistPairs] = useState<string[]>([])
  const active = mode === "pre_trade"
  const showSessionRules = true

  useEffect(() => {
    if (isTradingViewAlert && coachPhase === "upload") {
      setCoachPhase("questions")
    }
  }, [isTradingViewAlert, coachPhase])

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
      <PlanContextCard context={coachPlannedContext} />
      <TradeCoachPanel
        active={active}
        embedded
        showHeader={false}
        plannedContext={coachPlannedContext}
        maxRiskPerTrade={maxRiskPerTrade}
        sessionId={coachSessionId}
        preloadedSession={coachPreloadedSession}
        onSessionChange={handleCoachSessionChange}
        onSessionLoaded={handleCoachSessionLoaded}
        onCompleted={handleCoachCompleted}
        onLogPlannedTrade={logPlannedTrade}
        onWorkflowPhaseChange={setCoachPhase}
        onClose={() => void returnToCompanion()}
      />
    </div>
  )
}
