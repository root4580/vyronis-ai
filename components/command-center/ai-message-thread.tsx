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
import { MessageHistoryToggle } from "@/components/ui/message-history-toggle"
import {
  filterMessagesForStreaming,
  partitionCompanionMessages,
} from "@/lib/command-center/message-display"
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
  warning: "border-warning/20 bg-warning/[0.06]",
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
        "grid-cols-1 sm:grid-cols-2",
      )}
    >
      {urls.map((url, index) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${url}-${index}`}
          src={url}
          alt={`Chart ${index + 1}`}
          className="max-h-40 w-full rounded-lg border border-white/[0.08] object-cover sm:max-h-32 sm:h-20"
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
        rec === "CAUTION" && "border-warning/30 bg-warning/10 text-warning-muted",
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
                  item.status === "warn" && "text-warning-muted/90",
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
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const { narrative, footer } = splitChartReviewContent(content)
  const footerParts = footer ? splitChartReviewFooter(footer) : null
  const trimmedNarrative = narrative.trim()
  const collapseNarrative =
    Boolean(verdictReasoning) && trimmedNarrative.length > 120 && !analysisOpen

  return (
    <div className="space-y-2">
      {verdictReasoning ? (
        <VerdictReasoningPanel reasoning={verdictReasoning} />
      ) : null}
      {trimmedNarrative ? (
        <div className="rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-2">
          {stream ? (
            <StreamingText text={trimmedNarrative} active onComplete={onStreamComplete} />
          ) : (
            <p
              className={cn(
                "whitespace-pre-wrap text-[12px] leading-[1.5] text-foreground/82",
                collapseNarrative && "line-clamp-2",
              )}
            >
              {trimmedNarrative}
            </p>
          )}
          {collapseNarrative ? (
            <button
              type="button"
              onClick={() => setAnalysisOpen(true)}
              className="mt-1.5 text-[10px] font-medium text-cyan-glow/80 hover:text-cyan-glow"
            >
              Read chart notes
            </button>
          ) : null}
        </div>
      ) : null}
      {footerParts?.summary && !verdictReasoning ? (
        <div className="rounded-lg border border-white/[0.07] bg-black/25 px-2.5 py-2 text-[11px] leading-[1.45] text-foreground/78">
          <p className="line-clamp-3 whitespace-pre-wrap">{footerParts.summary}</p>
        </div>
      ) : null}
      {!verdictReasoning && footerParts?.reasoning ? (
        <div className="rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-2 text-[10px] leading-[1.45] text-foreground/72">
          <p className="line-clamp-4 whitespace-pre-wrap">{footerParts.reasoning}</p>
        </div>
      ) : null}
    </div>
  )
}

function CompactAssistantText({
  content,
  stream,
  onStreamComplete,
}: {
  content: string
  stream?: boolean
  onStreamComplete?: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const long = content.trim().length > 280

  if (stream) {
    return (
      <StreamingText text={content} active onComplete={onStreamComplete} />
    )
  }

  return (
    <>
      <p
        className={cn(
          "break-words whitespace-pre-wrap leading-[1.55] [overflow-wrap:anywhere]",
          long && !expanded && "line-clamp-4",
        )}
      >
        {content}
      </p>
      {long && !expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-1.5 text-[10px] font-medium text-cyan-glow/80 hover:text-cyan-glow"
        >
          Read more
        </button>
      ) : null}
    </>
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
        "min-w-0 w-fit max-w-[85%] break-words rounded-[var(--radius-md)] rounded-tl-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-2.5 text-[13px] leading-[1.6] text-text-secondary sm:max-w-[85%]",
        "[overflow-wrap:anywhere]",
        isCritical
          ? "border-[var(--color-loss)]/30 bg-[rgb(from_var(--color-loss)_r_g_b_/_0.08)] text-text-primary"
          : state
            ? stateBubbleStyles[state]
            : message.message_type === "analysis"
              ? "border-[var(--color-accent-border)] bg-[var(--color-accent-bg)]"
              : "",
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
      ) : (
        <CompactAssistantText
          content={message.content}
          stream={stream}
          onStreamComplete={onStreamComplete}
        />
      )}
      <MessageImageGrid urls={imageUrls} />
      {decision && !verdictReasoning ? <DecisionBadge decision={decision} /> : null}
      <VisionChecklist items={checklist} />
    </div>
  )
}

function UserBubble({ message }: { message: CommandCenterMessageRecord }) {
  const imageUrls = resolveMessageImageUrls(message.payload)

  return (
    <div className="ml-auto min-w-0 w-fit max-w-[85%] break-words rounded-[var(--radius-md)] rounded-tr-[var(--radius-sm)] border border-[var(--color-accent-border)] bg-[var(--color-accent-bg)] px-3 py-2.5 text-[13px] leading-[1.6] text-text-primary sm:max-w-[85%] [overflow-wrap:anywhere]">
      {message.content ? (
        <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.content}</p>
      ) : null}
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
    () => filterMessagesForStreaming(messages, streamingMessage),
    [messages, streamingMessage],
  )
  const { visible: visibleMessages, history: historyMessages } = useMemo(
    () => partitionCompanionMessages(displayMessages),
    [displayMessages],
  )
  const groups = useMemo(() => groupMessages(visibleMessages), [visibleMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length, isThinking, streamingMessage?.id])

  return (
    <div className={cn("companion-terminal-thread flex min-h-0 min-w-0 flex-1 flex-col", className)}>
      <div className="companion-terminal-scroll min-h-0 min-w-0 flex-1 space-y-2.5 overflow-x-hidden overflow-y-auto px-0 py-1 sm:space-y-3">
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
                "flex w-full min-w-0 max-w-full flex-col gap-1.5",
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

        <MessageHistoryToggle count={historyMessages.length} label="analyses">
          {historyMessages.map((message) => (
            <div key={message.id} className="flex justify-start">
              <AssistantBubble message={message} />
            </div>
          ))}
        </MessageHistoryToggle>

        {streamingMessage ? (
          <div className="flex w-full min-w-0 max-w-full flex-col items-start gap-1.5">
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
