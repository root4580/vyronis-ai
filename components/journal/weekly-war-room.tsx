"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, Bot, ChevronDown, ChevronUp, History } from "lucide-react"
import { MarketBiasPanel } from "@/components/strategy-brain/market-bias-panel"
import { SundayPlanningPanel } from "@/components/strategy-brain/sunday-planning-panel"
import { WarRoomPairCard } from "@/components/journal/war-room-pair-card"
import { WarRoomChapterRecapPanel } from "@/components/journal/war-room-chapter-recap-panel"
import { WarRoomWorkflowStatus } from "@/components/journal/war-room-workflow-status"
import { getDashboardTabHref, getWarRoomCoachHref } from "@/lib/dashboard-nav"
import { buildEmptyPlannedContext } from "@/lib/trade-coach/planned-context"
import { openWarRoomCoachForPlan } from "@/lib/paper-trades/war-room-coach-flow"
import { useOptionalAIContext } from "@/providers/ai-context-provider"
import { useRouter } from "next/navigation"
import { WarRoomSurfaceCard } from "@/components/strategy-brain/strategy-brain-primitives"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { StrategyBrainSetupBanner } from "@/components/journal/strategy-brain-setup-banner"
import { computeWarRoomReadiness } from "@/lib/journal/war-room-status"
import {
  fetchMarketBias,
  fetchStrategyBrainDashboard,
  fetchWeeklyPlan,
  saveMarketBias,
  saveWeeklyPlan,
} from "@/lib/strategy-brain/api-client"
import type { MarketBiasInput } from "@/lib/strategy-brain/types"
import {
  formatStrategyBrainSetupError,
  isStrategyBrainSetupError,
} from "@/lib/strategy-brain/migration-hint"
import type { MarketBiasRecord, WeeklyPlanWithPairs } from "@/lib/strategy-brain/types"
import { getWeekStartSunday, formatWeekLabel } from "@/lib/strategy-brain/week-utils"
import { isWatchlistComplete } from "@/lib/strategy-brain/weekly-watchlist"
import { CouncilNewsRiskBar } from "@/components/economic-calendar/council-news-risk-bar"
import { CouncilSection } from "@/components/journal/council-section"
import { useEconomicCalendar } from "@/hooks/use-economic-calendar"

