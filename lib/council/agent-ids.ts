import type { CouncilAgentId } from "@/lib/council/types"

export const COUNCIL_AGENT_IDS: CouncilAgentId[] = [
  "jarvis",
  "nova",
  "rex",
  "luna",
  "cipher",
  "zara",
  "marcus",
]

const LEGACY_AGENT_IDS: Record<string, CouncilAgentId> = {
  sarah: "nova",
  scott: "rex",
  hamza: "luna",
  antoni: "luna",
  kai: "luna",
  zoe: "luna",
  khalid: "cipher",
  finn: "cipher",
  adam: "zara",
  lex: "zara",
  max: "jarvis",
  jarvis: "jarvis",
  cole: "rex",
  rex: "rex",
  omar: "marcus",
  marcus: "marcus",
}

/** Legacy display names and aliases still accepted in voice/text routing. */
export const COUNCIL_AGENT_NAME_ALIASES: Record<CouncilAgentId, string[]> = {
  jarvis: ["Max", "Jarvis", "JARVIS"],
  nova: ["Nova", "Sarah"],
  rex: ["Cole", "Rex", "Scott"],
  luna: ["Kai", "Zoe", "Antoni", "Luna", "Hamza", "Layla"],
  cipher: ["Finn", "Cipher", "Khalid"],
  zara: ["Lex", "Adam", "Zara", "Emma"],
  marcus: ["Omar", "Marcus", "Coach Omar", "Coach Marcus"],
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
  jarvis: "jarvis",
  nova: "sarah",
  zara: "adam",
  rex: "scott",
  luna: "hamza",
  cipher: "khalid",
  marcus: "marcus",
}

export const LEGACY_COUNCIL_SETTINGS_VOICE_KEYS: Record<CouncilAgentId, string> = {
  jarvis: "jarvis_voice_id",
  nova: "sarah_voice_id",
  zara: "adam_voice_id",
  rex: "scott_voice_id",
  luna: "hamza_voice_id",
  cipher: "khalid_voice_id",
  marcus: "marcus_voice_id",
}

const LEGACY_DISPLAY_NAMES: Record<string, string> = {
  Sarah: "Nova",
  Scott: "Cole",
  Hamza: "Kai",
  Khalid: "Finn",
  Adam: "Lex",
  Emma: "Lex",
  Layla: "Kai",
  Luna: "Kai",
  Zara: "Lex",
  Antoni: "Kai",
  Zoe: "Kai",
  Jarvis: "Max",
  JARVIS: "Max",
  Rex: "Cole",
  Cipher: "Finn",
  Marcus: "Omar",
}

export function normalizeCouncilDisplayName(name: string): string {
  return LEGACY_DISPLAY_NAMES[name] ?? name
}
