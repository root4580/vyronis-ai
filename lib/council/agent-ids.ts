import type { CouncilAgentId } from "@/lib/council/types"

export const COUNCIL_AGENT_IDS: CouncilAgentId[] = ["nova", "rex", "luna", "cipher", "zara"]

const LEGACY_AGENT_IDS: Record<string, CouncilAgentId> = {
  sarah: "nova",
  scott: "rex",
  hamza: "luna",
  khalid: "cipher",
  adam: "zara",
}

/** Legacy display names and aliases still accepted in voice/text routing. */
export const COUNCIL_AGENT_NAME_ALIASES: Record<CouncilAgentId, string[]> = {
  nova: ["Nova", "Sarah"],
  rex: ["Rex", "Scott"],
  luna: ["Luna", "Hamza", "Layla"],
  cipher: ["Cipher", "Khalid"],
  zara: ["Zara", "Adam", "Emma"],
}

export function isCouncilAgentId(value: string): value is CouncilAgentId {
  return COUNCIL_AGENT_IDS.includes(value as CouncilAgentId)
}

export function normalizeCouncilAgentId(value: string): CouncilAgentId | null {
  const trimmed = value.trim()
  if (isCouncilAgentId(trimmed)) return trimmed
  return LEGACY_AGENT_IDS[trimmed.toLowerCase()] ?? null
}

export function detectCouncilAgentIdByName(message: string): CouncilAgentId | null {
  const trimmed = message.trim()
  if (!trimmed) return null

  for (const agentId of COUNCIL_AGENT_IDS) {
    for (const alias of COUNCIL_AGENT_NAME_ALIASES[agentId]) {
      const pattern = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")
      if (pattern.test(trimmed)) return agentId
    }
  }

  return null
}

export const LEGACY_COUNCIL_AGENT_NAME: Record<CouncilAgentId, string> = {
  nova: "sarah",
  zara: "adam",
  rex: "scott",
  luna: "hamza",
  cipher: "khalid",
}

export const LEGACY_COUNCIL_SETTINGS_VOICE_KEYS: Record<CouncilAgentId, string> = {
  nova: "sarah_voice_id",
  zara: "adam_voice_id",
  rex: "scott_voice_id",
  luna: "hamza_voice_id",
  cipher: "khalid_voice_id",
}

const LEGACY_DISPLAY_NAMES: Record<string, string> = {
  Sarah: "Nova",
  Scott: "Rex",
  Hamza: "Luna",
  Khalid: "Cipher",
  Adam: "Zara",
  Emma: "Zara",
  Layla: "Luna",
}

export function normalizeCouncilDisplayName(name: string): string {
  return LEGACY_DISPLAY_NAMES[name] ?? name
}
