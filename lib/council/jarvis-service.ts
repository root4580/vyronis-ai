import { formatAccountMoney } from "@/lib/accounts/profit-target"
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
import { getCouncilTimeOfDay } from "@/lib/council/time-of-day"

const ROUTING_TOPICS: Partial<Record<CouncilAgentId, string>> = {
  rex: "risk assessment",
  luna: "setup analysis",
  cipher: "technical confirmation",
  nova: "chapter and discipline review",
  zara: "trade review",
  jarvis: "council coordination",
  marcus: "mindset and psychology",
}

function timeOfDayLabel(now: Date): "morning" | "afternoon" | "evening" {
  return getCouncilTimeOfDay(now)
}

function sessionStatusLabel(preferredSession: string, now = new Date()): {
  sessionLabel: string
  status: "open" | "closed"
} {
  const clock = getSessionClock(now)
  const sessionLabel = preferredSession || clock.name || "Session"
  if (clock.isActive) {
    return { sessionLabel, status: "open" }
  }
  return { sessionLabel, status: "closed" }
}

export function buildJarvisOpening(input: {
  traderFirstName: string
  preferredSession: string
  balance: number
  currency: string
  drawdownPct: number
  watchlistCount: number
  now?: Date
  economicCalendar?: TodayCalendarResponse | null
}): string {
  const now = input.now ?? new Date()
  const timeOfDay = timeOfDayLabel(now)
  const session = sessionStatusLabel(input.preferredSession, now)
  const balance = formatAccountMoney(input.balance, input.currency)
  const drawdown = `${input.drawdownPct.toFixed(1)}%`
  const setups =
    input.watchlistCount === 1
      ? "1 setup"
      : `${input.watchlistCount} setups`

  const parts = [
    `Good ${timeOfDay} ${input.traderFirstName}. ${session.sessionLabel} is ${session.status}.`,
    `Balance ${balance}. Drawdown ${drawdown}.`,
    `${setups} on watch. Council ready.`,
  ]

  const newsLine = buildJarvisCalendarLine(input.economicCalendar)
  if (newsLine) parts.splice(2, 0, newsLine)

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
  const session = sessionStatusLabel(input.preferredSession)
  const sessionLine = `${session.sessionLabel} is ${session.status}.`

  return `${input.chapterLabel} for ${input.traderFirstName}. ${sessionLine} Coordinating ${BRIEFING_AGENT_ORDER.map((id) => getCouncilAgent(id).name).join(", ")}.`
}
