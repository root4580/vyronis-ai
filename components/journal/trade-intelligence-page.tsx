"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Camera, Pencil } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { TradeIntelligencePanel } from "@/components/dashboard/trade-intelligence-panel"
import { MistakeTagList } from "@/components/dashboard/mistake-tag-badge"
import { SetupScoreBadge } from "@/components/dashboard/setup-score-badge"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import { Button } from "@/components/ui/button"
import { resolveStoredSetupScore } from "@/lib/trade-coach/setup-score-engine"
import { getTradeDisplayMistakeTags } from "@/lib/mistake-tags"
import { formatPnL, getPnLTextClass } from "@/lib/trade-utils"
import type { TradeDetails } from "@/components/dashboard/trade-details-modal"
import { cn } from "@/lib/utils"

type TradeIntelligencePageProps = {
  tradeId: string
  onEdit?: (trade: TradeDetails) => void
}

export function TradeIntelligencePage({ tradeId, onEdit }: TradeIntelligencePageProps) {
  const router = useRouter()
  const [trade, setTrade] = useState<TradeDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [screenshotOpen, setScreenshotOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.from("trades").select("*").eq("id", tradeId).maybeSingle()
    if (error || !data) {
      setTrade(null)
    } else {
      setTrade(data as unknown as TradeDetails)
    }
    setLoading(false)
  }, [tradeId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <p className="py-12 text-center text-[13px] text-muted-foreground animate-pulse">
        Loading trade intelligence…
      </p>
    )
  }

  if (!trade) {
    return (
      <div className="space-y-3 py-8 text-center">
        <p className="text-[13px] text-loss">Trade not found</p>
        <Button type="button" variant="outline" onClick={() => router.push("/?tab=journal")}>
          Back to journal
        </Button>
      </div>
    )
  }

  const setup = resolveStoredSetupScore(trade)
  const mistakes = getTradeDisplayMistakeTags(trade)

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/?tab=journal"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-cyan-glow"
        >
          <ArrowLeft className="size-3" />
          Journal
        </Link>
        <div className="flex gap-2">
          {onEdit ? (
            <Button type="button" variant="outline" size="sm" onClick={() => onEdit(trade)}>
              <Pencil className="mr-1.5 size-3.5" />
              Edit
            </Button>
          ) : null}
        </div>
      </div>

      <DashboardInsetPanel className="px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
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
            <p className={cn("text-lg font-bold tabular-nums", getPnLTextClass(trade.pnl, trade.result))}>
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
          {trade.confirmation_signal ? (
            <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px]">
              {trade.confirmation_signal}
            </span>
          ) : null}
        </div>
      </DashboardInsetPanel>

      {trade.screenshot_url ? (
        <div className="space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground/60">
            Chart / entry screenshot
          </p>
          <button
            type="button"
            onClick={() => setScreenshotOpen(!screenshotOpen)}
            className="flex w-full items-center gap-2 rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[11px] text-cyan-glow"
          >
            <Camera className="size-3.5" />
            {screenshotOpen ? "Hide screenshot" : "View screenshot"}
          </button>
          {screenshotOpen ? (
            <img
              src={trade.screenshot_url}
              alt="Trade screenshot"
              className="max-h-[320px] w-full rounded-lg border border-white/[0.08] object-contain"
            />
          ) : null}
        </div>
      ) : null}

      <TradeIntelligencePanel tradeId={tradeId} refreshKey={0} />

      {mistakes.length > 0 ? (
        <DashboardInsetPanel className="px-3 py-3">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground/60">
            Mistakes tagged
          </p>
          <MistakeTagList tags={mistakes} />
        </DashboardInsetPanel>
      ) : null}

      {trade.trade_notes ? (
        <DashboardInsetPanel className="px-3 py-3">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground/60">
            Notes
          </p>
          <p className="text-[12px] leading-relaxed text-foreground/85 whitespace-pre-wrap">
            {trade.trade_notes}
          </p>
        </DashboardInsetPanel>
      ) : null}
    </div>
  )
}
