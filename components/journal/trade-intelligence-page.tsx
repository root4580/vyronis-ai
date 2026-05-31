"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, Camera, Pencil, Play } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { TradeCaseStudyView } from "@/components/journal/trade-case-study"
import { SetupScoreBadge } from "@/components/dashboard/setup-score-badge"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import { Button } from "@/components/ui/button"
import { resolveStoredSetupScore } from "@/lib/trade-coach/setup-score-engine"
import { formatPnL, getPnLTextClass } from "@/lib/trade-utils"
import {
  analyzeTradeIntelligence,
  fetchTradeIntelligence,
} from "@/lib/intelligence/api-client"
import { buildTradeCaseStudy } from "@/lib/journal/trade-case-study"
import { fetchMarketBias, fetchWeeklyPlan } from "@/lib/strategy-brain/api-client"
import { getWeekStartSunday } from "@/lib/strategy-brain/week-utils"
import type { TradeDetails } from "@/components/dashboard/trade-details-modal"
import type { TradeIntelligenceBundle } from "@/lib/intelligence/trade-intelligence-types"
import type { FingerprintTradeInput } from "@/lib/journal/setup-fingerprint"
import type { MarketBiasRecord, PairPlanRecord } from "@/lib/strategy-brain/types"
import { getDashboardTabHref, getTradeReplayHref } from "@/lib/dashboard-nav"
import { cn } from "@/lib/utils"
import { LinkedPlanAnalysisSection } from "@/components/trade-planner/linked-plan-analysis-section"

type TradeIntelligencePageProps = {
  tradeId: string
  onEdit?: (trade: TradeDetails) => void
}

