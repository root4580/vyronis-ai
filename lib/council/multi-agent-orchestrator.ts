import { getCouncilAgent } from "@/lib/council/agents"
import {
  detectCouncilAgentByName,
  isCouncilDelegationRequest,
} from "@/lib/council/router"
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

function ownerReason(agentId: CouncilAgentId, lane: string): string {
  return `Trader asked about ${lane} — ${getCouncilAgent(agentId).name} owns ${lane}.`
}

const CROSS_AGENT_HANDOFFS: Array<{
  targetAgent: CouncilAgentId
  topic: string
  patterns: RegExp[]
  reason: string
}> = [
  {
    targetAgent: "rex",
    topic: "risk",
    patterns: [
      ...handoffTopicPatterns("risk", "balance", "drawdown", "limit", "slot", "capital", "cooldown"),
      /\bhow(?:'s| is) (?:our |the )?risk\b/i,
      /^(?:what|how about )?risk\??$/i,
      /\bcheck (?:the )?risk\b/i,
      /\brisk though\b/i,
    ],
    reason: ownerReason("rex", "limits and capital protection"),
  },
  {
    targetAgent: "nova",
    topic: "discipline",
    patterns: [
      ...handoffTopicPatterns("discipline", "mindset", "emotion", "patience", "chapter"),
      /\bhow(?:'s| am) i (?:doing )?(?:emotionally|mentally)\b/i,
    ],
    reason: ownerReason("nova", "discipline and chapter momentum"),
  },
  {
    targetAgent: "cipher",
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
    reason: ownerReason("cipher", "setup confirmation and entry validity"),
  },
  {
    targetAgent: "luna",
    topic: "watchlist",
    patterns: [
      ...handoffTopicPatterns("watchlist", "war room", "best pair", "setup grade", "opportunity", "opportunities"),
      /\bwhat(?:'s| is) (?:the )?best (?:pair|setup)\b/i,
    ],
    reason: ownerReason("luna", "watchlist and War Room grades"),
  },
  {
    targetAgent: "zara",
    topic: "last trade",
    patterns: [
      ...handoffTopicPatterns("last trade", "recent trade", "mistake", "my trade"),
      /\bwhat went wrong\b/i,
    ],
    reason: ownerReason("zara", "trade review"),
  },
]

export function pickCouncilCrossAgentHandoff(input: {
  question: string
  primaryAgent: CouncilAgentId
  forcedTarget?: CouncilAgentId | null
}): CouncilCrossAgentHandoff | null {
  if (input.forcedTarget && input.forcedTarget !== input.primaryAgent) {
    return {
      targetAgent: input.forcedTarget,
      topic: "question",
      reason: `Trader asked ${getCouncilAgent(input.primaryAgent).name} to bring in ${getCouncilAgent(input.forcedTarget).name}.`,
    }
  }

  const namedAgent = detectCouncilAgentByName(input.question)
  if (
    namedAgent &&
    isCouncilDelegationRequest(input.question) &&
    namedAgent !== input.primaryAgent
  ) {
    return {
      targetAgent: namedAgent,
      topic: "question",
      reason: `Trader asked for ${getCouncilAgent(namedAgent).name} to join the conversation.`,
    }
  }

  if (namedAgent && !isCouncilDelegationRequest(input.question)) {
    return null
  }

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
    case "question":
      return `${targetName}, how are we doing?`
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
    case "rex":
      return input.context.rex.split(".").slice(0, 2).join(".") + "."
    case "nova":
      return input.context.nova.split(".").slice(0, 2).join(".") + "."
    case "cipher":
      return input.context.cipher.split(".").slice(0, 2).join(".") + "."
    case "luna":
      return input.context.luna.split(".").slice(0, 2).join(".") + "."
    case "zara":
      return input.context.zara.split(".").slice(0, 2).join(".") + "."
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
  return /tough|discipline|emotion|patience|lesson|remaining: 0|slots remaining: 0/i.test(context.nova)
}

function contextNeedsRiskCheck(context: CouncilAgentContext): boolean {
  return /cooldown|limit reached|drawdown|max daily loss|weekly live trade limit/i.test(context.rex)
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

  if (primary === "cipher" || primary === "luna") {
    if (entryQuestion || setupQuestion) {
      if (contextNeedsRiskCheck(input.context) && !exclude.has("rex")) {
        decision = {
          agent: "rex",
          reason: `Entry was discussed — ${getCouncilAgent("rex").name} should confirm risk limits and daily loss budget.`,
        }
      } else if (contextNeedsDisciplineCheck(input.context) && !exclude.has("nova")) {
        decision = {
          agent: "nova",
          reason: `Setup looks live — ${getCouncilAgent("nova").name} should check emotional readiness before entry.`,
        }
      } else if (entryQuestion && !exclude.has("rex")) {
        decision = {
          agent: "rex",
          reason: `Trader asked about taking a trade — ${getCouncilAgent("rex").name} adds the risk layer.`,
        }
      }
    }
  }

  if (!decision && primary === "rex" && (entryQuestion || setupQuestion) && !exclude.has("cipher")) {
    decision = {
      agent: "cipher",
      reason: `Risk was cleared — ${getCouncilAgent("cipher").name} confirms technical entry validity.`,
    }
  }

  if (!decision && primary === "zara" && (entryQuestion || setupQuestion) && !exclude.has("nova")) {
    decision = {
      agent: "nova",
      reason: `After trade review, ${getCouncilAgent("nova").name} checks discipline before the next entry.`,
    }
  }

  if (
    !decision &&
    primary === "nova" &&
    setupQuestion &&
    /take|enter|valid|ready|should i/i.test(input.question) &&
    !exclude.has("cipher")
  ) {
    decision = {
      agent: "cipher",
      reason: `${getCouncilAgent("nova").name} covered mindset — ${getCouncilAgent("cipher").name} adds technical confirmation.`,
    }
  }

  if (
    !decision &&
    primary === "cipher" &&
    /valid|confirmed|ready|in the zone|looks good/i.test(input.primaryReply) &&
    contextNeedsDisciplineCheck(input.context) &&
    !exclude.has("nova")
  ) {
    decision = {
      agent: "nova",
      reason: `${getCouncilAgent("cipher").name} said setup is valid — ${getCouncilAgent("nova").name} checks if trader should wait for Coach first.`,
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
    case "nova":
      return `${primaryName} has the technical read — before you enter, check your emotional state and run Coach if you're not fully calm.`
    case "rex":
      return `${primaryName} — hold up. Confirm your weekly slot and daily loss budget before size goes on.`
    case "cipher":
      return `Agree with ${primaryName} on process — wait for M15 close in your direction before entry.`
    case "luna":
      return `${primaryName} covered the plan — your best War Room focus is still the top graded pair.`
    case "zara":
      return `Building on ${primaryName} — one fix from your last trades: patience on confirmation.`
  }
}
