"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Loader2, NotebookPen } from "lucide-react"
import { PaperGraduationBanner } from "@/components/paper-trades/paper-graduation-banner"
import { PaperVsLivePanel } from "@/components/analytics/paper-vs-live-panel"
import { SetupGradeBadge } from "@/components/command-center/setup-grade-badge"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import { PaperTradeButton } from "@/components/paper-trades/paper-trade-button"
import { PaperTradeModal } from "@/components/paper-trades/paper-trade-modal"
import {
  createEmptyCloseDraft,
  PaperTradeClosePanel,
  type PaperTradeCloseDraft,
} from "@/components/paper-trades/paper-trade-close-panel"
import type { PaperTradeDraft } from "@/lib/paper-trades/types"
import {
  analyzePaperChartCloseAutofill,
  closePaperTradeRequest,
  fetchPaperTradesWithStats,
} from "@/lib/paper-trades/api-client"
import { computeAchievedRR } from "@/lib/paper-trades/stats"
import type { PaperTradeRecord, PaperTradeStats } from "@/lib/paper-trades/types"
import type { SetupGrade } from "@/lib/strategy-brain/types"
import type { TradingRulesSnapshot } from "@/lib/trading-rules/types"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
const CHART_FILE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
const MAX_CHART_BYTES = 10 * 1024 * 1024

type PracticeRoomWorkspaceProps = {
  accountId: string | null
  rulesSnapshot: TradingRulesSnapshot | null
}

function PaperBadge() {
  return (
    <span className="rounded-[var(--radius-sm)] border border-violet-400/35 bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-violet-200">
      Paper
    </span>
  )
}

function isSetupGrade(value: string | null | undefined): value is SetupGrade {
  return value === "A+" || value === "A" || value === "B" || value === "C" || value === "D"
}

