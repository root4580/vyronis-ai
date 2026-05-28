"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { AiMessageThread } from "@/components/command-center/ai-message-thread"
import { CommandCenterInput } from "@/components/command-center/command-center-input"
import { useAIContext } from "@/providers/ai-context-provider"
import { cn } from "@/lib/utils"

export function CompanionMode() {
  const {
    context,
    isLoading,
    isSending,
    isThinking,
    thinkingPhases,
    streamingMessage,
    clearStreamingMessage,
    error,
    sendMessage,
    openPreTradeCoach,
  } = useAIContext()

  const [plansExpanded, setPlansExpanded] = useState(false)
  const plannedCount = context?.plannedSessions.length ?? 0

  if (!context && isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-12">
        <div className="command-center-typing flex gap-1">
          <span />
          <span />
          <span />
        </div>
      </div>
    )
  }

  if (!context) return null

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <AiMessageThread
        messages={context.messages}
        isThinking={isThinking}
        thinkingPhases={thinkingPhases}
        streamingMessage={streamingMessage}
        onStreamComplete={clearStreamingMessage}
        className="min-h-[280px] flex-1"
      />

      {plannedCount > 0 ? (
        <div className="shrink-0 border-t border-white/[0.05] pt-2">
          <button
            type="button"
            onClick={() => setPlansExpanded((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[11px] text-muted-foreground/75 transition-colors hover:bg-white/[0.03] hover:text-foreground/85"
          >
            <span>
              {plannedCount} planned setup{plannedCount === 1 ? "" : "s"} in memory
            </span>
            {plansExpanded ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
          </button>
          {plansExpanded ? (
            <div className="mt-1 space-y-1 px-1">
              {context.plannedSessions.slice(0, 4).map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => void openPreTradeCoach({ sessionId: session.id })}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-left transition-colors hover:border-cyan-glow/20 hover:bg-cyan-glow/[0.04]",
                  )}
                >
                  <span className="text-[11px] text-foreground/88">
                    {session.pair} {session.direction}
                  </span>
                  {session.confidence_score != null ? (
                    <span className="text-[10px] tabular-nums text-cyan-glow/75">
                      {session.confidence_score}%
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="shrink-0 rounded-lg border border-amber-500/25 bg-amber-500/[0.08] px-3 py-2 text-[11px] text-amber-200/90">
          {error}
        </p>
      ) : null}

      <CommandCenterInput
        onSend={sendMessage}
        disabled={isLoading || isThinking || Boolean(streamingMessage)}
        placeholder="Talk to Vyronis — setups, emotions, journal…"
      />
    </div>
  )
}
