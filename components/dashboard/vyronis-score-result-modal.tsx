"use client"

import { useRef, useState } from "react"
import { Share2, X } from "lucide-react"
import { toPng } from "html-to-image"
import { Button } from "@/components/ui/button"
import { VyronisScoreResultPanel } from "@/components/dashboard/vyronis-score-result-panel"
import type { VyronisJournalEvaluationRecord } from "@/lib/strategy/vyronis-journal-bridge"
import {
  buildShareCardFilename,
  formatRiskRewardLabel,
  getShareKeyInsight,
} from "@/lib/alerts/share-card"
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
  const captureRef = useRef<HTMLDivElement>(null)
  const [isSharing, setIsSharing] = useState(false)

  if (!open || !evaluation) return null

  const activeEvaluation = evaluation
  const keyInsight = getShareKeyInsight(activeEvaluation)
  const rrLabel = formatRiskRewardLabel(activeEvaluation.riskReward)

  async function handleShareResult() {
    if (!captureRef.current || isSharing) return

    setIsSharing(true)
    try {
      const dataUrl = await toPng(captureRef.current, {
        pixelRatio: 2,
        cacheBust: true,
      })

      const link = document.createElement("a")
      link.download = buildShareCardFilename(pairLabel, activeEvaluation.grade)
      link.href = dataUrl
      link.click()
    } catch (error) {
      console.error("Share card export failed:", error)
    } finally {
      setIsSharing(false)
    }
  }

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
          <VyronisScoreResultPanel evaluation={activeEvaluation} />
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleShareResult()}
            disabled={isSharing}
            className="mt-3 h-10 w-full border-cyan-glow/25 bg-cyan-glow/[0.04] text-cyan-glow hover:bg-cyan-glow/[0.08]"
          >
            <Share2 className="mr-2 size-4" />
            {isSharing ? "Generating PNG…" : "Share result"}
          </Button>
        </div>

        <div className="border-t border-white/[0.06] px-4 py-3 sm:px-5">
          <Button
            type="button"
            onClick={onClose}
            className="h-11 w-full btn-primary"
          >
            Done
          </Button>
        </div>
      </div>

      <div
        ref={captureRef}
        aria-hidden
        className="pointer-events-none fixed left-[-9999px] top-0 w-[420px] overflow-hidden rounded-2xl border border-accent/30 bg-surface-modal p-6 text-white"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-300/90">
          Vyronis · Strategy score
        </p>
        <p className="mt-3 text-2xl font-bold tracking-tight">{pairLabel || "Trade"}</p>
        <div className="mt-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Grade</p>
            <p className="text-3xl font-bold text-cyan-300">{activeEvaluation.grade}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Risk reward</p>
            <p className="text-xl font-semibold text-slate-100">{rrLabel}</p>
          </div>
        </div>
        <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-200/80">
            Key insight
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-200">{keyInsight}</p>
        </div>
        <p className="mt-4 text-[10px] text-slate-500">vyronis.ai · journal intelligence</p>
      </div>
    </div>
  )
}