export function PracticeRoomWorkspace({ accountId, rulesSnapshot }: PracticeRoomWorkspaceProps) {
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [trades, setTrades] = useState<PaperTradeRecord[]>([])
  const [stats, setStats] = useState<PaperTradeStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [closingId, setClosingId] = useState<string | null>(null)
  const [closeDrafts, setCloseDrafts] = useState<Record<string, PaperTradeCloseDraft>>({})
  const [prefillOpen, setPrefillOpen] = useState(false)

  const prefillDraft = useMemo((): PaperTradeDraft | null => {
    const symbol = searchParams.get("symbol")?.trim()
    if (!symbol) return null
    return {
      symbol: symbol.toUpperCase(),
      direction: (searchParams.get("direction") ?? "BUY").toUpperCase(),
      entry: searchParams.get("entry") ? parseFloat(searchParams.get("entry")!) : null,
      sl: searchParams.get("sl") ? parseFloat(searchParams.get("sl")!) : null,
      tp: searchParams.get("tp") ? parseFloat(searchParams.get("tp")!) : null,
      notes: searchParams.get("notes") ?? "",
      source: (searchParams.get("source") as PaperTradeDraft["source"]) ?? "practice",
      source_ref: searchParams.get("sourceRef"),
      setup_grade: searchParams.get("grade"),
    }
  }, [searchParams])

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const payload = await fetchPaperTradesWithStats(accountId)
      setTrades(payload.trades)
      setStats(payload.stats)
    } catch {
      setTrades([])
      setStats(null)
    } finally {
      setIsLoading(false)
    }
  }, [accountId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (prefillDraft && searchParams.get("openPaper") === "1") {
      setPrefillOpen(true)
    }
  }, [prefillDraft, searchParams])

  const getCloseDraft = useCallback(
    (tradeId: string) => closeDrafts[tradeId] ?? createEmptyCloseDraft(),
    [closeDrafts],
  )

  const setCloseDraft = useCallback((tradeId: string, draft: PaperTradeCloseDraft) => {
    setCloseDrafts((current) => ({ ...current, [tradeId]: draft }))
  }, [])

  async function uploadChartFile(file: File): Promise<string> {
    const formData = new FormData()
    formData.append("file", file)
    const uploadResponse = await fetch("/api/upload", {
      method: "POST",
      body: formData,
      credentials: "same-origin",
    })
    if (!uploadResponse.ok) {
      const payload = await uploadResponse.json().catch(() => ({}))
      throw new Error(typeof payload.error === "string" ? payload.error : "Upload failed")
    }
    const { url } = (await uploadResponse.json()) as { url: string }
    return url
  }

  async function handleAfterChartFile(trade: PaperTradeRecord, file: File) {
    if (!CHART_FILE_TYPES.includes(file.type)) {
      setCloseDraft(trade.id, {
        ...getCloseDraft(trade.id),
        chartPhase: "error",
        chartMessage: "❌ Use JPG, PNG, or WebP.",
      })
      return
    }
    if (file.size > MAX_CHART_BYTES) {
      setCloseDraft(trade.id, {
        ...getCloseDraft(trade.id),
        chartPhase: "error",
        chartMessage: "❌ File too large (max 10MB).",
      })
      return
    }

    let draft = getCloseDraft(trade.id)
    draft = {
      ...draft,
      chartPhase: "uploading",
      chartMessage: "📤 Uploading after chart…",
    }
    setCloseDraft(trade.id, draft)

    try {
      const url = await uploadChartFile(file)
      draft = { ...draft, afterChartUrl: url, chartPhase: "analyzing", chartMessage: "🔍 Reading exit chart…" }
      setCloseDraft(trade.id, draft)

      const result = await analyzePaperChartCloseAutofill({
        imageUrl: url,
        symbol: trade.symbol,
        direction: trade.direction,
        entry: trade.entry,
        sl: trade.sl,
        tp: trade.tp,
      })

      const aiFilledFields = new Set(result.aiFilledFields)
      const next: PaperTradeCloseDraft = {
        ...draft,
        afterChartUrl: url,
        chartPhase: result.applied ? "success" : "error",
        chartMessage: result.applied
          ? "✅ After chart analysed — close fields filled!"
          : "❌ Could not read exit price. Fill manually.",
        confidenceLabel: result.confidenceLabel,
        aiFilledFields,
      }

      if (result.applied) {
        if (result.applied.closePrice != null) {
          next.closePrice = String(result.applied.closePrice)
        }
        if (result.applied.result) {
          next.closeResult = result.applied.result
        }
        if (result.applied.pnl != null) {
          next.closePnl = String(result.applied.pnl)
        }
      }

      setCloseDraft(trade.id, next)
    } catch (error) {
      setCloseDraft(trade.id, {
        ...getCloseDraft(trade.id),
        chartPhase: "error",
        chartMessage: "❌ Could not analyse after chart.",
      })
      toast({
        title: "After chart analysis failed",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      })
    }
  }

  async function handleClose(trade: PaperTradeRecord) {
    const draft = getCloseDraft(trade.id)
    if (!draft.closePrice.trim()) {
      toast({ title: "Close price required", variant: "destructive" })
      return
    }
    if (!draft.closeResult) {
      toast({ title: "Select a result", variant: "destructive" })
      return
    }

    const close = parseFloat(draft.closePrice)
    const rr =
      trade.entry != null && trade.sl != null
        ? computeAchievedRR({
            direction: trade.direction,
            entry: trade.entry,
            sl: trade.sl,
            closePrice: close,
          })
        : null

    const pnlParsed = draft.closePnl.trim() ? parseFloat(draft.closePnl) : null

    setClosingId(trade.id)
    try {
      const closed = await closePaperTradeRequest(trade.id, {
        close_price: close,
        result: draft.closeResult,
        rr,
        pnl:
          pnlParsed != null && Number.isFinite(pnlParsed)
            ? pnlParsed
            : draft.closeResult === "WIN"
              ? rr ?? 1
              : draft.closeResult === "LOSS"
                ? -1
                : 0,
        chart_image_url_after: draft.afterChartUrl,
      })
      if (closed.warning) {
        toast({
          title: "Paper trade closed",
          description: `${trade.symbol} marked ${draft.closeResult}. ${closed.warning}`,
        })
      } else {
        toast({
          title: "Paper trade closed",
          description: `${trade.symbol} marked ${draft.closeResult}.`,
        })
      }
      setCloseDrafts((current) => {
        const next = { ...current }
        delete next[trade.id]
        return next
      })
      await load()
    } catch (error) {
      toast({
        title: "Could not close paper trade",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      })
    } finally {
      setClosingId(null)
    }
  }

  const cooldownActive = rulesSnapshot?.cooldownRequired ?? false

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <NotebookPen className="size-4 text-violet-300" />
          <h1 className="text-base font-medium text-text-primary">Practice Room</h1>
          <PaperBadge />
        </div>
        <p className="max-w-2xl text-[12px] text-text-muted">
          Analyse it, paper trade it, prove it works — then go live with confidence. Paper trades never
          touch live P&L or rule enforcement.
        </p>
      </div>

      {cooldownActive ? (
        <DashboardInsetPanel className="border-violet-400/25 bg-violet-500/[0.08]">
          <p className="text-[12px] font-medium text-violet-100">
            Real trading locked. Practice your setups here instead — paper trading stays available during
            cooldown.
          </p>
        </DashboardInsetPanel>
      ) : null}

      {stats?.readyForLive ? (
        <PaperGraduationBanner winStreak={stats.winStreak} variant="practice" />
      ) : stats?.graduationMessage ? (
        <DashboardInsetPanel className="border-white/[0.08] bg-white/[0.02]">
          <p className="text-[12px] text-text-secondary">{stats.graduationMessage}</p>
        </DashboardInsetPanel>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-4">
        <StatCard label="Paper win rate" value={`${stats?.winRate ?? 0}%`} />
        <StatCard
          label="Paper P&L"
          value={`${(stats?.totalPnL ?? 0) >= 0 ? "+" : ""}${(stats?.totalPnL ?? 0).toFixed(1)}R`}
        />
        <StatCard label="Avg R:R" value={stats?.avgRR != null ? `${stats.avgRR.toFixed(2)}R` : "—"} />
        <StatCard label="Win streak" value={`${stats?.winStreak ?? 0}`} sub="/ 3 to graduate" />
      </div>

      <PaperVsLivePanel accountId={accountId} embedded />

      <div className="flex flex-wrap gap-2">
        <PaperTradeButton
          draft={{ symbol: "EURUSD", direction: "BUY", source: "practice" }}
          label="📝 New paper trade"
          onCreated={() => void load()}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-violet-300" />
        </div>
      ) : trades.length === 0 ? (
        <DashboardInsetPanel className="py-10 text-center text-[12px] text-text-muted">
          No paper trades yet. Use War Room or webhook alerts to paper trade a setup.
        </DashboardInsetPanel>
      ) : (
        <div className="space-y-3">
          {trades.map((trade) => (
            <PaperTradeCard
              key={trade.id}
              trade={trade}
              closeDraft={getCloseDraft(trade.id)}
              isClosing={closingId === trade.id}
              onCloseDraftChange={(draft) => setCloseDraft(trade.id, draft)}
              onAfterChartFile={(file) => void handleAfterChartFile(trade, file)}
              onClose={() => void handleClose(trade)}
            />
          ))}
        </div>
      )}

      {prefillDraft ? (
        <PaperTradeModal
          open={prefillOpen}
          draft={prefillDraft}
          onClose={() => setPrefillOpen(false)}
          onCreated={() => {
            setPrefillOpen(false)
            void load()
          }}
        />
      ) : null}
    </div>
  )
}

