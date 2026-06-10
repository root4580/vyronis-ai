"use client"

import { Brain, ShieldAlert, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { TradeRiskGuardFlag, TradeRiskGuardResult } from "@/lib/trade-risk-guard"
import { cn } from "@/lib/utils"

type TradeRiskGuardModalProps = {
  open: boolean
  result: TradeRiskGuardResult | null
  pairLabel?: string
  isSubmitting?: boolean
  onCancel: () => void
  onConfirm: () => void
}

const CATEGORY_LABELS: Record<TradeRiskGuardFlag["category"], string> = {
  emotion: "Psychology",
  risk: "Risk",
  discipline: "Discipline",
  pattern: "Pattern",
  session: "Session",
}

function severityAccent(severity: TradeRiskGuardResult["severity"]) {
  if (severity === "critical") {
    return {
      border: "border-orange-500/30",
      glow: "from-orange-500/15 via-transparent to-transparent",
      icon: "text-orange-300",
      badge: "border-orange-500/35 bg-orange-500/10 text-orange-200",
    }
  }
  return {
    border: "border-warning/25",
    glow: "from-warning/12 via-transparent to-transparent",
    icon: "text-warning-muted",
    badge: "border-warning/30 bg-warning/10 text-warning-foreground",
  }
}

export function TradeRiskGuardModal({
  open,
  result,
  pairLabel,
  isSubmitting = false,
  onCancel,
  onConfirm,
}: TradeRiskGuardModalProps) {
  if (!open || !result) return null

  const accent = severityAccent(result.severity)

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close coach check-in"
        className="dashboard-modal-backdrop"
        onClick={onCancel}
      />

      <div
        role="alertdialog"
        aria-labelledby="risk-guard-title"
        aria-describedby="risk-guard-description"
        className={cn(
          "dashboard-modal-panel relative flex max-h-[min(92vh,720px)] w-full flex-col overflow-hidden sm:max-w-lg",
          accent.border,
        )}
      >
        <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", accent.glow)} />

        <div className="relative shrink-0 border-b border-white/[0.06] px-5 py-4 md:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-cyan-glow/25 bg-cyan-glow/[0.08] shadow-[0_0_20px_rgb(from var(--color-accent) r g b / 0.12)]">
                <Brain className={cn("size-5", accent.icon)} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-glow/80">
                  Coach check-in
                </p>
                <h2 id="risk-guard-title" className="mt-0.5 text-[16px] font-semibold tracking-tight text-foreground">
                  {result.headline}
                </h2>
                {pairLabel ? (
                  <p className="mt-1 text-[11px] text-muted-foreground/70">
                    Reviewing {pairLabel} before you score this setup
                  </p>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg p-1.5 text-muted-foreground/60 transition-colors hover:bg-white/[0.06] hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 md:px-6">
          <p id="risk-guard-description" className="text-[13px] leading-relaxed text-muted-foreground/90">
            {result.coachNote}
          </p>

          <div className="space-y-2.5">
            {result.flags.map((flag) => (
              <div
                key={flag.id}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                      flag.severity === "critical"
                        ? "border-loss/30 bg-loss/[0.08] text-loss"
                        : "border-warning/25 bg-warning/[0.08] text-warning-muted",
                    )}
                  >
                    {flag.severity === "critical" ? "High" : "Watch"}
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">
                    {CATEGORY_LABELS[flag.category]}
                  </span>
                </div>
                <p className="mt-2 text-[13px] font-medium text-foreground">{flag.title}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground/85">{flag.reason}</p>
                <p className="mt-2 text-[12px] leading-relaxed text-cyan-glow/90">
                  <span className="font-medium text-cyan-glow">Coach:</span> {flag.recommendation}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative shrink-0 space-y-2 border-t border-white/[0.06] bg-black/25 px-5 py-4 backdrop-blur-md md:px-6">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            className="h-11 w-full border-white/[0.1] bg-white/[0.03] text-foreground hover:bg-white/[0.06]"
          >
            <ShieldAlert className="mr-2 size-4 text-cyan-glow" />
            Step back &amp; review
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="h-11 w-full border border-white/[0.08] bg-white/[0.05] text-[13px] font-medium text-muted-foreground hover:bg-white/[0.08] hover:text-foreground"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="size-3.5 animate-spin rounded-full border-2 border-white/20 border-t-foreground" />
                Saving trade…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Sparkles className="size-4 opacity-70" />
                I understand — log trade anyway
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
