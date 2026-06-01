import { getCouncilAgent, BRIEFING_AGENT_ORDER } from "@/lib/council/agents"
import {
  detectCouncilAgentByName,
  isCouncilDelegationRequest,
  routeCouncilQuestion,
} from "@/lib/council/router"
import type { CouncilAgentContext, CouncilAgentId } from "@/lib/council/types"
import { getSessionClock } from "@/lib/trading/session-timing"
import type { TodayCalendarResponse } from "@/lib/economic-calendar/types"
import { buildJarvisCalendarLine } from "@/lib/economic-calendar/briefing-lines"

const ROUTING_TOPICS: Partial<Record<CouncilAgentId, string>> = {
  rex: "risk assessment",
  luna: "setup analysis",
  cipher: "technical confirmation",
  nova: "chapter and discipline review",
  zara: "trade review",
  jarvis: "council coordination",
}

function formatBriefingDate(now = new Date()): { dayName: string; dateLabel: string } {
  return {
    dayName: now.toLocaleDateString("en-GB", { weekday: "long" }),
    dateLabel: now.toLocaleDateString("en-GB", { day: "numeric", month: "long" }),
  }
}

function sessionOpenMinutes(preferredSession: string, now = new Date()): {
  sessionLabel: string
  minutesUntilOpen: number | null
  isLive: boolean
} {
  const clock = getSessionClock(now)
  const sessionLabel = preferredSession || clock.nextSessionName || clock.name

  if (clock.isActive) {
    return { sessionLabel, minutesUntilOpen: null, isLive: true }
  }

  if (clock.msUntilNextSession != null) {
    return {
      sessionLabel: clock.nextSessionName ?? sessionLabel,
      minutesUntilOpen: Math.max(1, Math.ceil(clock.msUntilNextSession / 60_000)),
      isLive: false,
    }
  }

  return { sessionLabel, minutesUntilOpen: null, isLive: false }
}

export function buildJarvisOpening(input: {
  traderFirstName: string
  preferredSession: string
  now?: Date
  economicCalendar?: TodayCalendarResponse | null
}): string {
  const { dayName, dateLabel } = formatBriefingDate(input.now)
  const session = sessionOpenMinutes(input.preferredSession, input.now)
  const greeting = `Good morning ${input.traderFirstName}.`
  const dateLine = `It is ${dayName} ${dateLabel}.`
  const newsLine = buildJarvisCalendarLine(input.economicCalendar)

  const parts = [greeting, dateLine]
  if (newsLine) parts.push(newsLine)

  if (session.isLive) {
    parts.push(`${session.sessionLabel} is live. Connecting your council now.`)
  } else if (session.minutesUntilOpen != null) {
    parts.push(`${session.sessionLabel} opens in ${session.minutesUntilOpen} minutes. Connecting your council now.`)
  } else {
    parts.push("Connecting your council now.")
  }

  return parts.join(" ")
}

export function buildJarvisClosing(): string {
  return "Briefing complete. Your edge is intact. The market is ready. Are you?"
}

export function buildJarvisAgentIntro(agentId: CouncilAgentId): string {
  const agent = getCouncilAgent(agentId)
  return `${agent.name} — ${agent.role}.`
}

export function buildJarvisRoutingLine(targetAgent: CouncilAgentId): string {
  const name = getCouncilAgent(targetAgent).name
  const topic = ROUTING_TOPICS[targetAgent] ?? "your request"
  return `Routing to ${name} for ${topic}.`
}

export function buildJarvisConnectingLine(): string {
  return "Connecting your council now."
}

function extractPrimaryPair(lunaContext: string): string | null {
  const match = lunaContext.match(/\b([A-Z]{6,7})\b/)
  return match?.[1] ?? null
}

function riskIsGreen(rexContext: string): boolean {
  return !/limit reached|Cooldown active|Daily loss limit hit/i.test(rexContext)
}

export function buildJarvisConsensus(context: CouncilAgentContext): string {
  const pair = extractPrimaryPair(context.luna) ?? "your top watchlist pair"
  const riskLabel = riskIsGreen(context.rex) ? "green" : "caution"
  return `Council consensus: ${pair} is your focus today. Wait for M15 close. Risk is ${riskLabel}. Execute the plan.`
}

export function isCouncilConsensusRequest(message: string): boolean {
  return /\b(council consensus|whole council|all agents|everyone think|what(?:'s| is) the plan|summarize the council|full council|roundtable|all of you)\b/i.test(
    message.trim(),
  )
}

export function shouldUseCouncilRoundtable(input: {
  message: string
  preferredAgent?: CouncilAgentId
  fullCouncilEnabled?: boolean
}): boolean {
  if (input.fullCouncilEnabled === false) return false

  const trimmed = input.message.trim()
  if (!trimmed) return false

  if (/^(thanks|thank you|ok|okay|got it|cool|cheers)\b/i.test(trimmed)) return false

  if (input.preferredAgent) return false

  if (isCouncilDelegationRequest(trimmed)) return false

  const named = detectCouncilAgentByName(trimmed)
  if (named) return false

  return true
}

export function isGeneralCouncilQuestion(message: string): boolean {
  const trimmed = message.trim()
  if (!trimmed || trimmed.length > 140) return false
  if (/\b(risk|setup|drawdown|watchlist|confirm|entry|trade review|chapter|discipline|mistake|balance|cooldown|m15|h4|apex)\b/i.test(trimmed)) {
    return false
  }
  return (
    /\b(how are we|how do we look|how am i|what should i|any thoughts|general|overview|status update|what do you think|how(?:'s| is) everything|anything i should)\b/i.test(
      trimmed,
    ) || (trimmed.length < 50 && /\?$/.test(trimmed))
  )
}

export function shouldJarvisRoute(input: {
  message: string
  resolvedAgent: CouncilAgentId
  preferredAgent?: CouncilAgentId
  conversationAgent?: CouncilAgentId | null
  stickyAgent?: CouncilAgentId | null
  directAddress: CouncilAgentId | null
}): boolean {
  if (input.resolvedAgent === "jarvis") return false
  if (input.preferredAgent && input.preferredAgent !== "jarvis") return false
  if (input.directAddress && input.directAddress !== "jarvis") return false
  if (input.stickyAgent === input.resolvedAgent) return false
  if (input.conversationAgent && input.conversationAgent === input.resolvedAgent) return false
  if (isCouncilConsensusRequest(input.message)) return false
  return isGeneralCouncilQuestion(input.message)
}

export function resolveSpecialistForGeneralQuestion(message: string): CouncilAgentId {
  const routed = routeCouncilQuestion(message)
  return routed === "jarvis" ? "nova" : routed
}

export function buildJarvisContextSnapshot(input: {
  traderFirstName: string
  preferredSession: string
  chapterLabel: string
}): string {
  const session = sessionOpenMinutes(input.preferredSession)
  const sessionLine = session.isLive
    ? `${session.sessionLabel} is live.`
    : session.minutesUntilOpen != null
      ? `${session.sessionLabel} opens in ${session.minutesUntilOpen} minutes.`
      : `${session.sessionLabel}.`

  return `${input.chapterLabel} for ${input.traderFirstName}. ${sessionLine} Coordinating ${BRIEFING_AGENT_ORDER.map((id) => getCouncilAgent(id).name).join(", ")}.`
}
