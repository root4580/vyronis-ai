"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { GraduationCap, Loader2, NotebookPen } from "lucide-react"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import { fetchPaperVsLiveStats } from "@/lib/paper-trades/api-client"
import type { PaperVsLiveStats } from "@/lib/paper-trades/types"
import { getPracticeRoomHref } from "@/lib/dashboard-nav"
import { cn } from "@/lib/utils"

type PaperVsLivePanelProps = {
  accountId: string | null
  /** Practice Room embed — no outbound link, no duplicate graduation banner. */
  embedded?: boolean
}

export function PaperVsLivePanel({ accountId, embedded = false }: PaperVsLivePanelProps) {
  const [stats, setStats] = useState<PaperVsLiveStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [migrationPending, setMigrationPending] = useState(false)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    void fetchPaperVsLiveStats(accountId)
      .then((payload) => {
        if (cancelled) return
        setStats(payload)
        setMigrationPending(Boolean((payload as { migrationPending?: boolean }).migrationPending))
      })
      .catch(() => {
        if (!cancelled) setStats(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [accountId])

  if (isLoading) {
    return (
      <DashboardInsetPanel className="flex min-h-[120px] items-center justify-center">
        <Loader2 className="size-5 animate-spin text-violet-300" />
      </DashboardInsetPanel>
    )
  }

  if (migrationPending) {
    return (
      <DashboardInsetPanel className="text-[12px] text-text-muted">
        Paper trading tables are not migrated yet. Run{" "}
        <code className="text-[11px] text-text-secondary">supabase/037-paper-trades.sql</code> in Supabase
        to enable Practice Room stats.
      </DashboardInsetPanel>
    )
  }

  const paper = stats?.paper
  const live = stats?.live

  return (
    <div className="space-y-3">
      {!embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] text-text-secondary">
            Compare paper practice performance against live journal trades on this account.
          </p>
          <Link
            href={getPracticeRoomHref()}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-violet-200 hover:text-violet-100"
          >
            <NotebookPen className="size-3.5" />
            Open Practice Room
          </Link>
        </div>
      ) : (
        <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-text-muted">
          Paper vs live
        </p>
      )}

      {!embedded && paper?.readyForLive ? (
        <DashboardInsetPanel className="border-profit/30 bg-profit/[0.08]">
          <div className="flex items-start gap-2">
            <GraduationCap className="mt-0.5 size-4 text-profit" />
            <p className="text-[12px] text-profit">
              {paper.winStreak} paper wins in a row — setup proven on paper. Consider going live when
              rules allow.
            </p>
          </div>
        </DashboardInsetPanel>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <CompareCard title="Paper (Practice)" accent="violet" stats={paper} />
        <CompareCard title="Live (Journal)" accent="cyan" stats={live} isLive />
      </div>
    </div>
  )
}

type CompareStats = {
  winRate?: number
  avgRR?: number | null
  totalPnL?: number
  total?: number
  wins?: number
  losses?: number
  winStreak?: number
}

function CompareCard({
  title,
  accent,
  stats,
  isLive,
}: {
  title: string
  accent: "violet" | "cyan"
  stats?: CompareStats | null
  isLive?: boolean
}) {
  return (
    <DashboardInsetPanel
      className={cn(
        accent === "violet" && "border-violet-400/20",
        accent === "cyan" && "border-cyan-glow/20",
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          className={cn(
            "rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em]",
            accent === "violet" && "border border-violet-400/35 bg-violet-500/15 text-violet-200",
            accent === "cyan" && "border border-cyan-glow/35 bg-cyan-glow/10 text-cyan-glow",
          )}
        >
          {isLive ? "Live" : "Paper"}
        </span>
        <p className="text-[12px] font-medium text-text-primary">{title}</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Metric label="Win rate" value={`${stats?.winRate ?? 0}%`} />
        <Metric
          label="Avg R:R"
          value={stats?.avgRR != null ? `${stats.avgRR.toFixed(2)}R` : "—"}
        />
        <Metric
          label="P&L"
          value={`${(stats?.totalPnL ?? 0) >= 0 ? "+" : ""}${(stats?.totalPnL ?? 0).toFixed(1)}${isLive ? "" : "R"}`}
        />
      </div>
      {!isLive && stats?.winStreak != null && stats.winStreak > 0 ? (
        <p className="mt-3 text-[10px] text-text-muted">
          Current streak: {stats.winStreak} win{stats.winStreak === 1 ? "" : "s"} (resets on loss)
        </p>
      ) : null}
      <p className="mt-2 text-[10px] text-text-muted">
        {stats?.total ?? 0} trades · {stats?.wins ?? 0}W / {stats?.losses ?? 0}L
      </p>
    </DashboardInsetPanel>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.08em] text-text-muted">{label}</p>
      <p className="mt-0.5 text-[18px] font-semibold tabular-nums text-text-primary">{value}</p>
    </div>
  )
}
