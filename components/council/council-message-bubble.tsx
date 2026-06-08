"use client"

import { Loader2, Volume2 } from "lucide-react"
import { getCouncilAgent } from "@/lib/council/agents"
import type { CouncilAgentVisualPanel } from "@/lib/council/agent-visual-panel"
import type { CouncilAgentId, CouncilTranscriptEntry, CouncilVisualContext } from "@/lib/council/types"
import { CouncilAgentVisualPanel as CouncilAgentVisualPanelView } from "@/components/council/council-agent-visual-panel"
import { cn } from "@/lib/utils"

type CouncilMessageBubbleProps = {
  entry: CouncilTranscriptEntry
  visual: CouncilVisualContext | null
  agentPanel?: CouncilAgentVisualPanel | null
  speakingAgent: CouncilAgentId | null
  voiceAvailable?: boolean
  onReplay?: () => void
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
  agentPanel,
  speakingAgent,
  voiceAvailable = false,
  onReplay,
  onChartClick,
}: CouncilMessageBubbleProps) {
  const isUser = entry.agent === "user"
  const agent =
    entry.agent !== "user" && entry.agent !== "system" ? getCouncilAgent(entry.agent) : null
  const isSpeakingLine = speakingAgent === entry.agent
  const showPanel =
    agentPanel && visual && entry.agent !== "user" && entry.agent !== "system"

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
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] opacity-80">
          {speakerLabel(entry)}
          {isSpeakingLine ? " · speaking" : ""}
        </p>
        {voiceAvailable && onReplay && !isUser && entry.agent !== "system" ? (
          <button
            type="button"
            onClick={onReplay}
            className="shrink-0 rounded-md border border-white/10 p-1 text-text-muted transition-colors hover:border-cyan-glow/30 hover:text-cyan-glow"
            aria-label={`Hear ${speakerLabel(entry)}`}
            title={`Hear ${speakerLabel(entry)}`}
          >
            {isSpeakingLine ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Volume2 className="size-3.5" />
            )}
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-text-primary">{entry.content}</p>
      {showPanel ? (
        <CouncilAgentVisualPanelView
          panel={agentPanel}
          visual={visual}
          speaking={isSpeakingLine}
          onChartClick={onChartClick}
        />
      ) : null}
    </article>
  )
}
