"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import type { CommandCenterMessageRecord } from "@/lib/command-center/types"
import {
  splitChartReviewContent,
  splitChartReviewFooter,
} from "@/lib/intelligence/chart-review-format"
import type { VerdictReasoning } from "@/lib/intelligence/verdict-reasoning-engine"
import type { CompanionConversationalState } from "@/lib/intelligence/conversational-types"
import { COMPANION_STATE_LABELS } from "@/lib/intelligence/conversational-types"
import { StreamingText } from "@/components/command-center/streaming-text"
import { CompanionThinkingIndicator } from "@/components/command-center/companion-thinking-indicator"
import { SessionGuardVerdictCard } from "@/components/command-center/session-guard-verdict-card"
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

type VisionChecklistItem = {
  label: string
  value: string
  status: "good" | "warn" | "neutral"
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

function MessageImage({ url, alt }: { url: string; alt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      className="mt-2 max-h-40 max-w-full rounded-lg border border-white/[0.08] object-contain"
    />
  )
}

function MessageImageGrid({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null
  if (urls.length === 1) {
    return <MessageImage url={urls[0]} alt="Uploaded chart" />
  }
  return (
    <div
      className={cn(
        "mt-2 grid gap-1.5",
        urls.length === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3",
      )}
    >
      {urls.map((url, index) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${url}-${index}`}
          src={url}
          alt={`Chart ${index + 1}`}
          className="h-20 w-full rounded-lg border border-white/[0.08] object-cover"
        />
      ))}
    </div>
  )
}

function resolveMessageImageUrls(payload: Record<string, unknown>): string[] {
  const multi = Array.isArray(payload.imageUrls)
    ? payload.imageUrls.filter((url): url is string => typeof url === "string" && Boolean(url))
    : []
  if (multi.length > 0) return multi
  const single = typeof payload.imageUrl === "string" ? payload.imageUrl : null
  return single ? [single] : []
}

type TradeDecisionPayload = {
  recommendation?: "TAKE" | "CAUTION" | "SKIP"
  confidence?: number
  weightedConfidence?: {
    verdictReasoning?: VerdictReasoning
  }
}

function DecisionBadge({ decision }: { decision: TradeDecisionPayload }) {
  if (!decision.recommendation) return null
  const rec = decision.recommendation
  return (
    <div
      className={cn(
        "mt-2 inline-flex items-center gap-2 rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]",
        rec === "TAKE" && "border-profit/30 bg-profit/10 text-profit",
        rec === "CAUTION" && "border-amber-500/30 bg-amber-500/10 text-amber-200",
        rec === "SKIP" && "border-loss/30 bg-loss/10 text-loss",
      )}
    >
      {rec}
      {typeof decision.confidence === "number" ? (
        <span className="font-normal tabular-nums text-muted-foreground/80">
          {decision.confidence}%
        </span>
      ) : null}
    </div>
  )
}

function VisionChecklist({ items }: { items: VisionChecklistItem[] }) {
  const [open, setOpen] = useState(false)
  if (items.length === 0) return null
  return (
    <div className="mt-2 rounded-lg border border-white/[0.06] bg-black/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-2.5 py-2 text-left text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground/65 hover:text-foreground/80"
      >
        Deep analysis
        {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
      </button>
      {open ? (
        <div className="space-y-1 border-t border-white/[0.05] px-2.5 pb-2 pt-1.5">
          {items.map((item) => (
            <div key={item.label} className="flex items-start justify-between gap-2 text-[11px]">
              <span className="text-muted-foreground/75">{item.label}</span>
              <span
                className={cn(
                  "text-right",
                  item.status === "good" && "text-profit/90",
                  item.status === "warn" && "text-amber-200/90",
                  item.status === "neutral" && "text-foreground/80",
                )}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function VerdictReasoningPanel({ reasoning }: { reasoning: VerdictReasoning }) {
  return <SessionGuardVerdictCard reasoning={reasoning} />
}

function ChartReviewBody({
  content,
  stream,
  onStreamComplete,
  verdictReasoning,
}: {
  content: string
  stream?: boolean
  onStreamComplete?: () => void
  verdictReasoning?: VerdictReasoning | null
}) {
  const { narrative, footer } = splitChartReviewContent(content)
  const footerParts = footer ? splitChartReviewFooter(footer) : null

  return (
    <div className="space-y-3">
      {stream ? (
        <StreamingText text={narrative} active onComplete={onStreamComplete} />
      ) : (
        <p className="whitespace-pre-wrap leading-[1.6] text-foreground/90">{narrative}</p>
      )}
      {footerParts?.summary ? (
        <div className="rounded-lg border border-white/[0.07] bg-black/25 px-2.5 py-2 text-[12px] leading-[1.55] text-foreground/82">
          <p className="whitespace-pre-wrap">{footerParts.summary}</p>
        </div>
      ) : null}
      {verdictReasoning ? (
        <VerdictReasoningPanel reasoning={verdictReasoning} />
      ) : footerParts?.reasoning ? (
        <div className="rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-2 text-[11px] leading-[1.5] text-foreground/78">
          <p className="whitespace-pre-wrap">{footerParts.reasoning}</p>
        </div>
      ) : null}
    </div>
  )
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
  const imageUrls = resolveMessageImageUrls(message.payload)
  const isBundle = message.payload.analysisKind === "timeframe_bundle"
  const checklist = Array.isArray(message.payload.visionChecklist)
    ? (message.payload.visionChecklist as VisionChecklistItem[])
    : []
  const decision =
    message.payload.decision && typeof message.payload.decision === "object"
      ? (message.payload.decision as TradeDecisionPayload)
      : null
  const verdictReasoning =
    decision?.weightedConfidence?.verdictReasoning ?? null

  return (
    <div
      className={cn(
        "max-w-[92%] rounded-2xl rounded-tl-md border px-3.5 py-2.5 text-[13px] leading-[1.55]",
        isCritical
          ? "border-loss/30 bg-loss/[0.08] text-foreground/92"
          : state
            ? stateBubbleStyles[state]
            : message.message_type === "analysis"
              ? "border-cyan-glow/20 bg-cyan-glow/[0.06]"
              : "border-white/[0.07] bg-black/25 text-foreground/88",
      )}
    >
      {message.message_type === "analysis" ? (
        <p className="mb-1.5 text-[9px] font-medium uppercase tracking-[0.14em] text-cyan-glow/80">
          {isBundle ? "Timeframe bundle analysis" : "Chart analysis"}
        </p>
      ) : state && !isCritical ? (
        <p className="mb-1.5 text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground/60">
          {COMPANION_STATE_LABELS[state]}
        </p>
      ) : null}
      {message.message_type === "analysis" ? (
        stream ? (
          <ChartReviewBody
            content={message.content}
            stream
            onStreamComplete={onStreamComplete}
            verdictReasoning={verdictReasoning}
          />
        ) : (
          <ChartReviewBody
            content={message.content}
            verdictReasoning={verdictReasoning}
          />
        )
      ) : stream ? (
        <StreamingText text={message.content} active onComplete={onStreamComplete} />
      ) : (
        <p className="whitespace-pre-wrap leading-[1.6]">{message.content}</p>
      )}
      <MessageImageGrid urls={imageUrls} />
      {decision ? <DecisionBadge decision={decision} /> : null}
      <VisionChecklist items={checklist} />
    </div>
  )
}

function UserBubble({ message }: { message: CommandCenterMessageRecord }) {
  const imageUrls = resolveMessageImageUrls(message.payload)

  return (
    <div className="max-w-[88%] rounded-2xl rounded-tr-md border border-white/[0.08] bg-white/[0.07] px-3.5 py-2.5 text-[13px] leading-[1.55] text-foreground/92">
      {message.content ? <p className="whitespace-pre-wrap">{message.content}</p> : null}
      <MessageImageGrid urls={imageUrls} />
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
