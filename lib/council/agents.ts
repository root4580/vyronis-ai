import type { CouncilAgentDefinition, CouncilAgentId } from "@/lib/council/types"

export const COUNCIL_AGENTS: CouncilAgentDefinition[] = [
  {
    id: "jarvis",
    name: "Jarvis",
    role: "Master Coordinator",
    personality: "Calm, precise, British. Never emotional. Always composed.",
    maxSentences: 2,
    accentClass:
      "border-slate-400/40 bg-slate-950/90 text-slate-100 shadow-[0_0_24px_rgba(15,23,42,0.45)]",
    isCoordinator: true,
  },
  {
    id: "nova",
    name: "Nova",
    role: "Weekly Chapter Review",
    personality: "Warm, caring, motivating",
    maxSentences: 3,
    accentClass: "border-rose-400/30 bg-rose-500/[0.08] text-rose-100",
  },
  {
    id: "rex",
    name: "Rex",
    role: "Risk Manager",
    personality: "Firm, protective, no-nonsense",
    maxSentences: 2,
    accentClass: "border-amber-400/30 bg-amber-500/[0.08] text-amber-100",
  },
  {
    id: "luna",
    name: "Luna",
    role: "Setup Analyst",
    personality: "Enthusiastic, encouraging",
    maxSentences: 3,
    accentClass: "border-violet-400/30 bg-violet-500/[0.08] text-violet-100",
  },
  {
    id: "cipher",
    name: "Cipher",
    role: "Setup Confirmation",
    personality: "Sharp, precise, technical",
    maxSentences: 2,
    accentClass: "border-emerald-400/30 bg-emerald-500/[0.08] text-emerald-100",
  },
  {
    id: "zara",
    name: "Zara",
    role: "Last Trade Analyst",
    personality: "Analytical, precise, honest",
    maxSentences: 3,
    accentClass: "border-cyan-400/30 bg-cyan-500/[0.08] text-cyan-100",
  },
]

/** Specialist briefing order — Jarvis opens/closes around this sequence. */
export const BRIEFING_AGENT_ORDER: CouncilAgentId[] = [
  "nova",
  "rex",
  "luna",
  "cipher",
  "zara",
]

export const COUNCIL_SPECIALIST_IDS: CouncilAgentId[] = BRIEFING_AGENT_ORDER

export function isCouncilSpecialistAgent(agentId: CouncilAgentId): boolean {
  return agentId !== "jarvis"
}

export function getCouncilAgent(id: CouncilAgentId): CouncilAgentDefinition {
  return COUNCIL_AGENTS.find((agent) => agent.id === id)!
}
