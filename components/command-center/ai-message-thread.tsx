"use client"

import { useEffect, useMemo, useRef } from "react"
import type { CommandCenterMessageRecord } from "@/lib/command-center/types"
import type { CompanionConversationalState } from "@/lib/intelligence/conversational-types"
import { COMPANION_STATE_LABELS } from "@/lib/intelligence/conversational-types"
import { StreamingText } from "@/components/command-center/streaming-text"
import { CompanionThinkingIndicator } from "@/components/command-center/companion-thinking-indicator"
import { cn } from "@/lib/utils"

type AiMessageThreadProps = {
  messages: CommandCenterMessageRecord[]
  isThinking?: boolean
  thinkingPhases?: string[]
  streamingMessage?: CommandCenterMessageRecord | null
  onStreamComplete?: () => void
  className?: string
}

type MessageGroup = {
  role: "user" | "assistant" | "system"
  messages: CommandCenterMessageRecord[]
}

function groupMessages(messages: CommandCenterMessageRecord[]): MessageGroup[] {
  const groups: MessageGroup[] = []
  for (const message of messages) {
    const role =
      message.role === "system" || message.message_type === "system"
        ? "system"
        : message.role === "user"
          ? "user"
          : "assistant"
    const last = groups[groups.length - 1]
    if (last && last.role === role && role !== "system") {
      last.messages.push(message)
    } else {
      groups.push({ role, messages: [message] })
    }
  }
  return groups
}

function stateFromPayload(payload: Record<string, unknown>): CompanionConversationalState | null {
  const state = payload.companionState
  if (
    state === "calm" ||
    state === "analytical" ||
    state === "warning" ||
    state === "protective" ||
    state === "confident" ||
    state === "reflective"
  ) {
    return state
  }
  return null
}

const stateBubbleStyles: Record<CompanionConversationalState, string> = {
  calm: "border-white/[0.07] bg-white/[0.04]",
  analytical: "border-cyan-glow/15 bg-cyan-glow/[0.05]",
  warning: "border-amber-500/20 bg-amber-500/[0.06]",
  protective: "border-loss/25 bg-loss/[0.08]",
  confident: "border-profit/20 bg-profit/[0.06]",
  reflective: "border-violet-400/20 bg-violet-400/[0.06]",
}

function AssistantBubble({
  message,
  stream = false,
  onStreamComplete,
}: {
  message: CommandCenterMessageRecord
  stream?: boolean
  onStreamComplete?: () => void
}) {
  const state = stateFromPayload(message.payload)
  const isCritical = Boolean(message.payload.isCriticalHighlight) || message.message_type === "warning"

  return (
    <div
      className={cn(
        "max-w-[92%] rounded-2xl rounded-tl-md border px-3.5 py-2.5 text-[13px] leading-[1.55]",
        isCritical
          ? "border-loss/30 bg-loss/[0.08] text-foreground/92"
          : state
            ? stateBubbleStyles[state]
            : "border-white/[0.07] bg-black/25 text-foreground/88",
      )}
    >
      {state && !isCritical ? (
        <p className="mb-1.5 text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground/60">
          {COMPANION_STATE_LABELS[state]}
        </p>
      ) : null}
      {stream ? (
        <StreamingText text={message.content} active onComplete={onStreamComplete} />
      ) : (
        <p className="whitespace-pre-wrap">{message.content}</p>
      )}
    </div>
  )
}

function UserBubble({ message }: { message: CommandCenterMessageRecord }) {
  return (
    <div className="max-w-[88%] rounded-2xl rounded-tr-md border border-white/[0.08] bg-white/[0.07] px-3.5 py-2.5 text-[13px] leading-[1.55] text-foreground/92">
      <p className="whitespace-pre-wrap">{message.content}</p>
    </div>
  )
}

export function AiMessageThread({
  messages,
  isThinking,
  thinkingPhases = [],
  streamingMessage,
  onStreamComplete,
  className,
}: AiMessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const displayMessages = useMemo(
    () =>
      streamingMessage
        ? messages.filter((m) => m.id !== streamingMessage.id)
        : messages,
    [messages, streamingMessage],
  )
  const groups = useMemo(() => groupMessages(displayMessages), [displayMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length, isThinking, streamingMessage?.id])

  return (
    <div className={cn("companion-terminal-thread flex min-h-0 flex-1 flex-col", className)}>
      <div className="companion-terminal-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-1 py-1">
        {groups.map((group, groupIndex) => {
          if (group.role === "system") {
            return group.messages.map((message) => (
              <div key={message.id} className="flex justify-center py-0.5">
                <span className="text-[10px] text-muted-foreground/55">{message.content}</span>
              </div>
            ))
          }

          return (
            <div
              key={`${group.role}-${groupIndex}`}
              className={cn(
                "flex flex-col gap-1.5",
                group.role === "user" ? "items-end" : "items-start",
              )}
            >
              {group.messages.map((message) =>
                group.role === "user" ? (
                  <UserBubble key={message.id} message={message} />
                ) : (
                  <AssistantBubble key={message.id} message={message} />
                ),
              )}
            </div>
          )
        })}

        {isThinking ? (
          <CompanionThinkingIndicator phases={thinkingPhases} />
        ) : null}

        {streamingMessage ? (
          <div className="flex flex-col items-start gap-1.5">
            <AssistantBubble
              message={streamingMessage}
              stream
              onStreamComplete={onStreamComplete}
            />
          </div>
        ) : null}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
