"use client"

import { useEffect } from "react"
import { useVisualViewportCssVars } from "@/hooks/use-visual-viewport-css-vars"
import { ArrowLeft, Bot, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CompanionMode } from "@/components/command-center/companion-mode"
import { PreTradeMode } from "@/components/command-center/pre-trade-mode"
import { SessionHistoryMenu } from "@/components/command-center/session-history-menu"
import { useAIContext } from "@/providers/ai-context-provider"
import { cn } from "@/lib/utils"

export function VyronisCommandCenter() {
  const {
    isOpen,
    close,
    mode,
    isTransitioning,
    coachPlannedContext,
    returnToCompanion,
  } = useAIContext()

  useVisualViewportCssVars(isOpen)

  useEffect(() => {
    if (!isOpen || typeof document === "undefined") return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [isOpen])

  if (!isOpen) return null

  const isExpanded = mode === "pre_trade" || mode === "post_trade"
  const pairLabel = coachPlannedContext.pair
    ? coachPlannedContext.direction === "LONG"
      ? `${coachPlannedContext.pair} · Long`
      : coachPlannedContext.direction === "SHORT"
        ? `${coachPlannedContext.pair} · Short`
        : coachPlannedContext.pair
    : null

  return (
    <>
      <button
        type="button"
        aria-label="Close AI Command Center"
        className="command-center-backdrop fixed inset-0 z-[55] bg-black/25"
        onClick={close}
      />

      <aside
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "command-center-panel fixed inset-y-0 right-0 z-[60] flex w-full max-w-[100vw] min-h-0 flex-col overflow-hidden",
          isExpanded
            ? "command-center-panel-expanded sm:w-[min(640px,calc(100vw-2rem))]"
            : "sm:w-[400px]",
          isTransitioning && "command-center-panel-transitioning",
        )}
        role="dialog"
        aria-label="Vyronis HQ Command Center"
      >
        <header className="command-center-header sticky top-0 z-20 flex h-[50px] shrink-0 items-center gap-2 px-4">
          {mode !== "companion" ? (
            <button
              type="button"
              onClick={() => void returnToCompanion()}
              className="command-center-back-btn mr-1 inline-flex items-center gap-1 text-[11px] font-medium text-text-accent transition-colors hover:opacity-90"
              aria-label="Back to companion"
            >
              <ArrowLeft className="size-3.5" />
            </button>
          ) : null}

          <Bot className="size-4 shrink-0 text-text-accent" aria-hidden />
          <p className="text-[14px] font-medium text-text-primary">Coach</p>

          {pairLabel ? (
            <span className="rounded-[var(--radius-sm)] border border-[var(--color-accent-border)] bg-[var(--color-accent-bg)] px-2 py-0.5 text-[11px] text-text-accent">
              {pairLabel}
            </span>
          ) : null}

          <div className="ml-auto flex shrink-0 items-center gap-0.5">
            {mode === "companion" ? <SessionHistoryMenu /> : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={close}
              className="size-8 shrink-0 rounded-[var(--radius-sm)] text-text-muted hover:bg-white/[0.04] hover:text-text-primary"
            >
              <X className="size-4" />
            </Button>
          </div>
        </header>

        <div
          className={cn(
            "command-center-body flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-4 py-3",
            isExpanded && "px-3 sm:px-4",
          )}
        >
          <div
            key={mode}
            className={cn(
              "command-center-mode-content flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col",
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
