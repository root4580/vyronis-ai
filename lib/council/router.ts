import { COUNCIL_AGENTS, getCouncilAgent } from "@/lib/council/agents"
import { detectCouncilAgentIdByName } from "@/lib/council/agent-ids"
import { isGeneralCouncilQuestion } from "@/lib/council/jarvis-service"
import type { CouncilAgentId, CouncilTranscriptEntry } from "@/lib/council/types"

/** Direct address — "Hey Cole", "Good morning Nova", "Lex, review my trade". */
export function detectCouncilAgentByName(message: string): CouncilAgentId | null {
  return detectCouncilAgentIdByName(message)
}

/** Trader wants the current agent to bring another council member in — not switch to them directly. */
export function isCouncilDelegationRequest(message: string): boolean {
  const trimmed = message.trim()
  if (!trimmed) return false

  if (
    /\b(?:have|let|want|need) (?:him|her|them) (?:to )?(?:speak|talk|answer|respond|say)\b/i.test(
      trimmed,
    )
  ) {
    return true
  }

  if (/\b(?:him|her|them) (?:to )?(?:speak|talk|answer|respond)\b/i.test(trimmed)) {
    return true
  }

  for (const agent of COUNCIL_AGENTS) {
    const name = getCouncilAgent(agent.id).name
    const delegationPatterns = [
      new RegExp(
        `\\b(?:can you|could you|would you|will you|please|you mind) (?:ask|asking|have|let|get|tell) (?:\\w+\\s+){0,4}${name}\\b`,
        "i",
      ),
      new RegExp(`\\bask (?:\\w+\\s+){0,2}${name}\\b`, "i"),
      new RegExp(`\\b(?:have|let) ${name} (?:speak|talk|answer|respond)\\b`, "i"),
      new RegExp(`\\bbring (?:in )?${name}\\b`, "i"),
      new RegExp(`\\b(?:do that|go ahead|yes).*${name}\\b`, "i"),
    ]

    if (delegationPatterns.some((delegationPattern) => delegationPattern.test(trimmed))) {
      return true
    }
  }

  return false
}

/** Direct address to an agent — "Finn, is it valid?" not "can you ask Finn". */
export function isCouncilDirectAddress(message: string, agentId: CouncilAgentId): boolean {
  const trimmed = message.trim()
  const name = getCouncilAgent(agentId).name
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

  return new RegExp(`^${escaped}\\b|^hey ${escaped}\\b|^hi ${escaped}\\b|^good morning ${escaped}\\b`, "i").test(
    trimmed,
  )
}

/** Resolve "him/her/them" or "bring her in" to the last agent mentioned in recent transcript. */
export function resolveCouncilPronounTarget(
  message: string,
  transcript: CouncilTranscriptEntry[],
): CouncilAgentId | null {
  const trimmed = message.trim()
  if (
    !/\b(?:him|her|them)\b/i.test(trimmed) &&
    !/\b(?:bring|get) (?:her|him|them)(?: in)?\b/i.test(trimmed)
  ) {
    return null
  }

  for (let index = transcript.length - 1; index >= 0; index -= 1) {
    const mentioned = detectCouncilAgentByName(transcript[index]!.content)
    if (mentioned) return mentioned
  }

  return null
}

