"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ChevronDown, ChevronUp, Swords } from "lucide-react"
import { MarketBiasPanel } from "@/components/strategy-brain/market-bias-panel"
import { SundayPlanningPanel } from "@/components/strategy-brain/sunday-planning-panel"
import { WarRoomPairCard } from "@/components/journal/war-room-pair-card"
import { WeeklyWatchlistStrip } from "@/components/journal/weekly-watchlist-strip"
import { WarRoomWorkflowStatus } from "@/components/journal/war-room-workflow-status"
import { getDashboardHomeHref, getDashboardTabHref } from "@/lib/dashboard-nav"
import { SectionLabel, StrategyBrainGlass } from "@/components/strategy-brain/strategy-brain-primitives"
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

export function WeeklyWarRoom() {
  const { toast } = useToast()
  const weekStart = getWeekStartSunday()
  const [marketBias, setMarketBias] = useState<MarketBiasRecord | null>(null)
  const [weekPlan, setWeekPlan] = useState<WeeklyPlanWithPairs | null>(null)
  const [sessionFocus, setSessionFocus] = useState("")
  const [expectedScenarios, setExpectedScenarios] = useState("")
  const [savingMeta, setSavingMeta] = useState(false)
  const [showWatchlistEditor, setShowWatchlistEditor] = useState(false)
  const watchlistComplete = isWatchlistComplete(weekPlan)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    setSetupError(null)
    try {
      let bias: MarketBiasRecord | null = null
      try {
        bias = await fetchMarketBias()
        setMarketBias(bias)
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
      setWeekPlan(updated)
      toast({ title: "Session plan saved" })
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

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-12">
      <Link
        href={getDashboardTabHref("journal")}
        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-cyan-glow"
      >
        <ArrowLeft className="size-3" />
        Journal
      </Link>

      <header className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-lg border border-warning/30 bg-warning/10">
            <Swords className="size-5 text-warning-muted" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Weekly War Room</h1>
            <p className="text-[12px] text-muted-foreground/75">
              {formatWeekLabel(weekStart)} — weekly plan (you trade; AI coaches)
            </p>
          </div>
        </div>
      </header>

      {setupError ? (
        <StrategyBrainSetupBanner onRetry={() => void refresh()} />
      ) : null}

      {loading && !setupError ? (
        <p className="text-center text-[12px] text-muted-foreground animate-pulse">Loading War Room…</p>
      ) : null}

      {!setupError ? (
        <>
      <WarRoomWorkflowStatus readiness={readiness} />

      <WeeklyWatchlistStrip weekPlan={weekPlan} showCoachLinks={watchlistComplete} />

      {!watchlistComplete ? (
        <p className="text-[11px] text-muted-foreground/70">
          Select <span className="text-foreground/85">up to 5 charts at once</span> per pair (W → M15 order), then{" "}
          <span className="text-foreground/85">Analyze &amp; autofill</span> for pair, AOI, thesis, and HTF bias.
        </p>
      ) : null}

      {!watchlistComplete ? (
        <SundayPlanningPanel
          initial={weekPlan}
          weekStart={weekStart}
          onSaved={(p) => {
            setWeekPlan(p)
            void refresh()
          }}
        />
      ) : null}

      <MarketBiasPanel initial={marketBias} onSaved={(b) => setMarketBias(b)} />

      {marketBias ? (
        <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
          {(["weekly_bias", "daily_bias", "h4_bias"] as const).map((key) => (
            <div
              key={key}
              className="rounded-lg border border-white/[0.08] bg-black/25 px-2 py-2"
            >
              <p className="text-[9px] uppercase text-muted-foreground/55">
                {key.replace("_bias", "").replace("weekly", "W").replace("daily", "D").replace("h4", "H4")}
              </p>
              <p className="mt-0.5 font-medium">{marketBias[key]}</p>
            </div>
          ))}
        </div>
      ) : null}

      <StrategyBrainGlass>
        <SectionLabel>Session expectations</SectionLabel>
        <p className="mb-2 text-[11px] text-muted-foreground/70">
          When you trade, which session, and what macro scenarios you expect — not entry automation.
        </p>
        <Textarea
          className="min-h-[52px] border-white/[0.08] bg-black/30 text-[12px]"
          placeholder="Session focus — e.g. London only, max 2 trades, no impulse after red news"
          value={sessionFocus}
          onChange={(e) => setSessionFocus(e.target.value)}
        />
        <Textarea
          className="mt-2 min-h-[72px] border-white/[0.08] bg-black/30 text-[12px]"
          placeholder="Expected scenarios — e.g. USD weakness if DXY loses weekly support; avoid CHF until CPI"
          value={expectedScenarios}
          onChange={(e) => setExpectedScenarios(e.target.value)}
        />
        <Button
          type="button"
          size="sm"
          className="mt-2 h-9 w-full sm:w-auto"
          disabled={savingMeta || !weekPlan}
          onClick={() => void saveWarRoomMeta()}
        >
          {savingMeta ? "Saving…" : "Save session plan"}
        </Button>
      </StrategyBrainGlass>

      {pairs.length > 0 ? (
        <div className="space-y-3">
          <SectionLabel>Pair operations — AOI &amp; thesis</SectionLabel>
          <div className="grid gap-3 md:grid-cols-2">
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
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-white/[0.1] px-3 py-6 text-center text-[12px] text-muted-foreground/70">
          Save at least one pair in the watchlist below to activate pair cards.
        </p>
      )}

      <div className="rounded-xl border border-white/[0.08] bg-black/20">
        <button
          type="button"
          onClick={() => setShowWatchlistEditor((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-2.5 text-left text-[12px] font-medium"
        >
          {watchlistComplete ? "Edit weekly watchlist" : "Add or edit watchlist (1–5 pairs)"}
          {showWatchlistEditor ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </button>
        {showWatchlistEditor ? (
          <div className="border-t border-white/[0.06] p-2">
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
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3 border-t border-white/[0.06] pt-4 text-[11px]">
        <Link href="/strategy-brain" className="font-medium text-cyan-glow hover:underline">
          Setup evaluator →
        </Link>
        <Link href={getDashboardTabHref("dashboard")} className="text-muted-foreground hover:text-foreground">
          Command Center
        </Link>
        <Link href={getDashboardTabHref("journal")} className="text-muted-foreground hover:text-foreground">
          Journal
        </Link>
      </div>
        </>
      ) : null}
    </div>
  )
}
