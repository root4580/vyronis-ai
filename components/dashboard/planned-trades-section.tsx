"use client"

import { ArrowRight, Brain, ClipboardList, Loader2, Radio, Trash2 } from "lucide-react"
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

export function PlannedTradesSection({
  sessions,
  isLoading = false,
  deletingSessionId = null,
  onContinueCoach,
  onConvertToTrade,
  onDeletePlanned,
  onNewCoach,
}: PlannedTradesSectionProps) {
  return (
    <DashboardCard className="glass-card floating-glow" interactive glow>
      <DashboardCardHeader
        title="Planned Trades"
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
      <DashboardCardBody className="space-y-3 pt-2">
        {isLoading && sessions.length === 0 ? (
          <div className="flex min-h-[120px] items-center justify-center">
            <Loader2 className="size-5 animate-spin text-cyan-glow" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-6 text-center">
            <Brain className="mx-auto mb-2 size-5 text-cyan-glow/70" />
            <p className="text-[13px] font-medium text-foreground/85">No planned trades yet</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/70">
              TradingView setup alerts and Pre-Trade Coach plans appear here until you log the
              trade.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] leading-relaxed text-muted-foreground/65">
              TradingView alerts land here automatically. Open Coach when ready — no orders are
              placed.
            </p>
            {[...sessions]
              .sort((a, b) => {
                if (a.status === b.status) {
                  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
                }
                return a.status === "completed" ? -1 : 1
              })
              .map((session) => {
              const isTradingView = session.signal_source === "tradingview"
              return (
                <div
                  key={session.id}
                  className={cn(
                    "rounded-xl border px-3 py-3",
                    isTradingView
                      ? "border-cyan-glow/20 bg-cyan-glow/[0.03] shadow-[inset_0_1px_0_rgb(from var(--color-accent) r g b / 0.08)]"
                      : "border-white/[0.06] bg-white/[0.02]",
                  )}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-semibold text-foreground">
                          {session.pair || "Open plan"}
                          {session.direction ? ` · ${session.direction}` : ""}
                        </span>
                        {isTradingView ? (
                          <Badge
                            variant="outline"
                            className="h-5 border-cyan-glow/30 bg-cyan-glow/[0.1] text-[9px] text-cyan-glow"
                          >
                            <Radio className="mr-1 size-3" />
                            TV Alert
                          </Badge>
                        ) : null}
                        <Badge
                          variant="outline"
                          className={cn(
                            "h-5 text-[10px]",
                            session.status === "completed"
                              ? "border-profit/20 text-profit"
                              : "border-cyan-glow/20 text-cyan-glow",
                          )}
                        >
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
                        {session.confidence_score !== null && (
                          <Badge variant="outline" className="h-5 text-[10px]">
                            {session.confidence_score}/100
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground/75">
                        {session.strategy_name ? <span>Strategy: {session.strategy_name}</span> : null}
                        {session.timeframe ? <span>TF: {session.timeframe}</span> : null}
                        <span>Risk: {session.risk || "—"}</span>
                        <span>Emotion: {session.emotion || "—"}</span>
                        {session.should_take_trade && (
                          <span className="capitalize">Take: {session.should_take_trade}</span>
                        )}
                      </div>

                      <p className="text-[11px] leading-relaxed text-muted-foreground/80">
                        {session.plan_summary}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col gap-2 sm:min-w-[160px]">
                      {session.status === "in_progress" ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 border-cyan-glow/20 bg-cyan-glow/[0.04] text-cyan-glow hover:bg-cyan-glow/[0.08]"
                          onClick={() => onContinueCoach(session.id)}
                        >
                          {isTradingView ? "Open Coach" : "Continue Coach"}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 border-cyan-glow/20 bg-cyan-glow/[0.04] text-cyan-glow hover:bg-cyan-glow/[0.08]"
                          onClick={() => onConvertToTrade(session.id)}
                        >
                          Log Completed Trade
                          <ArrowRight className="ml-2 size-4" />
                        </Button>
                      )}

                      {session.status === "completed" && (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 border-white/[0.08]"
                          onClick={() => onContinueCoach(session.id)}
                        >
                          Review Plan
                        </Button>
                      )}

                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 border-loss/20 text-loss/80 hover:bg-loss/[0.08] hover:text-loss"
                        disabled={deletingSessionId === session.id}
                        onClick={() => onDeletePlanned(session.id)}
                      >
                        {deletingSessionId === session.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="mr-2 size-3.5" />
                            Delete
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </DashboardCardBody>
    </DashboardCard>
  )
}
