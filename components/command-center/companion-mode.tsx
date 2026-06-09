"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { CompanionContextStrip } from "@/components/command-center/companion-context-strip"
import { CompanionMoodCheckIn } from "@/components/command-center/companion-mood-check-in"
import { AiMessageThread } from "@/components/command-center/ai-message-thread"
import { CommandCenterInput } from "@/components/command-center/command-center-input"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import { threadHasLegacyChartVerdict } from "@/lib/command-center/mood-gate"
import { useAIContext } from "@/providers/ai-context-provider"
import { cn } from "@/lib/utils"

const GENERIC_PROMPTS = [
  "How's my session looking?",
  "Review my last trade",
  "What should I focus on today?",
]

function buildQuickPrompts(pair?: string | null, direction?: string | null): string[] {
  if (pair) {
    const dir = direction ? ` ${direction}` : ""
    return [
      `Is this ${pair}${dir} setup valid?`,
      `What could invalidate ${pair}?`,
      "Check my plan against War Room bias",
      ...GENERIC_PROMPTS.slice(0, 2),
    ]
  }
  return GENERIC_PROMPTS
}

export function CompanionMode() {
  const {
    isOpen,
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
    viewingArchivedSession,
    startNewSession,
    coachPlannedContext,
    sessionMoodComplete,
    saveSessionMood,
  } = useAIContext()

  const [plansExpanded, setPlansExpanded] = useState(false)
  const plannedCount = context?.plannedSessions.length ?? 0
  const quickPrompts = useMemo(
    () => buildQuickPrompts(coachPlannedContext.pair, coachPlannedContext.direction),
    [coachPlannedContext.direction, coachPlannedContext.pair],
  )
  const showQuickPrompts =
    !viewingArchivedSession &&
    (context?.messages.length ?? 0) === 0 &&
    !isThinking &&
    !streamingMessage
  const legacyChartVerdict = useMemo(
    () => (context ? threadHasLegacyChartVerdict(context.messages) : false),
    [context],
  )
  const showMoodCheckIn =
    !viewingArchivedSession && (!sessionMoodComplete || legacyChartVerdict)

  if (!context && (isLoading || isOpen)) {
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
    <div className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col gap-1.5 sm:gap-2">
      {viewingArchivedSession ? (
        <div className="flex shrink-0 items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-2">
          <p className="min-w-0 truncate text-[11px] text-muted-foreground/85">
            Viewing past session
            {context.sessionTitle ? ` · ${context.sessionTitle}` : ""}
          </p>
          <button
            type="button"
            onClick={() => void startNewSession()}
            className="shrink-0 text-[10px] font-medium text-cyan-glow/90 hover:text-cyan-glow"
          >
            New session
          </button>
        </div>
      ) : (
        <>
          {legacyChartVerdict ? (
            <DashboardInsetPanel className="border-warning/30 bg-warning/[0.08] px-3 py-2.5">
              <p className="text-[11px] font-medium text-warning-foreground">
                Outdated trader score in this thread
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/80">
                The SKIP / STATE read used journal history — not how you feel today. Save your mood
                below, then re-upload charts for a fresh verdict.
              </p>
            </DashboardInsetPanel>
          ) : null}
          <CompanionContextStrip
            context={{
              cognitive: context.cognitive,
              tradingOs: context.tradingOs,
              adaptiveCognition: context.adaptiveCognition,
              vyronisCore: context.vyronisCore,
              autonomous: context.autonomous,
              freshWarnings: context.freshWarnings,
              snapshot: context.snapshot,
            }}
          />
        </>
      )}
      <AiMessageThread
        messages={context.messages}
        isThinking={isThinking}
        thinkingPhases={thinkingPhases}
        streamingMessage={streamingMessage}
        onStreamComplete={clearStreamingMessage}
        sessionMoodComplete={sessionMoodComplete}
        className="min-h-0 flex-1"
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
        <p className="shrink-0 rounded-[var(--radius-md)] border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-[11px] text-[var(--warning-muted)]">
          {error}
        </p>
      ) : null}

      <div className="command-center-compose-footer shrink-0">
        {showMoodCheckIn ? (
          <div className="mb-2">
            <CompanionMoodCheckIn onSubmit={saveSessionMood} compact />
          </div>
        ) : null}
        {showQuickPrompts ? (
          <div className="mb-2 flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => void sendMessage({ content: prompt })}
                className="command-center-quick-prompt"
              >
                {prompt}
              </button>
            ))}
          </div>
        ) : null}
        <CommandCenterInput
          onSend={sendMessage}
          disabled={
            viewingArchivedSession ||
            isLoading ||
            isThinking ||
            Boolean(streamingMessage)
          }
          placeholder={
            viewingArchivedSession
              ? "Past session — start a new session to chat"
              : "Ask Coach…"
          }
        />
      </div>
    </div>
  )
}
