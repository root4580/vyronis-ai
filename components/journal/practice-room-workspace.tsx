"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { GraduationCap, Loader2, NotebookPen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PaperVsLivePanel } from "@/components/analytics/paper-vs-live-panel"
import { SetupGradeBadge } from "@/components/command-center/setup-grade-badge"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import { PaperTradeButton } from "@/components/paper-trades/paper-trade-button"
import { PaperTradeModal } from "@/components/paper-trades/paper-trade-modal"
import type { PaperTradeDraft } from "@/lib/paper-trades/types"
import {
  closePaperTradeRequest,
  fetchPaperTradesWithStats,
} from "@/lib/paper-trades/api-client"
import { computeAchievedRR } from "@/lib/paper-trades/stats"
import type { PaperTradeRecord, PaperTradeStats } from "@/lib/paper-trades/types"
import type { SetupGrade } from "@/lib/strategy-brain/types"
import type { TradingRulesSnapshot } from "@/lib/trading-rules/types"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

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
  const [closePrice, setClosePrice] = useState("")
  const [closeResult, setCloseResult] = useState<"WIN" | "LOSS" | "BREAKEVEN">("WIN")
  const [closePnl, setClosePnl] = useState("")
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

  async function handleClose(trade: PaperTradeRecord) {
    if (!closePrice.trim()) {
      toast({ title: "Close price required", variant: "destructive" })
      return
    }
    const close = parseFloat(closePrice)
    const rr =
      trade.entry != null && trade.sl != null
        ? computeAchievedRR({
            direction: trade.direction,
            entry: trade.entry,
            sl: trade.sl,
            closePrice: close,
          })
        : null

    setClosingId(trade.id)
    try {
      await closePaperTradeRequest(trade.id, {
        close_price: close,
        result: closeResult,
        rr,
        pnl: closePnl ? parseFloat(closePnl) : closeResult === "WIN" ? 1 : closeResult === "LOSS" ? -1 : 0,
      })
      toast({ title: "Paper trade closed", description: `${trade.symbol} marked ${closeResult}.` })
      setClosePrice("")
      setClosePnl("")
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
        <DashboardInsetPanel className="border-profit/30 bg-profit/[0.08]">
          <div className="flex items-start gap-2">
            <GraduationCap className="mt-0.5 size-5 shrink-0 text-profit" />
            <div>
              <p className="text-[14px] font-semibold text-profit">
                🎓 Setup proven. Ready to go live?
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">
                {stats.winStreak} winning paper trades in a row on this account. Your process held up on
                paper — when live rules allow, take the same discipline to the journal.
              </p>
            </div>
          </div>
        </DashboardInsetPanel>
      ) : stats?.graduationMessage ? (
        <DashboardInsetPanel className="border-white/[0.08] bg-white/[0.02]">
          <p className="text-[12px] text-text-secondary">{stats.graduationMessage}</p>
        </DashboardInsetPanel>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Paper win rate" value={`${stats?.winRate ?? 0}%`} />
        <StatCard label="Paper P&L" value={`${(stats?.totalPnL ?? 0) >= 0 ? "+" : ""}${(stats?.totalPnL ?? 0).toFixed(1)}R`} />
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
              closingId={closingId}
              closePrice={closePrice}
              closeResult={closeResult}
              closePnl={closePnl}
              onClosePriceChange={(id, value) => {
                setClosingId(id)
                setClosePrice(value)
              }}
              onCloseResultChange={(id, value) => {
                setClosingId(id)
                setCloseResult(value)
              }}
              onClosePnlChange={(id, value) => {
                setClosingId(id)
                setClosePnl(value)
              }}
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
  closingId: string | null
  closePrice: string
  closeResult: "WIN" | "LOSS" | "BREAKEVEN"
  closePnl: string
  onClosePriceChange: (id: string, value: string) => void
  onCloseResultChange: (id: string, value: "WIN" | "LOSS" | "BREAKEVEN") => void
  onClosePnlChange: (id: string, value: string) => void
  onClose: () => void
}

function PaperTradeCard({
  trade,
  closingId,
  closePrice,
  closeResult,
  closePnl,
  onClosePriceChange,
  onCloseResultChange,
  onClosePnlChange,
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
              alt={`${trade.symbol} chart`}
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
        <div className="grid grid-cols-1 gap-2 border-t border-white/[0.06] pt-3 sm:grid-cols-4">
          <div className="space-y-1 sm:col-span-1">
            <Label className="text-[10px] text-text-muted">Close price</Label>
            <Input
              type="number"
              step="any"
              value={closingId === trade.id ? closePrice : ""}
              onChange={(e) => onClosePriceChange(trade.id, e.target.value)}
              className="add-trade-input h-9 tabular-nums"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-text-muted">Result</Label>
            <Select
              value={closingId === trade.id ? closeResult : "WIN"}
              onValueChange={(value) =>
                onCloseResultChange(trade.id, value as typeof closeResult)
              }
            >
              <SelectTrigger className="add-trade-input h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WIN">Win</SelectItem>
                <SelectItem value="LOSS">Loss</SelectItem>
                <SelectItem value="BREAKEVEN">Breakeven</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-text-muted">P&L (R)</Label>
            <Input
              type="number"
              step="0.1"
              value={closingId === trade.id ? closePnl : ""}
              onChange={(e) => onClosePnlChange(trade.id, e.target.value)}
              placeholder="1.0"
              className="add-trade-input h-9 tabular-nums"
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              size="sm"
              className="h-9 w-full"
              disabled={closingId === trade.id && !closePrice}
              onClick={onClose}
            >
              Close paper trade
            </Button>
          </div>
        </div>
      ) : null}
    </DashboardInsetPanel>
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