function isAffirmativeHandoffReply(message: string): boolean {
  const trimmed = message.trim()
  if (!trimmed) return false

  return (
    /^(?:yes|yeah|yep|yup|sure|ok|okay)(?:[,.!?\s]|$)/i.test(trimmed) ||
    /\b(?:do that|go ahead|please do|yes please|yes ma'?am)\b/i.test(trimmed) ||
    /\b(?:bring|get) (?:her|him|them)(?: in)?\b/i.test(trimmed)
  )
}

function findOfferedCouncilAgent(transcript: CouncilTranscriptEntry[]): CouncilAgentId | null {
  for (let index = transcript.length - 1; index >= 0; index -= 1) {
    const entry = transcript[index]!
    if (entry.agent === "user" || entry.agent === "system") continue

    const mentioned = detectCouncilAgentByName(entry.content)
    if (!mentioned) continue

    if (
      /\b(?:bring|get|ask|have|i'll bring|i will bring|let me bring|bring in|review your|help ensure)\b/i.test(
        entry.content,
      )
    ) {
      return mentioned
    }
  }

  return null
}

/** User said yes / do that after an agent offered to bring a colleague in. */
export function resolveCouncilAffirmativeHandoff(
  message: string,
  transcript: CouncilTranscriptEntry[],
): CouncilAgentId | null {
  if (!isAffirmativeHandoffReply(message)) return null

  const offered = findOfferedCouncilAgent(transcript)
  if (offered) return offered

  for (let index = transcript.length - 1; index >= 0; index -= 1) {
    const mentioned = detectCouncilAgentByName(transcript[index]!.content)
    if (mentioned) return mentioned
  }

  return null
}

/** Last agent who replied to the most recent user turn — ignores briefing before Q&A. */
export function getStickyCouncilAgentFromTranscript(
  transcript: CouncilTranscriptEntry[],
): CouncilAgentId | null {
  let lastUserIndex = -1
  for (let index = transcript.length - 1; index >= 0; index -= 1) {
    if (transcript[index]!.agent === "user") {
      lastUserIndex = index
      break
    }
  }

  if (lastUserIndex === -1) return null

  for (let index = transcript.length - 1; index > lastUserIndex; index -= 1) {
    const entry = transcript[index]!
    if (entry.agent !== "user" && entry.agent !== "system" && entry.agent !== "jarvis") {
      return entry.agent as CouncilAgentId
    }
  }

  return null
}

const ROUTING: Array<{ agent: CouncilAgentId; patterns: RegExp[] }> = [
  {
    agent: "rex",
    patterns: [
      /\brisk\b/i,
      /\bbalance\b/i,
      /\bdrawdown\b/i,
      /\blimit\b/i,
      /\bcooldown\b/i,
      /\bslot\b/i,
      /\blose today\b/i,
      /\bcapital\b/i,
    ],
  },
  {
    agent: "zara",
    patterns: [
      /\blast trade\b/i,
      /\bmy trade\b/i,
      /\bmistake\b/i,
      /\bloss\b/i,
      /\bwin\b/i,
      /\bentry\b/i,
      /\bexit\b/i,
      /\bwhat went wrong\b/i,
      /\btoday'?s trades?\b/i,
      /\btrades? today\b/i,
      /\bjournal today\b/i,
      /\bthread.{0,16}today\b/i,
    ],
  },
  {
    agent: "luna",
    patterns: [
      /\bwatchlist\b/i,
      /\bwar room\b/i,
      /\bsetup\b/i,
      /\bgrade\b/i,
      /\bopportunit/i,
      /\bbest pair\b/i,
      /\ba\+\b/i,
    ],
  },
  {
    agent: "cipher",
    patterns: [
      /\bconfirm\b/i,
      /\bapex\b/i,
      /\bfilter\b/i,
      /\bhtf\b/i,
      /\bvalid\b/i,
      /\benter\b/i,
      /\bentry\b/i,
      /\bm15\b/i,
      /\bh4\b/i,
      /\bshould i take\b/i,
    ],
  },
  {
    agent: "marcus",
    patterns: [
      /\bmarcus\b/i,
      /\bpsycholog/i,
      /\bmindset\b/i,
      /\bfomo\b/i,
      /\brevenge\b/i,
      /\btilt\b/i,
      /\bmental\b/i,
      /\bgrowth mindset\b/i,
    ],
  },
  {
    agent: "nova",
    patterns: [
      /\bchapter\b/i,
      /\bweek\b/i,
      /\bdiscipline\b/i,
      /\bemotion/i,
      /\bgrowth\b/i,
      /\bhow am i\b/i,
    ],
  },
]

export function routeCouncilQuestion(message: string): CouncilAgentId {
  const trimmed = message.trim()
  if (!trimmed) return "nova"

  const byName = detectCouncilAgentByName(trimmed)
  if (byName) return byName

  let best: CouncilAgentId = "nova"
  let bestScore = 0

  for (const rule of ROUTING) {
    let score = 0
    for (const pattern of rule.patterns) {
      if (pattern.test(trimmed)) score += 1
    }
    if (score > bestScore) {
      bestScore = score
      best = rule.agent
    }
  }

  return best
}

export function resolveCouncilAgentForMessage(
  message: string,
  options?: {
    preferredAgent?: CouncilAgentId
    stickyAgent?: CouncilAgentId | null
    conversationAgent?: CouncilAgentId | null
  },
): CouncilAgentId {
  const namedAgent = detectCouncilAgentByName(message)
  const delegating = isCouncilDelegationRequest(message)

  if (namedAgent && !delegating) return namedAgent

  const partner =
    options?.conversationAgent ?? options?.preferredAgent ?? options?.stickyAgent ?? null

  if (partner && partner !== "jarvis") return partner

  if (partner === "jarvis" && isGeneralCouncilQuestion(message)) return "jarvis"

  if (namedAgent && delegating) {
    return routeCouncilQuestion(message)
  }

  return routeCouncilQuestion(message)
}
