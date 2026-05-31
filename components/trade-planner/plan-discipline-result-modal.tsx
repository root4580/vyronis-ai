"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PlanDeviationSummary } from "@/components/trade-planner/plan-deviation-summary"
import type { PlanDisciplineResult } from "@/lib/trade-planner/deviation-engine"

type PlanDisciplineResultModalProps = {
  open: boolean
  pairLabel?: string
  result: PlanDisciplineResult | null
  tradeDetailHref?: string
  onClose: () => void
}

export function PlanDisciplineResultModal({
  open,
  pairLabel,
  result,
  tradeDetailHref,
  onClose,
}: PlanDisciplineResultModalProps) {
  if (!open || !result) return null

  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        className="glass-card relative w-full max-w-lg overflow-hidden sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-discipline-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-4 sm:px-5">
          <div>
            <h2 id="plan-discipline-title" className="text-base font-semibold text-foreground">
              Plan discipline
            </h2>
            <p className="text-[11px] text-muted-foreground/75">
              Compared to your pre-trade plan — deviations update if you edit the trade.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-transparent p-2 hover:border-white/[0.08] hover:bg-white/[0.04]"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="px-4 py-4 sm:px-5">
          <PlanDeviationSummary
            pairLabel={pairLabel ?? "Linked trade"}
            result={result}
            tradeDetailHref={tradeDetailHref}
          />
        </div>

        <div className="border-t border-white/[0.06] px-4 py-3 sm:px-5">
          <Button type="button" className="w-full" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}
