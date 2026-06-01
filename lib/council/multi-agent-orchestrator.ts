import { getCouncilAgent } from "@/lib/council/agents"
import type { CouncilAgentContext, CouncilAgentId } from "@/lib/council/types"

export type CouncilChimeInDecision = {
  agent: CouncilAgentId
  reason: string
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
