"use client"

import { getCouncilAgent } from "@/lib/council/agents"
import { findChartForMessage } from "@/lib/council/pair-chart-match"
import type { CouncilAgentId, CouncilChartSnapshot, CouncilTranscriptEntry, CouncilVisualContext } from "@/lib/council/types"
import { cn } from "@/lib/utils"

type CouncilMessageBubbleProps = {
  entry: CouncilTranscriptEntry
  visual: CouncilVisualContext | null
  inlineChart?: CouncilChartSnapshot | null
  speakingAgent: CouncilAgentId | null
  onChartClick?: (url: string, title: string) => void
}

function speakerLabel(entry: CouncilTranscriptEntry): string {
  if (entry.agent === "user") return "You"
  if (entry.agent === "system") return "Council"
  return getCouncilAgent(entry.agent).name
}

export function CouncilMessageBubble({
  entry,
  visual,
  inlineChart: inlineChartOverride,
  speakingAgent,
  onChartClick,
}: CouncilMessageBubbleProps) {
  const isUser = entry.agent === "user"
  const agent =
    entry.agent !== "user" && entry.agent !== "system" ? getCouncilAgent(entry.agent) : null
  const isSpeakingLine = speakingAgent === entry.agent
  const inlineChart =
    inlineChartOverride !== undefined
      ? inlineChartOverride
      : entry.agent !== "user" && entry.agent !== "system"
        ? findChartForMessage(entry.agent, entry.content, visual)
        : null

  return (
    <article
      className={cn(
        "rounded-[var(--radius-md)] border px-3 py-2.5 transition-shadow",
        isUser
          ? "ml-8 border-cyan-glow/20 bg-cyan-glow/[0.08] backdrop-blur-[1px]"
          : agent
            ? cn(agent.accentClass, "bg-black/20 backdrop-blur-[1px]")
            : "border-white/[0.08] bg-black/20 backdrop-blur-[1px]",
        isSpeakingLine && "shadow-[0_0_20px_rgba(34,211,238,0.15)]",
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] opacity-80">
        {speakerLabel(entry)}
        {isSpeakingLine ? " · speaking" : ""}
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-text-primary">{entry.content}</p>
      {inlineChart ? (
        <button
          type="button"
          onClick={() => onChartClick?.(inlineChart.url, inlineChart.label)}
          className="mt-2 block w-full overflow-hidden rounded-lg border border-white/[0.08] bg-black/30 text-left transition-colors hover:border-cyan-glow/25"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={inlineChart.url}
            alt={inlineChart.label}
            className="max-h-36 w-full object-cover"
          />
          <span className="block border-t border-white/[0.06] px-2 py-1 text-[10px] text-text-secondary">
            {inlineChart.label} · tap to expand
          </span>
        </button>
      ) : null}
    </article>
  )
}
