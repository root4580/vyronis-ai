"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { VyronisScoreResultPanel } from "@/components/dashboard/vyronis-score-result-panel"
import type { VyronisJournalEvaluationRecord } from "@/lib/strategy/vyronis-journal-bridge"
import { VYRONIS_JOURNAL_INTELLIGENCE } from "@/types/vyronis-branding"

type VyronisScoreResultModalProps = {
  open: boolean
  evaluation: VyronisJournalEvaluationRecord | null
  pairLabel?: string
  onClose: () => void
}

export function VyronisScoreResultModal({
  open,
  evaluation,
  pairLabel,
  onClose,
}: VyronisScoreResultModalProps) {
  if (!open || !evaluation) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        className="glass-card relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vyronis-score-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-4 sm:px-5">
          <div>
            <h2 id="vyronis-score-title" className="text-base font-semibold text-foreground">
              {VYRONIS_JOURNAL_INTELLIGENCE}
            </h2>
            <p className="text-[11px] text-muted-foreground/75">
              {pairLabel ? `${pairLabel} · ` : ""}Vyronis strategy scoring saved to your journal
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-transparent p-2 hover:border-white/[0.08] hover:bg-white/[0.04]"
          >
            <X className="size-5 text-muted-foreground" />
          </button>
        </div>

        <div className="mobile-safe-scroll flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <VyronisScoreResultPanel evaluation={evaluation} />
        </div>

        <div className="border-t border-white/[0.06] px-4 py-3 sm:px-5">
          <Button
            type="button"
            onClick={onClose}
            className="h-11 w-full bg-gradient-to-r from-cyan-glow to-profit font-semibold text-background"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}