export function TradeIntelligencePage({ tradeId, onEdit }: TradeIntelligencePageProps) {
  const router = useRouter()
  const [trade, setTrade] = useState<TradeDetails | null>(null)
  const [history, setHistory] = useState<FingerprintTradeInput[]>([])
  const [bundle, setBundle] = useState<TradeIntelligenceBundle | null>(null)
  const [pairPlan, setPairPlan] = useState<PairPlanRecord | null>(null)
  const [marketBias, setMarketBias] = useState<MarketBiasRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [screenshotOpen, setScreenshotOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: auth } = await supabase.auth.getUser()
    const userId = auth.user?.id

    const { data, error } = await supabase.from("trades").select("*").eq("id", tradeId).maybeSingle()
    if (error || !data) {
      setTrade(null)
      setLoading(false)
      return
    }
    setTrade(data as unknown as TradeDetails)

    if (userId) {
      const { data: rows } = await supabase
        .from("trades")
        .select(
          "id, pair, direction, result, pnl, emotion, setup, session, confirmation_signal, mistake_tags, rule_followed, trade_date, higher_timeframe",
        )
        .eq("user_id", userId)
        .order("trade_date", { ascending: false })
        .limit(80)
      setHistory((rows ?? []) as FingerprintTradeInput[])
    }

    try {
      const intel = await fetchTradeIntelligence(tradeId)
      setBundle(intel)
    } catch {
      setBundle(null)
    }

    try {
      const [bias, plan] = await Promise.all([
        fetchMarketBias(),
        fetchWeeklyPlan(getWeekStartSunday()),
      ])
      setMarketBias(bias)
      const normalizedPair = String(data.pair).toUpperCase().replace(/\s/g, "")
      setPairPlan(
        plan.pairs.find((p) => p.pair.toUpperCase().replace(/\s/g, "") === normalizedPair) ?? null,
      )
    } catch {
      setPairPlan(null)
      setMarketBias(null)
    }

    setLoading(false)
  }, [tradeId])

  useEffect(() => {
    void load()
  }, [load])

  const study = useMemo(() => {
    if (!trade) return null
    return buildTradeCaseStudy({
      trade,
      bundle,
      history,
      pairPlan,
      marketBias,
    })
  }, [trade, bundle, history, pairPlan, marketBias])

  async function handleSync() {
    setSyncing(true)
    try {
      const result = await analyzeTradeIntelligence(tradeId)
      setBundle(result.bundle)
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <p className="py-12 text-center text-[13px] text-muted-foreground">Loading case study…</p>
    )
  }

  if (!trade || !study) {
    return (
      <div className="space-y-3 py-8 text-center">
        <p className="text-[13px] text-loss">Trade not found</p>
        <Button type="button" variant="outline" onClick={() => router.push(getDashboardTabHref("journal"))}>
          Back to journal
        </Button>
      </div>
    )
  }

  const setup = resolveStoredSetupScore(trade)

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={getDashboardTabHref("journal")}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-cyan-glow"
        >
          <ArrowLeft className="size-3" />
          Journal
        </Link>
        <div className="flex gap-2">
          <Link
            href="/war-room"
            className="text-[11px] text-muted-foreground hover:text-cyan-glow"
          >
            War Room
          </Link>
          {onEdit ? (
            <Button type="button" variant="outline" size="sm" onClick={() => onEdit(trade)}>
              <Pencil className="mr-1.5 size-3.5" />
              Edit
            </Button>
          ) : null}
        </div>
      </div>

      <DashboardInsetPanel className="px-4 py-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-cyan-glow/80">
          Trade case study
        </p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">
              {trade.pair} · {trade.direction}
            </h1>
            <p className="mt-1 text-[12px] text-muted-foreground/75">
              {trade.trade_date ?? trade.created_at?.split("T")[0]} · {trade.session ?? "—"} ·{" "}
              {trade.strategy_name ?? "No strategy"}
            </p>
          </div>
          <div className="text-right">
            <p
              className={cn(
                "text-lg font-bold tabular-nums",
                getPnLTextClass(trade.pnl, trade.result),
              )}
            >
              {formatPnL(trade.pnl, trade.result)}
            </p>
            <p className="text-[11px] text-muted-foreground/70">{trade.result}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <SetupScoreBadge score={setup.score} classification={setup.classification} />
          <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px]">
            Emotion: {trade.emotion}
          </span>
        </div>
        <Button
          type="button"
          size="sm"
          className="mt-4 bg-cyan-glow/90 text-black hover:bg-cyan-glow"
          onClick={() => router.push(getTradeReplayHref(tradeId))}
        >
          <Play className="mr-1.5 size-3.5" />
          Open Cinematic Replay
          <ArrowRight className="ml-1.5 size-3.5" />
        </Button>
      </DashboardInsetPanel>

      {trade.screenshot_url && (
        <div className="space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground/60">
            Chart evidence
          </p>
          <button
            type="button"
            onClick={() => setScreenshotOpen(!screenshotOpen)}
            className="flex w-full items-center gap-2 rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[11px] text-cyan-glow"
          >
            <Camera className="size-3.5" />
            {screenshotOpen ? "Hide chart" : "View entry screenshot"}
          </button>
          {screenshotOpen && trade.screenshot_url ? (
            <img
              src={trade.screenshot_url}
              alt="Entry chart"
              className="max-h-[320px] w-full rounded-lg border border-white/[0.08] object-contain"
            />
          ) : null}
        </div>
      )}

      {trade.plan_id ? (
        <LinkedPlanAnalysisSection
          trade={{
            id: trade.id,
            pair: trade.pair,
            direction: trade.direction,
            result: trade.result,
            pnl: trade.pnl,
            plan_id: trade.plan_id,
            entry_price: trade.entry_price,
            stop_loss: trade.stop_loss,
            take_profit: trade.take_profit,
            risk_percent: trade.risk_percent,
            risk_reward: trade.risk_reward,
          }}
        />
      ) : null}

      <TradeCaseStudyView
        study={study}
        tradeId={tradeId}
        onSync={() => void handleSync()}
        syncing={syncing}
      />
    </div>
  )
}
