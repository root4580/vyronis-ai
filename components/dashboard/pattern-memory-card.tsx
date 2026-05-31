"use client"

import { useEffect, useState } from "react"
import { Brain, Loader2, Sparkles } from "lucide-react"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import { fetchPatternMemory } from "@/lib/trade-coach/api-client"
import type {
  PatternMemoryCategory,
  PatternMemoryResult,
} from "@/lib/trade-coach/pattern-memory"
import { cn } from "@/lib/utils"

type PatternMemoryCardProps = {
  tradeCount?: number
  refreshKey?: number
}

const categoryLabels: Record<PatternMemoryCategory, string> = {
  mistake: "Mistake",
  emotion: "Emotion",
  session: "Session",
  strategy: "Strategy",
  discipline: "Discipline",
  risk: "Risk",
  streak: "Streak",
  plan_gap: "Plan Gap",
  countertrend: "Countertrend",
  chart_vision: "Chart Vision",
}

export function PatternMemoryCard({ tradeCount = 0, refreshKey = 0 }: PatternMemoryCardProps) {
  const [memory, setMemory] = useState<PatternMemoryResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadPatternMemory() {
      setIsLoading(true)
      setError(null)

      try {
        const result = await fetchPatternMemory()
        if (!cancelled) setMemory(result)
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load pattern memory")
          setMemory(null)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadPatternMemory()

    return () => {
      cancelled = true
    }
  }, [tradeCount, refreshKey])

  return (
    <DashboardInsetPanel className="glass border-cyan-glow/15 bg-cyan-glow/[0.03] px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Brain className="size-3.5 text-cyan-glow" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/85">
            Pattern Memory
          </p>
        </div>
        {memory?.hasEnoughData && (
          <span className="text-[9px] tabular-nums text-muted-foreground/65">
            {memory.patterns.length} pattern{memory.patterns.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex min-h-[72px] items-center justify-center">
          <Loader2 className="size-4 animate-spin text-cyan-glow" />
        </div>
      ) : error ? (
        <p className="text-[11px] leading-relaxed text-loss/90">{error}</p>
      ) : !memory?.hasEnoughData ? (
        <div className="rounded-lg border border-dashed border-white/[0.08] bg-black/15 px-3 py-3">
          <p className="text-[11px] leading-relaxed text-muted-foreground/80">
            {memory?.emptyMessage ||
              `Log at least 3 trades to unlock Pattern Memory. You have ${tradeCount} so far.`}
          </p>
        </div>
      ) : memory.patterns.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/[0.08] bg-black/15 px-3 py-3">
          <p className="text-[11px] leading-relaxed text-muted-foreground/80">
            {memory.emptyMessage}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {memory.patterns.map((pattern) => (
            <div
              key={pattern.id}
              className={cn(
                "rounded-lg border px-2.5 py-2",
                pattern.severity === "warning"
                  ? "border-warning/20 bg-warning/[0.06]"
                  : pattern.severity === "positive"
                    ? "border-profit/20 bg-profit/[0.06]"
                    : "border-cyan-glow/15 bg-cyan-glow/[0.04]",
              )}
            >
              <div className="mb-1 flex items-center gap-2">
                <Sparkles
                  className={cn(
                    "size-3 shrink-0",
                    pattern.severity === "warning"
                      ? "text-warning-foreground"
                      : pattern.severity === "positive"
                        ? "text-profit"
                        : "text-cyan-glow",
                  )}
                />
                <span className="text-[9px] font-medium uppercase tracking-[0.1em] text-muted-foreground/70">
                  {categoryLabels[pattern.category]}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-foreground/88">{pattern.message}</p>
            </div>
          ))}
        </div>
      )}
    </DashboardInsetPanel>
  )
}
