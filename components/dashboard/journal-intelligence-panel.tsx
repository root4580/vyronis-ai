"use client"

import { useEffect, useState } from "react"
import { Brain, Loader2, Sparkles } from "lucide-react"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import { fetchJournalIntelligence } from "@/lib/learning/api-client"
import type { JournalIntelligenceResult } from "@/lib/learning/types"
import { cn } from "@/lib/utils"

type JournalIntelligencePanelProps = {
  tradeId: string
  refreshKey?: number
}

export function JournalIntelligencePanel({ tradeId, refreshKey = 0 }: JournalIntelligencePanelProps) {
  const [journal, setJournal] = useState<JournalIntelligenceResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const result = await fetchJournalIntelligence(tradeId)
        if (!cancelled) setJournal(result)
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Vyronis journal intelligence unavailable")
          setJournal(null)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [tradeId, refreshKey])

  if (isLoading) {
    return (
      <DashboardInsetPanel className="flex min-h-[72px] items-center justify-center border-cyan-glow/15 bg-cyan-glow/[0.03]">
        <Loader2 className="size-4 animate-spin text-cyan-glow" />
      </DashboardInsetPanel>
    )
  }

  if (error || !journal) return null

  const verdictClass =
    journal.verdict === "strong"
      ? "text-profit border-profit/20 bg-profit/[0.06]"
      : journal.verdict === "weak"
        ? "text-loss border-loss/20 bg-loss/[0.06]"
        : "text-cyan-glow border-cyan-glow/20 bg-cyan-glow/[0.05]"

  return (
    <DashboardInsetPanel className="space-y-3 border-cyan-glow/20 bg-cyan-glow/[0.04] px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Brain className="size-3.5 text-cyan-glow" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-glow/90">
            Vyronis Journal Intelligence
          </p>
        </div>
        <span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase", verdictClass)}>
          {journal.verdict}
        </span>
      </div>

      <p className="text-[11px] leading-relaxed text-foreground/85">{journal.summary}</p>

      {journal.detectedMistakes.length > 0 && (
        <div>
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-loss/80">Detected mistakes</p>
          <ul className="space-y-0.5 text-[10px] text-muted-foreground/80">
            {journal.detectedMistakes.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      )}

      {journal.comparisons.length > 0 && (
        <div>
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
            vs previous trades
          </p>
          <ul className="space-y-0.5 text-[10px] text-muted-foreground/80">
            {journal.comparisons.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      )}

      {journal.coachingFeedback.length > 0 && (
        <div>
          <p className="mb-1 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-cyan-glow/80">
            <Sparkles className="size-3" />
            Coaching feedback
          </p>
          <ul className="space-y-0.5 text-[10px] text-muted-foreground/80">
            {journal.coachingFeedback.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      )}
    </DashboardInsetPanel>
  )
}
