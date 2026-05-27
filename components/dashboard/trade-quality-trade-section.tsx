"use client"

import { useEffect, useState } from "react"
import { Brain, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import { fetchCoachFeedback, fetchLinkedCoachSession } from "@/lib/trade-coach/api-client"
import type { TradeCoachSessionRecord, TradeQualityResult } from "@/lib/trade-coach/types"
import { resolveTradeQualityFromSession } from "@/lib/trade-coach/trade-quality-utils"
import { cn } from "@/lib/utils"

type TradeQualityTradeSectionProps = {
  tradeId: string
  tradeResult: string
  refreshKey?: number
}

function getQualityFromSession(session: TradeCoachSessionRecord): TradeQualityResult | null {
  return resolveTradeQualityFromSession(session)
}

export function TradeQualityTradeSection({
  tradeId,
  tradeResult,
  refreshKey = 0,
}: TradeQualityTradeSectionProps) {
  const [session, setSession] = useState<TradeCoachSessionRecord | null>(null)
  const [disciplineScore, setDisciplineScore] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      try {
        const [linkedSession, feedback] = await Promise.all([
          fetchLinkedCoachSession(tradeId).catch(() => null),
          fetchCoachFeedback(tradeId).catch(() => null),
        ])
        if (cancelled) return
        setSession(linkedSession)
        setDisciplineScore(feedback?.discipline_score ?? null)
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
      <DashboardInsetPanel className="flex min-h-[88px] items-center justify-center border-cyan-glow/15 bg-cyan-glow/[0.03]">
        <Loader2 className="size-4 animate-spin text-cyan-glow" />
      </DashboardInsetPanel>
    )
  }

  const quality = session ? getQualityFromSession(session) : null
  if (!quality) return null

  const predictedLowQuality = quality.score < 50
  const actualLoss = tradeResult === "LOSS"
  const predictionMatched =
    (predictedLowQuality && actualLoss) || (!predictedLowQuality && tradeResult === "WIN")

  return (
    <DashboardInsetPanel className="space-y-3 border-cyan-glow/15 bg-cyan-glow/[0.03]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Brain className="size-4 text-cyan-glow" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">Trade Quality</p>
            <p className="text-[10px] text-muted-foreground/70">Planned quality vs actual discipline</p>
          </div>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "h-6 text-[10px] font-semibold",
            quality.grade === "A" || quality.grade === "B"
              ? "border-profit/25 text-profit"
              : quality.grade === "C"
                ? "border-amber-500/25 text-amber-400"
                : "border-loss/25 text-loss",
          )}
        >
          {quality.grade} · {quality.score}/100
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="rounded-lg border border-white/[0.06] bg-black/15 px-2.5 py-2">
          <p className="text-muted-foreground/65">Planned Quality</p>
          <p className="mt-0.5 font-semibold tabular-nums text-cyan-glow">{quality.score}</p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-black/15 px-2.5 py-2">
          <p className="text-muted-foreground/65">Actual Discipline</p>
          <p className="mt-0.5 font-semibold tabular-nums text-foreground/90">
            {disciplineScore ?? "—"}
          </p>
        </div>
      </div>

      {disciplineScore !== null && (
        <Progress value={disciplineScore} className="h-2 bg-white/[0.06]" />
      )}

      <p className="text-[11px] leading-relaxed text-muted-foreground/80">
        Did low score predict outcome?{" "}
        <span className={predictionMatched ? "text-profit" : "text-amber-400"}>
          {quality.score < 50
            ? predictionMatched
              ? "Yes — low quality aligned with a loss."
              : "Mixed — low quality did not match the final result."
            : predictionMatched
              ? "Quality score aligned with a disciplined win."
              : "Outcome diverged from the pre-trade quality read."}
        </span>
      </p>
    </DashboardInsetPanel>
  )
}
