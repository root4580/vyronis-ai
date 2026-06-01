import { COUNCIL_AGENTS } from "@/lib/council/agents"
import type { CouncilAgentId } from "@/lib/council/types"

const AGENT_NAME_PATTERNS: Array<{ agent: CouncilAgentId; pattern: RegExp }> = COUNCIL_AGENTS.map(
  (agent) => ({
    agent: agent.id,
    pattern: new RegExp(`\\b${agent.name}\\b`, "i"),
  }),
)

/** Direct address — "Hey Scott", "Good morning Sarah", "Adam, review my trade". */
export function detectCouncilAgentByName(message: string): CouncilAgentId | null {
  const trimmed = message.trim()
  if (!trimmed) return null

  for (const { agent, pattern } of AGENT_NAME_PATTERNS) {
    if (pattern.test(trimmed)) return agent
  }

  return null
}

const ROUTING: Array<{ agent: CouncilAgentId; patterns: RegExp[] }> = [
  {
    agent: "scott",
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
    agent: "adam",
    patterns: [
      /\blast trade\b/i,
      /\bmy trade\b/i,
      /\bmistake\b/i,
      /\bloss\b/i,
      /\bwin\b/i,
      /\bentry\b/i,
      /\bexit\b/i,
      /\bwhat went wrong\b/i,
    ],
  },
  {
    agent: "hamza",
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
    agent: "khalid",
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
    agent: "sarah",
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
  if (!trimmed) return "sarah"

  const byName = detectCouncilAgentByName(trimmed)
  if (byName) return byName

  let best: CouncilAgentId = "sarah"
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
  preferredAgent?: CouncilAgentId,
): CouncilAgentId {
  return detectCouncilAgentByName(message) ?? preferredAgent ?? routeCouncilQuestion(message)
}
