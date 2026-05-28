"use client"

import { Brain, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AiMessageThread } from "@/components/command-center/ai-message-thread"
import { BehavioralWarningStrip } from "@/components/command-center/behavioral-warning-strip"
import { CommandCenterInput } from "@/components/command-center/command-center-input"
import { PlannedTradesMemoryFeed } from "@/components/command-center/planned-trades-memory-feed"
import { useAIContext } from "@/providers/ai-context-provider"
import { cn } from "@/lib/utils"

export function VyronisCommandCenter() {
  const {
    isOpen,
    close,
    context,
    isLoading,
    isSending,
    error,
    sendMessage,
    onContinuePlannedCoach,
    onNewPreTradeCoach,
  } = useAIContext()

  if (!isOpen) return null

  return (
    <>
      <button
        type="button"
        aria-label="Close AI Command Center"
        className="command-center-backdrop fixed inset-0 z-[55] bg-black/45 backdrop-blur-[2px]"
        onClick={close}
      />

      <aside
        className={cn(
          "command-center-panel fixed bottom-0 right-0 z-[60] flex w-full flex-col",
          "sm:bottom-4 sm:right-4 sm:max-h-[90vh] sm:w-[min(420px,calc(100vw-2rem))]",
          "rounded-t-2xl sm:rounded-2xl",
        )}
        role="dialog"
        aria-label="Vyronis AI Command Center"
      >
        <header className="command-center-header sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-white/[0.08] px-4 py-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg border border-cyan-glow/25 bg-cyan-glow/[0.1]">
                <Brain className="size-4 text-cyan-glow" />
              </div>
              <div>
                <p className="text-[13px] font-semibold tracking-tight text-foreground">
                  Vyronis Command Center
                </p>
                <p className="text-[10px] text-muted-foreground/75">
                  {context?.greeting.sessionLabel ?? "Trading companion"}
                </p>
              </div>
            </div>
            {context?.greeting ? (
              <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground/85">
                {context.greeting.headline}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={close}
            className="size-8 shrink-0 rounded-lg text-muted-foreground hover:bg-white/[0.06]"
          >
            <X className="size-4" />
          </Button>
        </header>

        <div className="command-center-body flex min-h-0 flex-1 flex-col gap-3 px-4 py-3">
          {isLoading && !context ? (
            <div className="flex flex-1 items-center justify-center py-12">
              <div className="command-center-typing flex gap-1">
                <span />
                <span />
                <span />
              </div>
            </div>
          ) : (
            <>
              {context ? (
                <>
                  <BehavioralWarningStrip warnings={context.warnings} />
                  <AiMessageThread
                    messages={context.messages}
                    isSending={isSending}
                    className="min-h-[200px]"
                  />
                  <PlannedTradesMemoryFeed
                    sessions={context.plannedSessions}
                    onContinueCoach={onContinuePlannedCoach}
                    onNewCoach={onNewPreTradeCoach}
                  />
                </>
              ) : null}

              {error ? (
                <p className="rounded-lg border border-amber-500/25 bg-amber-500/[0.08] px-3 py-2 text-[11px] text-amber-200/90">
                  {error}
                </p>
              ) : null}

              <CommandCenterInput onSend={sendMessage} disabled={isLoading} />
            </>
          )}
        </div>
      </aside>
    </>
  )
}