type PaperTradeCardProps = {
  trade: PaperTradeRecord
  closeDraft: PaperTradeCloseDraft
  isClosing: boolean
  onCloseDraftChange: (draft: PaperTradeCloseDraft) => void
  onAfterChartFile: (file: File) => void
  onClose: () => void
}

function PaperTradeCard({
  trade,
  closeDraft,
  isClosing,
  onCloseDraftChange,
  onAfterChartFile,
  onClose,
}: PaperTradeCardProps) {
  return (
    <DashboardInsetPanel className="space-y-3">
      <div className="flex gap-3">
        {trade.chart_image_url ? (
          <div className="shrink-0 overflow-hidden rounded-[var(--radius-sm)] border border-white/[0.08]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={trade.chart_image_url}
              alt={`${trade.symbol} entry chart`}
              className="size-[72px] object-cover object-top sm:size-20"
            />
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[13px] font-medium text-text-primary">{trade.symbol}</p>
                <PaperBadge />
                <span className="text-[11px] text-cyan-glow/90">{trade.direction}</span>
                <ResultPill result={trade.result} />
                {isSetupGrade(trade.setup_grade) ? (
                  <SetupGradeBadge grade={trade.setup_grade} label="Coach" size="sm" />
                ) : null}
              </div>
              <p className="mt-1 text-[10px] text-text-muted">
                Entry {trade.entry ?? "—"} · SL {trade.sl ?? "—"} · TP {trade.tp ?? "—"}
                {trade.rr != null ? ` · ${trade.rr.toFixed(2)}R` : ""}
                {trade.pnl !== 0 && trade.result !== "PENDING"
                  ? ` · ${trade.pnl >= 0 ? "+" : ""}${trade.pnl.toFixed(1)}R`
                  : ""}
              </p>
              {trade.coach_feedback ? (
                <p className="mt-1.5 text-[11px] leading-relaxed text-text-secondary line-clamp-2">
                  {trade.coach_feedback}
                </p>
              ) : trade.notes ? (
                <p className="mt-1.5 text-[11px] leading-relaxed text-text-secondary line-clamp-2">
                  {trade.notes}
                </p>
              ) : null}
            </div>
            <p className="shrink-0 text-[10px] tabular-nums text-text-muted">
              {new Date(trade.created_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>
        </div>
      </div>

      {trade.result === "PENDING" ? (
        <PaperTradeClosePanel
          trade={trade}
          draft={closeDraft}
          isClosing={isClosing}
          onDraftChange={onCloseDraftChange}
          onAfterChartFile={onAfterChartFile}
          onClose={onClose}
        />
      ) : trade.chart_image_url_after ? (
        <div className="grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-3">
          <ClosedChartThumb label="Before" url={trade.chart_image_url} />
          <ClosedChartThumb label="After" url={trade.chart_image_url_after} />
        </div>
      ) : null}
    </DashboardInsetPanel>
  )
}

function ClosedChartThumb({ label, url }: { label: string; url: string | null }) {
  if (!url) return null
  return (
    <div className="space-y-1">
      <p className="text-[10px] text-text-muted">{label}</p>
      <div className="overflow-hidden rounded-[var(--radius-sm)] border border-white/[0.08]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={label} className="h-16 w-full object-cover object-top" />
      </div>
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <DashboardInsetPanel className="px-3 py-3">
      <p className="text-[10px] uppercase tracking-[0.08em] text-text-muted">{label}</p>
      <p className="mt-1 text-[20px] font-semibold tabular-nums text-text-primary">{value}</p>
      {sub ? <p className="text-[10px] text-text-muted">{sub}</p> : null}
    </DashboardInsetPanel>
  )
}

function ResultPill({ result }: { result: PaperTradeRecord["result"] }) {
  return (
    <span
      className={cn(
        "rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[9px] font-semibold uppercase",
        result === "WIN" && "bg-profit/15 text-profit",
        result === "LOSS" && "bg-loss/15 text-loss",
        result === "BREAKEVEN" && "bg-white/10 text-text-secondary",
        result === "PENDING" && "bg-violet-500/15 text-violet-200",
      )}
    >
      {result}
    </span>
  )
}
