"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Brain, ArrowLeft, Layers } from "lucide-react"
import { fetchStrategyBrainDashboard } from "@/lib/strategy-brain/api-client"
import type {
  MarketBiasRecord,
  StrategyBrainDashboard,
  WeeklyPlanWithPairs,
} from "@/lib/strategy-brain/types"
import { VYRONIS_STRATEGY_NAME } from "@/lib/strategy/vyronis-strategy-playbook"
import { MarketBiasPanel } from "@/components/strategy-brain/market-bias-panel"
import { SundayPlanningPanel } from "@/components/strategy-brain/sunday-planning-panel"
import { AoiPairCard } from "@/components/strategy-brain/aoi-pair-card"
import { SetupEvaluatorPanel } from "@/components/strategy-brain/setup-evaluator-panel"
import { PostTradeReviewPanel } from "@/components/strategy-brain/post-trade-review-panel"
import { SectionLabel, StrategyBrainGlass } from "@/components/strategy-brain/strategy-brain-primitives"
import { createClient } from "@/lib/supabase/client"

type TradeOption = { id: string; pair: string; result: string }

export function StrategyBrainPageClient() {
  const [dashboard, setDashboard] = useState<StrategyBrainDashboard | null>(null)
  const [weekPlan, setWeekPlan] = useState<WeeklyPlanWithPairs | null>(null)
  const [marketBias, setMarketBias] = useState<MarketBiasRecord | null>(null)
  const [trades, setTrades] = useState<TradeOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<"plan" | "aoi" | "evaluate" | "review">("plan")

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchStrategyBrainDashboard()
      setDashboard(data)
      setMarketBias(data.marketBias)
      setWeekPlan(data.currentWeekPlan)

      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const { data: tradeRows } = await supabase
          .from("trades")
          .select("id, pair, result")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20)
        setTrades((tradeRows || []) as TradeOption[])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Strategy Brain")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const pairs = weekPlan?.pairs ?? []

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href="/"
            className="mb-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-cyan-glow"
          >
            <ArrowLeft className="size-3" />
            Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg border border-cyan-glow/25 bg-cyan-glow/10">
              <Brain className="size-5 text-cyan-glow" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-foreground">
                Strategy Brain
              </h1>
              <p className="text-[11px] text-muted-foreground/75">
                {VYRONIS_STRATEGY_NAME} · decision engine (no automation)
              </p>
            </div>
          </div>
        </div>
        <Link
          href="/strategy"
          className="shrink-0 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[10px] text-muted-foreground hover:text-foreground"
        >
          Playbook rules
        </Link>
      </div>

      {error ? (
        <StrategyBrainGlass className="border-amber-500/30">
          <p className="text-[12px] text-amber-200">{error}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Run <code className="text-foreground/80">supabase/026-strategy-brain-foundation.sql</code>{" "}
            in Supabase SQL Editor, then refresh.
          </p>
        </StrategyBrainGlass>
      ) : null}

      {loading && !dashboard ? (
        <p className="text-center text-[12px] text-muted-foreground animate-pulse">
          Loading strategy intelligence…
        </p>
      ) : null}

      <MarketBiasPanel
        initial={marketBias}
        onSaved={(b) => {
          setMarketBias(b)
          void refresh()
        }}
      />

      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
        {(
          [
            ["plan", "Sunday plan"],
            ["aoi", "AOI board"],
            ["evaluate", "Evaluate"],
            ["review", "Review"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={
              tab === id
                ? "shrink-0 rounded-lg border border-cyan-glow/35 bg-cyan-glow/10 px-3 py-1.5 text-[11px] font-medium text-cyan-glow"
                : "shrink-0 rounded-lg border border-white/[0.06] px-3 py-1.5 text-[11px] text-muted-foreground"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "plan" ? (
        <SundayPlanningPanel
          initial={weekPlan}
          weekStart={dashboard?.weekStart ?? weekPlan?.week_start ?? ""}
          onSaved={(p) => {
            setWeekPlan(p)
            void refresh()
          }}
        />
      ) : null}

      {tab === "aoi" ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-cyan-glow/80" />
            <SectionLabel>AOI watchlist</SectionLabel>
          </div>
          {pairs.length === 0 ? (
            <StrategyBrainGlass>
              <p className="text-[11px] text-muted-foreground/75">
                Save your Sunday plan with pairs and zones — AOI cards appear here.
              </p>
            </StrategyBrainGlass>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {pairs.map((p) => (
                <AoiPairCard
                  key={p.id}
                  plan={p}
                  onStatusChange={() => void refresh()}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}

      {tab === "evaluate" ? <SetupEvaluatorPanel pairPlans={pairs} /> : null}

      {tab === "review" ? <PostTradeReviewPanel trades={trades} /> : null}

      {dashboard?.recentEvaluations && dashboard.recentEvaluations.length > 0 ? (
        <StrategyBrainGlass>
          <SectionLabel>Recent evaluations</SectionLabel>
          <ul className="mt-2 space-y-1.5">
            {dashboard.recentEvaluations.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between text-[11px] text-foreground/80"
              >
                <span>
                  {e.pair} · {e.grade}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {e.total_score} · {e.recommendation}
                </span>
              </li>
            ))}
          </ul>
        </StrategyBrainGlass>
      ) : null}
    </div>
  )
}