export function WeeklyWarRoom({
  onCoachEngaged,
  accountId = null,
}: {
  onCoachEngaged?: () => void
  accountId?: string | null
} = {}) {
  const { toast } = useToast()
  const router = useRouter()
  const aiContext = useOptionalAIContext()
  const weekStart = getWeekStartSunday()
  const [marketBias, setMarketBias] = useState<MarketBiasRecord | null>(null)
  const [biasDraft, setBiasDraft] = useState<MarketBiasInput>({
    weekly_bias: "Neutral",
    daily_bias: "Neutral",
    h4_bias: "Neutral",
  })
  const [weekPlan, setWeekPlan] = useState<WeeklyPlanWithPairs | null>(null)
  const [sessionFocus, setSessionFocus] = useState("")
  const [expectedScenarios, setExpectedScenarios] = useState("")
  const [savingMeta, setSavingMeta] = useState(false)
  const [showWatchlistEditor, setShowWatchlistEditor] = useState(false)
  const watchlistComplete = isWatchlistComplete(weekPlan)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const { calendar, loading: calendarLoading } = useEconomicCalendar()

  const refresh = useCallback(async () => {
    setLoading(true)
    setSetupError(null)
    try {
      let bias: MarketBiasRecord | null = null
      try {
        bias = await fetchMarketBias()
        setMarketBias(bias)
        setBiasDraft({
          weekly_bias: bias?.weekly_bias ?? "Neutral",
          daily_bias: bias?.daily_bias ?? "Neutral",
          h4_bias: bias?.h4_bias ?? "Neutral",
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load bias"
        if (isStrategyBrainSetupError(msg)) {
          setSetupError(formatStrategyBrainSetupError(msg))
          setMarketBias(null)
          setWeekPlan(null)
          return
        }
        throw e
      }

      let plan: WeeklyPlanWithPairs | null = null
      try {
        plan = await fetchWeeklyPlan(weekStart)
      } catch {
        try {
          const dash = await fetchStrategyBrainDashboard()
          plan = dash.currentWeekPlan
        } catch (dashErr) {
          const msg = dashErr instanceof Error ? dashErr.message : ""
          if (isStrategyBrainSetupError(msg)) {
            setSetupError(formatStrategyBrainSetupError(msg))
            return
          }
        }
      }

      setWeekPlan(plan)
      setSessionFocus(plan?.session_focus ?? "")
      setExpectedScenarios(plan?.expected_scenarios ?? "")
    } catch (e) {
      const msg = e instanceof Error ? e.message : "War Room unavailable"
      if (isStrategyBrainSetupError(msg)) {
        setSetupError(formatStrategyBrainSetupError(msg))
      } else {
        toast({
          title: "War Room unavailable",
          description: msg,
          variant: "destructive",
        })
      }
    } finally {
      setLoading(false)
    }
  }, [weekStart, toast])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const readiness = useMemo(
    () =>
      computeWarRoomReadiness({
        weekPlan,
        marketBias,
        sessionFocus,
        expectedScenarios,
      }),
    [weekPlan, marketBias, sessionFocus, expectedScenarios],
  )

  async function saveWarRoomMeta() {
    if (!weekPlan) return
    setSavingMeta(true)
    try {
      const updated = await saveWeeklyPlan({
        week_start: weekStart,
        session_notes: weekPlan.session_notes,
        session_focus: sessionFocus,
        expected_scenarios: expectedScenarios,
        pairs: weekPlan.pairs.map((p) => ({
          pair: p.pair,
          directional_bias: p.directional_bias,
          aoi_high: p.aoi_high,
          aoi_low: p.aoi_low,
          invalidation: p.invalidation,
          weekly_thesis: p.weekly_thesis,
          notes: p.notes,
          aoi_status: p.aoi_status,
          screenshot_urls: p.screenshot_urls ?? [],
        })),
      })
      const bias = await saveMarketBias(biasDraft)
      setMarketBias(bias)
      setWeekPlan(updated)
      toast({ title: "Session plan & bias saved" })
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      })
    } finally {
      setSavingMeta(false)
    }
  }

  const pairs = weekPlan?.pairs ?? []

  function handleAskCoach() {
    if (pairs.length === 0) {
      toast({
        title: "Add a pair to your watchlist first",
        description: "Coach needs at least one weekly pair from War Room before chart check-in.",
        variant: "destructive",
      })
      document.getElementById("war-room-planning")?.scrollIntoView({ behavior: "smooth", block: "start" })
      return
    }

    if (aiContext?.openPreTradeCoach && pairs.length === 1) {
      void openWarRoomCoachForPlan(aiContext.openPreTradeCoach, pairs[0]!)
        .then(() => onCoachEngaged?.())
        .catch((error) => {
          toast({
            title: "Could not open Coach",
            description: error instanceof Error ? error.message : undefined,
            variant: "destructive",
          })
        })
      return
    }

    if (aiContext?.openPreTradeCoach && pairs.length > 1) {
      void aiContext
        .openPreTradeCoach({
          plannedContext: buildEmptyPlannedContext(),
          plannerCheckIn: true,
        })
        .then(() => onCoachEngaged?.())
        .catch((error) => {
          toast({
            title: "Could not open Coach",
            description: error instanceof Error ? error.message : undefined,
            variant: "destructive",
          })
        })
      return
    }

    router.push(getWarRoomCoachHref(pairs.map((pair) => pair.pair)))
  }

  return (
    <div className="war-room-content space-y-5 pb-12">
      <CouncilNewsRiskBar calendar={calendar} loading={calendarLoading} />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium text-text-primary">Council</h1>
          <p className="mt-0.5 text-[12px] text-text-muted">
            {formatWeekLabel(weekStart)} · news, mission, and weekly plan
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="h-9 text-text-muted hover:text-text-primary"
          asChild
        >
          <Link href="/strategy-brain">
            <History className="mr-2 size-4" />
            Past weeks
          </Link>
        </Button>
      </header>

      {setupError ? <StrategyBrainSetupBanner onRetry={() => void refresh()} /> : null}

      {loading && !setupError ? (
        <p className="text-center text-[12px] text-text-muted animate-pulse">Loading Council…</p>
      ) : null}

      {!setupError ? (
        <>
          {pairs.length === 0 && !loading ? (
            <div className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3.5 py-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--warning-foreground)]" />
              <p className="text-[12px] leading-relaxed text-[var(--warning-muted)]">
                Add at least one pair to your weekly watchlist before the session. Upload charts and
                run Analyze &amp; autofill to seed AOI and HTF bias.
              </p>
            </div>
          ) : null}

          <CouncilSection
            title="Daily Mission"
            id="council-daily-mission"
            description="Readiness checklist and session expectations for today."
          >
            <WarRoomWorkflowStatus readiness={readiness} />
            <WarRoomSurfaceCard className="p-4">
              <p className="text-[11px] font-medium text-text-muted">Session expectations</p>
              <p className="mb-3 mt-1 text-[11px] text-text-muted">
                When you trade, which session, and what macro scenarios you expect.
              </p>
              <Textarea
                className="war-room-textarea min-h-[52px]"
                placeholder="Session focus — e.g. London only, max 2 trades, no impulse after red news"
                value={sessionFocus}
                onChange={(e) => setSessionFocus(e.target.value)}
              />
              <Textarea
                className="war-room-textarea mt-2 min-h-[72px]"
                placeholder="Expected scenarios — e.g. USD weakness if DXY loses weekly support"
                value={expectedScenarios}
                onChange={(e) => setExpectedScenarios(e.target.value)}
              />
            </WarRoomSurfaceCard>
          </CouncilSection>

          <CouncilSection
            title="HTF Bias"
            id="council-htf-bias"
            description="Weekly, daily, and H4 directional read."
          >
            <MarketBiasPanel initial={marketBias} onDraftChange={setBiasDraft} />
            <Button
              type="button"
              className="btn-primary h-11 w-full rounded-[var(--radius-md)]"
              disabled={savingMeta || !weekPlan}
              onClick={() => void saveWarRoomMeta()}
            >
              {savingMeta ? "Saving…" : "Save session plan & bias"}
            </Button>
          </CouncilSection>

          <CouncilSection
            title="Watchlist"
            id="council-watchlist"
            description="Weekly pairs you are allowed to trade."
          >
            {!watchlistComplete ? (
              <div id="war-room-planning">
                <SundayPlanningPanel
                  initial={weekPlan}
                  weekStart={weekStart}
                  onSaved={(p) => {
                    setWeekPlan(p)
                    void refresh()
                  }}
                  onBiasSuggest={(bias: MarketBiasInput) => {
                    void saveMarketBias(bias)
                      .then((b) => {
                        setMarketBias(b)
                        toast({ title: "HTF bias updated from chart read" })
                      })
                      .catch(() => {})
                  }}
                />
              </div>
            ) : (
              <WarRoomSurfaceCard>
                <button
                  type="button"
                  onClick={() => setShowWatchlistEditor((v) => !v)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-[12px] font-medium text-text-primary"
                >
                  {pairs.length} pair{pairs.length === 1 ? "" : "s"} on this week&apos;s list
                  {showWatchlistEditor ? (
                    <ChevronUp className="size-4 text-text-muted" />
                  ) : (
                    <ChevronDown className="size-4 text-text-muted" />
                  )}
                </button>
                {showWatchlistEditor ? (
                  <div className="border-t border-[var(--border-subtle)] p-3">
                    <SundayPlanningPanel
                      initial={weekPlan}
                      weekStart={weekStart}
                      onBiasSuggest={(bias: MarketBiasInput) => {
                        void saveMarketBias(bias)
                          .then((b) => {
                            setMarketBias(b)
                            toast({ title: "HTF bias updated from chart read" })
                          })
                          .catch(() => {})
                      }}
                      onSaved={(p) => {
                        setWeekPlan(p)
                        setShowWatchlistEditor(false)
                        void refresh()
                      }}
                    />
                  </div>
                ) : (
                  <div className="border-t border-[var(--border-subtle)] px-4 py-3">
                    <p className="font-mono text-[12px] leading-relaxed text-text-primary">
                      {pairs.map((pair) => pair.pair).join(" · ")}
                    </p>
                  </div>
                )}
              </WarRoomSurfaceCard>
            )}
          </CouncilSection>

          <CouncilSection
            title="AOI Zones"
            id="council-aoi"
            description="Area of interest, invalidation, and chart uploads per pair."
          >
            {pairs.length > 0 ? (
              <div id="war-room-pairs" className="war-room-surface-card divide-y divide-[var(--border-subtle)]">
                {pairs.map((p) =>
                  weekPlan ? (
                    <WarRoomPairCard
                      key={p.id}
                      plan={p}
                      weekPlan={weekPlan}
                      weekStart={weekStart}
                      sessionFocus={sessionFocus}
                      expectedScenarios={expectedScenarios}
                      onUpdated={setWeekPlan}
                      onCoachEngaged={onCoachEngaged}
                      onBiasSuggest={(bias: MarketBiasInput) => {
                        void saveMarketBias(bias)
                          .then((b) => {
                            setMarketBias(b)
                            toast({ title: "HTF bias updated from chart read" })
                          })
                          .catch(() => {})
                      }}
                    />
                  ) : null,
                )}
              </div>
            ) : (
              <WarRoomSurfaceCard className="p-4">
                <p className="text-[12px] text-text-muted">
                  Add pairs in Watchlist to define AOI zones and upload charts.
                </p>
              </WarRoomSurfaceCard>
            )}
          </CouncilSection>

          <CouncilSection
            title="Coach"
            id="council-coach"
            description="Pre-trade chart read and entry gate before you size live."
          >
            <WarRoomSurfaceCard className="p-4">
              <p className="text-[12px] leading-relaxed text-text-primary">
                Run the AI Trade Coach on your weekly watchlist — MTF upload, entry gate, and a single
                TAKE / WAIT / SKIP verdict.
              </p>
              <Button type="button" className="btn-primary mt-3 h-11 w-full" onClick={handleAskCoach}>
                <Bot className="mr-2 size-4" />
                Open Trade Coach
              </Button>
            </WarRoomSurfaceCard>
          </CouncilSection>

          <CouncilSection
            title="Reviews"
            id="council-reviews"
            description="Chapter recap and weekly performance review."
          >
            <WarRoomChapterRecapPanel accountId={accountId} warRoomWeekStart={weekStart} />
          </CouncilSection>

          <div className="flex flex-wrap gap-3 border-t border-[var(--border-subtle)] pt-4 text-[11px]">
            <Link href="/strategy-brain" className="font-medium text-text-accent hover:underline">
              Setup evaluator →
            </Link>
            <Link href={getDashboardTabHref("dashboard")} className="text-text-muted hover:text-text-primary">
              Command Center
            </Link>
            <Link href={getDashboardTabHref("journal")} className="text-text-muted hover:text-text-primary">
              Journal
            </Link>
          </div>
        </>
      ) : null}
    </div>
  )
}
