import { getCouncilAgent } from "@/lib/council/agents"
import { detectCouncilAgentByName } from "@/lib/council/router"
import type { CouncilAgentContext, CouncilAgentId } from "@/lib/council/types"

export type CouncilChimeInDecision = {
  agent: CouncilAgentId
  reason: string
}

export type CouncilCrossAgentHandoff = {
  targetAgent: CouncilAgentId
  topic: string
  reason: string
}

function handoffTopicPatterns(...topics: string[]): RegExp[] {
  const topicGroup = topics.map((topic) => topic.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")
  return [
    new RegExp(`\\b(?:what|how) about (?:the |my )?(?:${topicGroup})\\b`, "i"),
    new RegExp(`\\bhow are we (?:looking|doing) (?:on |at )?(?:the |my )?(?:${topicGroup})\\b`, "i"),
    new RegExp(`\\b(?:and |but )(?:the |my )?(?:${topicGroup})\\b`, "i"),
    new RegExp(`^(?:what|how) about (?:the |my )?(?:${topicGroup})\\??$`, "i"),
  ]
}

const CROSS_AGENT_HANDOFFS: Array<{
  targetAgent: CouncilAgentId
  topic: string
  patterns: RegExp[]
  reason: string
}> = [
  {
    targetAgent: "scott",
    topic: "risk",
    patterns: [
      ...handoffTopicPatterns("risk", "balance", "drawdown", "limit", "slot", "capital", "cooldown"),
      /\bhow(?:'s| is) (?:our |the )?risk\b/i,
      /^(?:what|how about )?risk\??$/i,
      /\bcheck (?:the )?risk\b/i,
      /\brisk though\b/i,
    ],
    reason: "Trader asked about risk — Scott owns limits and capital protection.",
  },
  {
    targetAgent: "sarah",
    topic: "discipline",
    patterns: [
      ...handoffTopicPatterns("discipline", "mindset", "emotion", "patience", "chapter"),
      /\bhow(?:'s| am) i (?:doing )?(?:emotionally|mentally)\b/i,
    ],
    reason: "Trader asked about mindset — Sarah owns discipline and chapter momentum.",
  },
  {
    targetAgent: "khalid",
    topic: "setup",
    patterns: [
      ...handoffTopicPatterns(
        "setup",
        "confirmation",
        "confirm",
        "entry",
        "validity",
        "m15",
        "htf",
        "h4",
        "technical",
      ),
      /\bis it (?:still )?valid\b/i,
      /^(?:what|how about )?(?:the )?setup\??$/i,
    ],
    reason: "Trader asked about setup confirmation — Khalid owns entry validity.",
  },
  {
    targetAgent: "hamza",
    topic: "watchlist",
    patterns: [
      ...handoffTopicPatterns("watchlist", "war room", "best pair", "setup grade", "opportunity", "opportunities"),
      /\bwhat(?:'s| is) (?:the )?best (?:pair|setup)\b/i,
    ],
    reason: "Trader asked about opportunities — Hamza owns watchlist and War Room grades.",
  },
  {
    targetAgent: "adam",
    topic: "last trade",
    patterns: [
      ...handoffTopicPatterns("last trade", "recent trade", "mistake", "my trade"),
      /\bwhat went wrong\b/i,
    ],
    reason: "Trader asked about past execution — Adam owns trade review.",
  },
]

export function pickCouncilCrossAgentHandoff(input: {
  question: string
  primaryAgent: CouncilAgentId
}): CouncilCrossAgentHandoff | null {
  if (detectCouncilAgentByName(input.question)) return null

  const trimmed = input.question.trim()
  if (!trimmed) return null

  for (const rule of CROSS_AGENT_HANDOFFS) {
    if (rule.targetAgent === input.primaryAgent) continue

    for (const pattern of rule.patterns) {
      if (pattern.test(trimmed)) {
        return {
          targetAgent: rule.targetAgent,
          topic: rule.topic,
          reason: rule.reason,
        }
      }
    }
  }

  return null
}

export function buildHandoffAskFallback(input: {
  primaryAgent: CouncilAgentId
  targetAgent: CouncilAgentId
  topic: string
}): string {
  const targetName = getCouncilAgent(input.targetAgent).name

  switch (input.topic) {
    case "risk":
      return `${targetName}, how are we looking on risk today?`
    case "discipline":
      return `${targetName}, how's my discipline looking this week?`
    case "confirmation":
    case "setup":
      return `${targetName}, how's the setup looking from your read?`
    case "watchlist":
      return `${targetName}, what's the best setup on the watchlist right now?`
    case "last trade":
      return `${targetName}, what stands out from my last trade?`
    default:
      return `${targetName}, what's your read on that?`
  }
}

export function buildHandoffAnswerFallback(input: {
  targetAgent: CouncilAgentId
  topic: string
  context: CouncilAgentContext
}): string {
  switch (input.targetAgent) {
    case "scott":
      return input.context.scott.split(".").slice(0, 2).join(".") + "."
    case "sarah":
      return input.context.sarah.split(".").slice(0, 2).join(".") + "."
    case "khalid":
      return input.context.khalid.split(".").slice(0, 2).join(".") + "."
    case "hamza":
      return input.context.hamza.split(".").slice(0, 2).join(".") + "."
    case "adam":
      return input.context.adam.split(".").slice(0, 2).join(".") + "."
  }
}

function isEntryDecisionQuestion(question: string): boolean {
  return /should i take|should i enter|can i take|can i enter|is it valid|ready to enter|go ahead|pull the trigger|take this|take it now|enter now/i.test(
    question,
  )
}

function isSetupQuestion(question: string): boolean {
  return /setup|pair|aoi|zone|confirm|valid|ready|enter|take|trade today/i.test(question)
}

function isSimpleGreeting(question: string): boolean {
  const trimmed = question.trim()
  return trimmed.length < 45 && /^(hi|hello|hey|good morning|good afternoon|thanks|thank you)\b/i.test(trimmed)
}

function contextNeedsDisciplineCheck(context: CouncilAgentContext): boolean {
  return /tough|discipline|emotion|patience|lesson|remaining: 0|slots remaining: 0/i.test(context.sarah)
}

function contextNeedsRiskCheck(context: CouncilAgentContext): boolean {
  return /cooldown|limit reached|drawdown|max daily loss|weekly live trade limit/i.test(context.scott)
}

function isCouncilRoundtableQuestion(question: string): boolean {
  return /what does the council|what do you all|everyone think|whole council|all of you|council think|ask the council|full council/i.test(
    question,
  )
}

export function pickCouncilChimeInAgent(input: {
  primaryAgent: CouncilAgentId
  question: string
  primaryReply: string
  context: CouncilAgentContext
  excludeAgents?: CouncilAgentId[]
}): CouncilChimeInDecision | null {
  if (isSimpleGreeting(input.question)) return null

  const exclude = new Set(input.excludeAgents ?? [])
  exclude.add(input.primaryAgent)

  const entryQuestion = isEntryDecisionQuestion(input.question)
  const setupQuestion = isSetupQuestion(input.question)
  const primary = input.primaryAgent

  let decision: CouncilChimeInDecision | null = null

  if (primary === "khalid" || primary === "hamza") {
    if (entryQuestion || setupQuestion) {
      if (contextNeedsRiskCheck(input.context) && !exclude.has("scott")) {
        decision = {
          agent: "scott",
          reason: "Entry was discussed — Scott should confirm risk limits and daily loss budget.",
        }
      } else if (contextNeedsDisciplineCheck(input.context) && !exclude.has("sarah")) {
        decision = {
          agent: "sarah",
          reason: "Setup looks live — Sarah should check emotional readiness before entry.",
        }
      } else if (entryQuestion && !exclude.has("scott")) {
        decision = {
          agent: "scott",
          reason: "Trader asked about taking a trade — Scott adds the risk layer.",
        }
      }
    }
  }

  if (!decision && primary === "scott" && (entryQuestion || setupQuestion) && !exclude.has("khalid")) {
    decision = {
      agent: "khalid",
      reason: "Risk was cleared — Khalid confirms technical entry validity.",
    }
  }

  if (!decision && primary === "adam" && (entryQuestion || setupQuestion) && !exclude.has("sarah")) {
    decision = {
      agent: "sarah",
      reason: "After trade review, Sarah checks discipline before the next entry.",
    }
  }

  if (
    !decision &&
    primary === "sarah" &&
    setupQuestion &&
    /take|enter|valid|ready|should i/i.test(input.question) &&
    !exclude.has("khalid")
  ) {
    decision = {
      agent: "khalid",
      reason: "Sarah covered mindset — Khalid adds technical confirmation.",
    }
  }

  if (
    !decision &&
    primary === "khalid" &&
    /valid|confirmed|ready|in the zone|looks good/i.test(input.primaryReply) &&
    contextNeedsDisciplineCheck(input.context) &&
    !exclude.has("sarah")
  ) {
    decision = {
      agent: "sarah",
      reason: "Khalid said setup is valid — Sarah checks if trader should wait for Coach first.",
    }
  }

  if (decision && exclude.has(decision.agent)) return null
  return decision
}

export function buildChimeInFallback(input: {
  chimeAgent: CouncilAgentId
  primaryAgent: CouncilAgentId
  primaryReply: string
}): string {
  const primaryName =
    input.primaryAgent === input.chimeAgent ? "that" : getCouncilAgent(input.primaryAgent).name

  switch (input.chimeAgent) {
    case "sarah":
      return `${primaryName} has the technical read — before you enter, check your emotional state and run Coach if you're not fully calm.`
    case "scott":
      return `${primaryName} — hold up. Confirm your weekly slot and daily loss budget before size goes on.`
    case "khalid":
      return `Agree with ${primaryName} on process — wait for M15 close in your direction before entry.`
    case "hamza":
      return `${primaryName} covered the plan — your best War Room focus is still the top graded pair.`
    case "adam":
      return `Building on ${primaryName} — one fix from your last trades: patience on confirmation.`
  }
}
