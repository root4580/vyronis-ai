"use client"

import { Brain, ClipboardList, Loader2, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DashboardCard,
  DashboardCardBody,
  DashboardCardHeader,
} from "@/components/dashboard/dashboard-primitives"
import type { PlannedCoachSessionItem } from "@/lib/trade-coach/types"
import { cn } from "@/lib/utils"

type PlannedTradesSectionProps = {
  sessions: PlannedCoachSessionItem[]
  isLoading?: boolean
  deletingSessionId?: string | null
  onContinueCoach: (sessionId: string) => void
  onConvertToTrade: (sessionId: string) => void
  onDeletePlanned: (sessionId: string) => void
  onNewCoach?: () => void
  variant?: "default" | "journal"
}

function statusLabel(session: PlannedCoachSessionItem) {
  if (session.signal_source === "tradingview" && session.status === "in_progress") {
    return "Setup alert"
  }
  if (session.status === "in_progress") return "In progress"
  return "Ready to log"
}

function recommendationClass(rec: string | null | undefined) {
  if (rec === "TAKE") return "border-profit/25 bg-profit/[0.08] text-profit"
  if (rec === "SKIP") return "border-loss/25 bg-loss/[0.08] text-loss"
  if (rec === "CAUTION") return "border-warning/25 bg-warning/[0.08] text-warning-foreground"
  return "border-white/10 text-muted-foreground"
}

function JournalPlannedCard({
  session,
  deletingSessionId,
  onContinueCoach,
  onConvertToTrade,
  onDeletePlanned,
}: {
  session: PlannedCoachSessionItem
  deletingSessionId: string | null
  onContinueCoach: (sessionId: string) => void
  onConvertToTrade: (sessionId: string) => void
  onDeletePlanned: (sessionId: string) => void
}) {
  const inProgress = session.status === "in_progress"

  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-[14px] py-[11px]",
        inProgress && "opacity-65",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-medium text-text-primary">
          {session.pair || "Open plan"}
          {session.direction ? ` · ${session.direction}` : ""}
        </span>
        <Badge variant="outline" className="h-5 border-[var(--border-subtle)] text-[10px] text-text-muted">
          {statusLabel(session)}
        </Badge>
        {session.ai_recommendation ? (
          <Badge
            variant="outline"
            className={cn("h-5 text-[9px]", recommendationClass(session.ai_recommendation))}
          >
            {session.ai_recommendation}
          </Badge>
        ) : null}
      </div>

      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-text-muted">{session.plan_summary}</p>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {inProgress ? (
          <Button
            type="button"
            variant="ghost"
            className="h-8 border border-[var(--border-subtle)] bg-transparent px-3 text-[11px] text-text-secondary hover:bg-white/[0.04]"
            onClick={() => onContinueCoach(session.id)}
          >
            Review plan
          </Button>
        ) : (
          <>
            <Button
              type="button"
              className="h-8 btn-primary px-3 text-[11px]"
              onClick={() => onConvertToTrade(session.id)}
            >
              Log completed trade
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-8 border border-[var(--border-subtle)] bg-transparent px-3 text-[11px] text-text-secondary hover:bg-white/[0.04]"
              onClick={() => onContinueCoach(session.id)}
            >
              Review plan
            </Button>
          </>
        )}
        <Button
          type="button"
          variant="ghost"
          className="h-8 border border-[rgb(from_var(--color-loss)_r_g_b_/_0.25)] bg-transparent px-3 text-[11px] text-[var(--color-loss)] hover:bg-[rgb(from_var(--color-loss)_r_g_b_/_0.08)]"
          disabled={deletingSessionId === session.id}
          onClick={() => onDeletePlanned(session.id)}
        >
          {deletingSessionId === session.id ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <>
              <Trash2 className="mr-1.5 size-3.5" />
              Delete
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

export function PlannedTradesSection({
  sessions,
  isLoading = false,
  deletingSessionId = null,
  onContinueCoach,
  onConvertToTrade,
  onDeletePlanned,
  onNewCoach,
  variant = "default",
}: PlannedTradesSectionProps) {
  const sorted = [...sessions].sort((a, b) => {
    if (a.status === b.status) {
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    }
    return a.status === "completed" ? -1 : 1
  })

  const listBody =
    isLoading && sessions.length === 0 ? (
      <div className="flex min-h-[80px] items-center justify-center">
        <Loader2 className="size-5 animate-spin text-text-accent" />
      </div>
    ) : sessions.length === 0 ? (
      <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-subtle)] px-4 py-5 text-center">
        <Brain className="mx-auto mb-2 size-5 text-text-accent/70" />
        <p className="text-[13px] font-medium text-text-primary">No planned setups yet</p>
        <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
          TradingView alerts and Coach plans appear here until you log the trade.
        </p>
      </div>
    ) : (
      <div className="space-y-2">
        {sorted.map((session) => (
          <JournalPlannedCard
            key={session.id}
            session={session}
            deletingSessionId={deletingSessionId}
            onContinueCoach={onContinueCoach}
            onConvertToTrade={onConvertToTrade}
            onDeletePlanned={onDeletePlanned}
          />
        ))}
      </div>
    )

  if (variant === "journal") {
    return listBody
  }

  return (
    <DashboardCard className="glass-card floating-glow" interactive glow>
      <DashboardCardHeader
        title="Planned trades"
        icon={ClipboardList}
        badge={
          <Badge variant="outline" className="h-6 text-[10px] font-medium">
            {sessions.length} pending
          </Badge>
        }
        action={
          onNewCoach ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onNewCoach}
              className="h-8 border-cyan-glow/20 bg-cyan-glow/[0.04] text-[11px] text-cyan-glow hover:bg-cyan-glow/[0.08]"
            >
              <Brain className="mr-1.5 size-3.5" />
              Pre-Trade Coach
            </Button>
          ) : undefined
        }
      />
      <DashboardCardBody className="space-y-3 pt-2">{listBody}</DashboardCardBody>
    </DashboardCard>
  )
}
