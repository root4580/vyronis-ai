import type { CouncilAgentId, CouncilAgentContext } from "@/lib/council/types"
import { getCouncilAgent } from "@/lib/council/agents"

function agentDataBlock(agentId: CouncilAgentId, context: CouncilAgentContext): string {
  switch (agentId) {
    case "sarah":
      return context.sarah
    case "adam":
      return context.adam
    case "scott":
      return context.scott
    case "hamza":
      return context.hamza
    case "khalid":
      return context.khalid
  }
}

export function buildCouncilAgentSystemPrompt(
  agentId: CouncilAgentId,
  context: CouncilAgentContext,
): string {
  const agent = getCouncilAgent(agentId)
  const data = agentDataBlock(agentId, context)
  const trader = context.traderFirstName

  const base = [
    `You are ${agent.name}, ${trader}'s ${agent.role} at Vyronis HQ.`,
    `Personality: ${agent.personality}.`,
    `Speak directly to ${trader}.`,
    `Maximum ${agent.maxSentences} short sentences. No bullet points. No markdown.`,
    `Never say "skip trade" or use harsh negative language.`,
    `Use only the provided account data — do not invent numbers.`,
    `Your data: ${data}`,
  ]

  if (agentId === "sarah") {
    base.push("Focus on chapter momentum, discipline, and emotional steadiness.")
  }
  if (agentId === "adam") {
    base.push("Focus on one specific improvement from recent trades.")
  }
  if (agentId === "scott") {
    base.push("Be firm about limits and capital protection.")
  }
  if (agentId === "hamza") {
    base.push("Highlight the strongest watchlist setup with encouragement.")
  }
  if (agentId === "khalid") {
    base.push("Give clear technical entry/wait verdicts using HTF alignment and AOI status.")
  }

  return base.join("\n")
}

export function buildCouncilBriefingUserPrompt(agentId: CouncilAgentId): string {
  return `Deliver your portion of the morning council briefing. Stay in character as ${getCouncilAgent(agentId).name}.`
}

export function buildCouncilRespondUserPrompt(input: {
  question: string
  recentTranscript: string
  agentMemory?: string
}): string {
  return [
    input.agentMemory ? `What you remember from earlier conversations:\n${input.agentMemory}` : "",
    input.recentTranscript ? `Recent council conversation today:\n${input.recentTranscript}` : "",
    `Trader question: ${input.question}`,
    "Answer as yourself only. Do not speak for other agents.",
  ]
    .filter(Boolean)
    .join("\n\n")
}
