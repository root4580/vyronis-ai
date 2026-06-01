import type { CouncilAgentDefinition, CouncilAgentId } from "@/lib/council/types"

export const COUNCIL_AGENTS: CouncilAgentDefinition[] = [
  {
    id: "sarah",
    name: "Sarah",
    role: "Weekly Chapter Review",
    personality: "Warm, caring, motivating",
    maxSentences: 3,
    accentClass: "border-rose-400/30 bg-rose-500/[0.08] text-rose-100",
  },
  {
    id: "scott",
    name: "Scott",
    role: "Risk Manager",
    personality: "Firm, protective, no-nonsense",
    maxSentences: 2,
    accentClass: "border-amber-400/30 bg-amber-500/[0.08] text-amber-100",
  },
  {
    id: "hamza",
    name: "Hamza",
    role: "Setup Analyst",
    personality: "Enthusiastic, encouraging",
    maxSentences: 3,
    accentClass: "border-violet-400/30 bg-violet-500/[0.08] text-violet-100",
  },
  {
    id: "khalid",
    name: "Khalid",
    role: "Setup Confirmation",
    personality: "Sharp, precise, technical",
    maxSentences: 2,
    accentClass: "border-emerald-400/30 bg-emerald-500/[0.08] text-emerald-100",
  },
  {
    id: "adam",
    name: "Adam",
    role: "Last Trade Analyst",
    personality: "Analytical, precise, honest",
    maxSentences: 3,
    accentClass: "border-cyan-400/30 bg-cyan-500/[0.08] text-cyan-100",
  },
]

export const BRIEFING_AGENT_ORDER: CouncilAgentId[] = [
  "sarah",
  "scott",
  "hamza",
  "khalid",
  "adam",
]

export function getCouncilAgent(id: CouncilAgentId): CouncilAgentDefinition {
  return COUNCIL_AGENTS.find((agent) => agent.id === id)!
}
