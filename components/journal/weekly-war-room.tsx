"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Swords, Upload } from "lucide-react"
import { MarketBiasPanel } from "@/components/strategy-brain/market-bias-panel"
import { SundayPlanningPanel } from "@/components/strategy-brain/sunday-planning-panel"
import { AoiPairCard } from "@/components/strategy-brain/aoi-pair-card"
import { SectionLabel, StrategyBrainGlass } from "@/components/strategy-brain/strategy-brain-primitives"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import {
  fetchMarketBias,
  fetchStrategyBrainDashboard,
  fetchWeeklyPlan,
  saveWeeklyPlan,
} from "@/lib/strategy-brain/api-client"
import type { MarketBiasRecord, WeeklyPlanWithPairs } from "@/lib/strategy-brain/types"
import { getWeekStartSunday, formatWeekLabel } from "@/lib/strategy-brain/week-utils"

export function WeeklyWarRoom() {
  const { toast } = useToast()
  const weekStart = getWeekStartSunday()
  const [marketBias, setMarketBias] = useState<MarketBiasRecord | null>(null)
  const [weekPlan, setWeekPlan] = useState<WeeklyPlanWithPairs | null>(null)
  const [sessionFocus, setSessionFocus] = useState("")
  const [expectedScenarios, setExpectedScenarios] = useState("")
  const [savingMeta, setSavingMeta] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [bias, plan] = await Promise.all([
        fetchMarketBias(),
        fetchWeeklyPlan(weekStart).catch(() => null),
      ])
      setMarketBias(bias)
      if (plan) {
        setWeekPlan(plan)
        setSessionFocus(plan.session_focus ?? "")
        setExpectedScenarios(plan.expected_scenarios ?? "")
      } else {
        const dash = await fetchStrategyBrainDashboard()
        setWeekPlan(dash.currentWeekPlan)
        setSessionFocus(dash.currentWeekPlan?.session_focus ?? "")
        setExpectedScenarios(dash.currentWeekPlan?.expected_scenarios ?? "")
      }
    } catch (e) {
      toast({
        title: "War Room unavailable",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      })
    }
  }, [weekStart, toast])

  useEffect(() => {
    void refresh()
  }, [refresh])

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
      toast({ title: "War Room saved" })
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
    <div className="mx-auto max-w-4xl space-y-4 pb-10">
      <Link
        href="/?tab=journal"
        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-cyan-glow"
      >
        <ArrowLeft className="size-3" />
        Journal
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10">
          <Swords className="size-5 text-amber-200" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Weekly War Room</h1>
          <p className="text-[11px] text-muted-foreground/75">
            {formatWeekLabel(weekStart)} — directional thesis before you trade
          </p>
        </div>
      </div>

      <MarketBiasPanel initial={marketBias} onSaved={(b) => setMarketBias(b)} />

      <StrategyBrainGlass>
        <SectionLabel>Session focus &amp; scenarios</SectionLabel>
        <Textarea
          className="mt-2 min-h-[56px] border-white/[0.08] bg-black/30 text-[12px]"
          placeholder="Session focus — e.g. London open only, no NY impulse trades"
          value={sessionFocus}
          onChange={(e) => setSessionFocus(e.target.value)}
        />
        <Textarea
          className="mt-2 min-h-[72px] border-white/[0.08] bg-black/30 text-[12px]"
          placeholder="Expected scenarios — e.g. USD weakness if CPI aligns with DXY breakdown"
          value={expectedScenarios}
          onChange={(e) => setExpectedScenarios(e.target.value)}
        />
        <Button
          type="button"
          size="sm"
          className="mt-2"
          disabled={savingMeta}
          onClick={() => void saveWarRoomMeta()}
        >
          Save focus &amp; scenarios
        </Button>
      </StrategyBrainGlass>

      <SundayPlanningPanel
        initial={weekPlan}
        weekStart={weekStart}
        onSaved={(p) => {
          setWeekPlan(p)
          void refresh()
        }}
      />

      {pairs.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionLabel>AOI watchlist</SectionLabel>
            <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
              <Upload className="size-3" />
              Screenshots: add URLs in pair notes or log on trade
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {pairs.map((p) => (
              <AoiPairCard key={p.id} plan={p} onStatusChange={() => void refresh()} />
            ))}
          </div>
        </div>
      ) : null}

      <p className="text-[11px] text-muted-foreground/65">
        Next:{" "}
        <Link href="/strategy-brain" className="text-cyan-glow hover:underline">
          Setup evaluator
        </Link>{" "}
        → Command Center → Log trade → Review
      </p>
    </div>
  )
}
