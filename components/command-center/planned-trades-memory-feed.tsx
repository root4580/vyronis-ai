"use client"

import { Brain, Radio, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { PlannedCoachSessionItem } from "@/lib/trade-coach/types"
import { cn } from "@/lib/utils"

type PlannedTradesMemoryFeedProps = {
  sessions: PlannedCoachSessionItem[]
  onContinueCoach: (sessionId: string) => void
  onNewCoach: () => void
  className?: string
}

export function PlannedTradesMemoryFeed({
  sessions,
  onContinueCoach,
  onNewCoach,
  className,
}: PlannedTradesMemoryFeedProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2 px-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/75">
          Planned trades memory
        </p>
        <span className="text-[10px] tabular-nums text-cyan-glow/80">{sessions.length}</span>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] px-3 py-4 text-center">
          <Brain className="mx-auto mb-2 size-4 text-cyan-glow/60" />
          <p className="text-[11px] text-muted-foreground/80">No setups in memory yet.</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onNewCoach}
            className="mt-2 h-8 text-[11px] text-cyan-glow hover:bg-cyan-glow/[0.08]"
          >
            Start pre-trade coach
          </Button>
        </div>
      ) : (
        <div className="command-center-feed-scroll max-h-[180px] space-y-2 overflow-y-auto pr-1">
          {sessions.slice(0, 6).map((session) => (
            <div
              key={session.id}
              className="command-center-feed-item group rounded-xl border border-white/[0.07] bg-white/[0.03] p-2.5 transition-all duration-200 hover:border-cyan-glow/20 hover:bg-cyan-glow/[0.04]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-[12px] font-semibold text-foreground">
                      {session.pair || "Setup"}{" "}
                      <span className="text-muted-foreground/80">{session.direction || ""}</span>
                    </p>
                    {session.signal_source === "tradingview" ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-cyan-glow/25 bg-cyan-glow/[0.08] px-1.5 py-0.5 text-[9px] text-cyan-glow">
                        <Radio className="size-2.5" />
                        TV
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-muted-foreground/80">
                    {session.plan_summary || session.strategy_name || "Pre-trade plan in progress"}
                  </p>
                </div>
                {session.confidence_score != null ? (
                  <span className="shrink-0 text-[10px] tabular-nums text-cyan-glow/80">
                    {session.confidence_score}%
                  </span>
                ) : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onContinueCoach(session.id)}
                className="mt-2 h-7 w-full justify-center text-[10px] text-cyan-glow hover:bg-cyan-glow/[0.1]"
              >
                <Sparkles className="mr-1.5 size-3" />
                Open pre-trade coach
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
