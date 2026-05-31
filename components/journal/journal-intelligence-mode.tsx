"use client"

import { useMemo } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowRight, Brain, Target } from "lucide-react"
import { generatePatternMemory } from "@/lib/trade-coach/pattern-memory"
import type { DashboardTradeRow } from "@/components/dashboard/trading-components"
import { buildSetupFingerprint } from "@/lib/journal/setup-fingerprint"
import { findSimilarTradeMemory } from "@/lib/strategy-brain/trade-memory-engine"
import { defaultConfirmationChecklist } from "@/lib/strategy-brain/confirmation-engine"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import { cn } from "@/lib/utils"

export function JournalIntelligenceMode({
  trades,
  maxRiskPerTrade = 1,
}: {
  trades: DashboardTradeRow[]
  maxRiskPerTrade?: number
}) {
  const patterns = useMemo(() => {
    const memoryTrades = trades.map((t) => ({
      id: t.id,
      pair: t.pair,
      direction: t.direction,
      result: t.result,
      pnl: t.pnl,
      emotion: t.emotion,
      setup: t.setup,
      confirmation_signal: t.confirmation_signal ?? null,
      mistake_tags: t.mistake_tags ?? null,
      trade_date: t.trade_date ?? null,
      created_at: t.created_at,
    }))
    return generatePatternMemory({
      trades: memoryTrades,
      feedback: [],
      sessions: [],
      maxRiskPerTrade,
    })
  }, [trades, maxRiskPerTrade])

  const recentWithMemory = useMemo(() => {
    const historical = trades.map((t) => ({
      id: t.id,
      pair: t.pair,
      direction: t.direction,
      result: t.result,
      pnl: t.pnl,
      emotion: t.emotion ?? null,
      setup: t.setup ?? null,
      confirmation_signal: t.confirmation_signal ?? null,
      mistake_tags: t.mistake_tags ?? null,
      trade_date: t.trade_date ?? null,
    }))
    return trades.slice(0, 6).map((t) => ({
      trade: t,
      memory: findSimilarTradeMemory({
        pair: t.pair,
        trades: historical.filter((h) => h.id !== t.id),
        confirmation: defaultConfirmationChecklist(),
        emotionUnstable: /fomo|revenge|anxious/i.test(t.emotion || ""),
        currentTradeId: t.id,
        currentTrade: {
          id: t.id,
          pair: t.pair,
          direction: t.direction,
          result: t.result,
          pnl: t.pnl,
          emotion: t.emotion,
          setup: t.setup,
          session: t.session,
          confirmation_signal: t.confirmation_signal,
          mistake_tags: t.mistake_tags,
          trade_date: t.trade_date,
        },
      }),
      fingerprint: buildSetupFingerprint({
        id: t.id,
        pair: t.pair,
        direction: t.direction,
        result: t.result,
        emotion: t.emotion,
        setup: t.setup,
        session: t.session,
        confirmation_signal: t.confirmation_signal,
        mistake_tags: t.mistake_tags,
        trade_date: t.trade_date,
      }),
    }))
  }, [trades])

  return (
    <div className="space-y-4">
      <DashboardInsetPanel className="border-cyan-glow/15 bg-cyan-glow/[0.04] px-4 py-3">
        <div className="flex items-start gap-3">
          <Brain className="mt-0.5 size-5 shrink-0 text-cyan-glow" />
          <div>
            <p className="text-[13px] font-medium text-foreground/92">Learning system</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground/80">
              Vyronis compares each setup to your journal — bias, emotion, confirmation, and past
              mistakes — not just P&amp;L.
            </p>
            <Link
              href="/war-room"
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-cyan-glow hover:underline"
            >
              Open Weekly War Room
              <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>
      </DashboardInsetPanel>

      {patterns.patterns.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-muted-foreground/60">
            Active patterns
          </p>
          {patterns.patterns.slice(0, 5).map((p) => (
            <div
              key={p.id}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-[12px] leading-relaxed",
                p.severity === "warning" && "border-warning/25 bg-warning/[0.06] text-warning-foreground/90",
                p.severity === "positive" && "border-profit/25 bg-profit/[0.06] text-profit/90",
                p.severity === "insight" && "border-white/[0.08] bg-white/[0.03] text-foreground/85",
              )}
            >
              {p.message}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-muted-foreground/70">{patterns.emptyMessage}</p>
      )}

      <div className="space-y-2">
        <p className="text-[11px] font-medium text-muted-foreground/60">
          Trade memory (recent)
        </p>
        {recentWithMemory.map(({ trade, memory, fingerprint }) => (
          <Link
            key={trade.id}
            href={`/journal/trade/${trade.id}`}
            className="block rounded-lg border border-white/[0.08] bg-black/25 px-3 py-2.5 transition-colors hover:border-cyan-glow/25"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium">
                {trade.pair} · {trade.result}
              </span>
              <Target className="size-3.5 text-muted-foreground/50" />
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground/60">
              {fingerprint.structureType} · {fingerprint.confirmationQuality} conf ·{" "}
              {fingerprint.emotionalState}
            </p>
            {memory ? (
              <p className="mt-1.5 text-[11px] leading-relaxed text-violet-100/85">{memory}</p>
            ) : (
              <p className="mt-1 text-[11px] text-muted-foreground/55">Open case study</p>
            )}
          </Link>
        ))}
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/[0.05] px-3 py-2 text-[11px] text-warning-muted/85">
        <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
        <span>
          Tap any trade in Calendar view for HTF alignment, checklist, grade, screenshots, and AI
          review on the Trade Intelligence page.
        </span>
      </div>
    </div>
  )
}
