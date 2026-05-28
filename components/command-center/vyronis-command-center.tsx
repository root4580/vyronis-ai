"use client"

import { ArrowLeft, Brain, Eye, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CompanionMode } from "@/components/command-center/companion-mode"
import { PreTradeMode } from "@/components/command-center/pre-trade-mode"
import { SessionHistoryMenu } from "@/components/command-center/session-history-menu"
import { useAIContext } from "@/providers/ai-context-provider"
import { COMPANION_STATE_LABELS } from "@/lib/intelligence/conversational-types"
import { cn } from "@/lib/utils"

const MODE_LABELS = {
  companion: "Companion",
  pre_trade: "Pre-trade coach",
  post_trade: "Post-trade debrief",
  weekly: "Weekly review",
} as const

export function VyronisCommandCenter() {
  const {
    isOpen,
    close,
    mode,
    context,
    isTransitioning,
    coachPlannedContext,
    returnToCompanion,
  } = useAIContext()

  if (!isOpen) return null

  const isExpanded = mode === "pre_trade" || mode === "post_trade"
  const pairLabel = coachPlannedContext.pair
    ? `${coachPlannedContext.pair} ${coachPlannedContext.direction || ""}`.trim()
    : null

  return (
    <>
      <button
        type="button"
        aria-label="Close AI Command Center"
        className="command-center-backdrop fixed inset-0 z-[55] bg-black/45 backdrop-blur-[2px]"
        onClick={close}
      />

      <aside
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "command-center-panel fixed bottom-0 right-0 z-[60] flex w-full flex-col overflow-visible",
          "sm:bottom-4 sm:right-4 sm:max-h-[90vh]",
          "rounded-t-2xl sm:rounded-2xl",
          "command-center-mode-transition",
          isExpanded
            ? "command-center-panel-expanded sm:w-[min(640px,calc(100vw-2rem))]"
            : "sm:w-[min(420px,calc(100vw-2rem))]",
          isTransitioning && "command-center-panel-transitioning",
        )}
        role="dialog"
        aria-label="Vyronis AI Command Center"
      >
        <header className="command-center-header sticky top-0 z-20 flex items-start justify-between gap-3 overflow-visible border-b border-white/[0.08] px-4 py-3.5">
          <div className="min-w-0 flex-1">
            {mode !== "companion" ? (
              <button
                type="button"
                onClick={() => void returnToCompanion()}
                className="command-center-back-btn mb-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-cyan-glow/90 transition-colors hover:text-cyan-glow"
              >
                <ArrowLeft className="size-3.5" />
                Back to companion
              </button>
            ) : null}

            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg border border-cyan-glow/25 bg-cyan-glow/[0.1]">
                <Brain className="size-4 text-cyan-glow" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold tracking-tight text-foreground">
                  {mode === "companion" ? "Vyronis Command Center" : MODE_LABELS[mode]}
                </p>
                <p className="text-[10px] text-muted-foreground/75">
                  {mode === "companion"
                    ? (context?.companionState
                        ? COMPANION_STATE_LABELS[context.companionState]
                        : context?.greeting.sessionLabel ?? "Online")
                    : pairLabel || "Multi-timeframe pre-trade review"}
                </p>
              </div>
            </div>

            {mode === "pre_trade" ? (
              <div className="mt-2 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md border border-cyan-glow/25 bg-cyan-glow/[0.08] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-cyan-glow">
                  <Eye className="size-3" />
                  Vision-enabled
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            {mode === "companion" ? <SessionHistoryMenu /> : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={close}
              className="size-8 shrink-0 rounded-lg text-muted-foreground hover:bg-white/[0.06]"
            >
              <X className="size-4" />
            </Button>
          </div>
        </header>

        <div
          className={cn(
            "command-center-body flex min-h-0 flex-1 flex-col gap-3 px-4 py-3",
            isExpanded && "px-3 sm:px-4",
          )}
        >
          <div
            key={mode}
            className={cn(
              "command-center-mode-content flex min-h-0 flex-1 flex-col gap-3",
              isExpanded ? "overflow-hidden" : "",
            )}
          >
            {mode === "companion" ? <CompanionMode /> : null}
            {mode === "pre_trade" ? <PreTradeMode /> : null}
          </div>
        </div>
      </aside>
    </>
  )
}
