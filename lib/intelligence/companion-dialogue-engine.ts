import type { CommandCenterMessageRecord } from "@/lib/command-center/types"
import type { CompanionReplyResult, RecentTradeMemory } from "@/lib/intelligence/conversational-types"
import type { TraderContextMemory } from "@/lib/intelligence/trader-context"
import {
  extractMentionedWarningIds,
  filterFreshWarnings,
  weaveWarningInline,
  wasWarningMentionedRecently,
} from "@/lib/intelligence/conversation-continuity"
import { pickMemoryReference } from "@/lib/intelligence/memory-callbacks"
import {
  buildThinkingPhases,
  pickFollowUpQuestion,
} from "@/lib/intelligence/conversational-state-engine"
import {
  detectCompanionIntent,
  firstNameFromDisplay,
  isTradingIntent,
  type CompanionIntent,
} from "@/lib/intelligence/companion-intent-engine"

function joinParts(parts: string[]): string {
  return parts.filter(Boolean).join(" ")
}

function respondToCasual(traderName?: string | null): string {
  const name = firstNameFromDisplay(traderName)
  const hello = name ? `Hey ${name}.` : "Hey."
  return joinParts([
    hello,
    "How's your day going?",
    "Are we looking at the market today, reviewing trades, or keeping it light for now?",
  ])
}

function respondToMarketCheck(memory: TraderContextMemory): string {
  const { snapshot, greeting } = memory
  const parts: string[] = [
    "Let me check your current session, planned trades, recent patterns, and risk state.",
  ]

  parts.push(`${greeting.sessionLabel}${greeting.sessionLabel.includes("Closed") ? "" : " is active"}.`)

  if (snapshot.todayTradeCount > 0) {
    const pnlNote =
      snapshot.todayPnL > 0
        ? `up ${Math.abs(snapshot.todayPnL).toFixed(0)}`
        : snapshot.todayPnL < 0
          ? `down ${Math.abs(snapshot.todayPnL).toFixed(0)}`
          : "flat"
    parts.push(
      `You've logged ${snapshot.todayTradeCount} trade${snapshot.todayTradeCount === 1 ? "" : "s"} today — ${pnlNote}.`,
    )
  } else {
    parts.push("No trades logged yet today — clean slate.")
  }

  if (memory.plannedSessions.length > 0) {
    const plan = memory.plannedSessions[0]
    parts.push(
      `${memory.plannedSessions.length} planned setup${memory.plannedSessions.length === 1 ? "" : "s"} in memory${plan.pair ? ` — next is ${plan.pair}` : ""}.`,
    )
  }

  const topPattern = memory.topPatterns[0]
  if (topPattern && topPattern.severity === "warning") {
    parts.push(`One thing I'm watching: ${topPattern.message}`)
  } else if (memory.primaryLeak.status === "active") {
    parts.push(`Behavioral focus: ${memory.primaryLeak.headline.toLowerCase()}.`)
  } else if (snapshot.winRate > 0) {
    parts.push(`Overall journal win rate sits around ${snapshot.winRate}%.`)
  }

  return joinParts(parts)
}

function respondToEmotional(memory: TraderContextMemory): string {
  return joinParts([
    "Thanks for saying that — let's slow down before anything else.",
    memory.primaryLeak.status === "active"
      ? memory.primaryLeak.correctiveAction
      : "What's the strongest emotion you're feeling right now, and what triggered it?",
    "We can talk it through before you touch a chart.",
  ])
}

function respondToDiscipline(memory: TraderContextMemory): string {
  if (memory.primaryLeak.status === "active") {
    return joinParts([
      `Looking at your journal, ${memory.primaryLeak.headline.toLowerCase()}.`,
      memory.primaryLeak.correctiveAction,
    ])
  }
  return "Your behavioral profile is still forming. Keep tagging emotion and session on each trade — I'll sharpen the read as your sample grows."
}

function respondToSetups(memory: TraderContextMemory): string {
  if (memory.plannedSessions.length === 0) {
    return joinParts([
      "Nothing planned in memory yet.",
      "When a setup forms, run it through pre-trade coach or let a TradingView alert land — I'll pick it up from there.",
    ])
  }
  const plan = memory.plannedSessions[0]
  const label = `${plan.pair || "Setup"} ${plan.direction || ""}`.trim()
  return joinParts([
    `You have ${memory.plannedSessions.length} setup${memory.plannedSessions.length === 1 ? "" : "s"} waiting.`,
    `Next up: ${label}${plan.confidence_score != null ? ` (${plan.confidence_score}% confidence)` : ""}.`,
    "Want to open it and walk through HTF bias together?",
  ])
}

function respondToPostTrade(memory: TraderContextMemory): string {
  const recent = memory.topPatterns.find((p) => /loss|discipline|plan/i.test(p.message))
  return joinParts([
    "Let's debrief properly.",
    recent
      ? `Recent journal theme: ${recent.message}`
      : "Tell me which trade you want to unpack — I'll compare the plan to what actually happened.",
    "What felt off in execution, if anything?",
  ])
}

function respondToAnalytics(
  memory: TraderContextMemory,
  memoryRef: string | undefined,
): string {
  const pattern = memory.topPatterns[0]
  if (memoryRef) {
    return joinParts([memoryRef + ".", pattern ? pattern.message : ""])
  }
  if (pattern) {
    return joinParts(["From your journal:", pattern.message])
  }
  return `${memory.snapshot.tradeCount} trades logged. Keep tagging emotion and mistakes — patterns show up with consistency, not luck.`
}

function gentleCriticalNote(message: string): string {
  return `One heads-up when you're ready: ${message}`
}

function resolveStateForIntent(
  intent: CompanionIntent,
  memory: TraderContextMemory,
): CompanionReplyResult["companionState"] {
  if (intent === "casual_conversation") return "calm"
  if (intent === "emotional_check_in") return "reflective"
  if (intent === "market_check") return memory.snapshot.plannedCount > 0 ? "analytical" : "calm"
  if (intent === "pre_trade_coaching") return "analytical"
  if (intent === "post_trade_review") return "reflective"
  if (memory.warnings.some((w) => w.severity === "critical")) return "protective"
  if (memory.warnings.some((w) => w.source === "pattern")) return "warning"
  return "calm"
}

export function generateCompanionDialogue(input: {
  userMessage: string
  memory: TraderContextMemory
  recentTrades: RecentTradeMemory[]
  recentMessages: CommandCenterMessageRecord[]
  traderName?: string | null
}): CompanionReplyResult {
  const text = input.userMessage.trim()
  const normalized = text.toLowerCase()
  const intent = detectCompanionIntent(text)
  const companionState = resolveStateForIntent(intent, input.memory)
  const thinkingPhases = buildThinkingPhases({
    userMessage: input.userMessage,
    state: companionState,
    intent,
  })

  const mentionedIds = extractMentionedWarningIds(input.recentMessages)
  const freshWarnings = filterFreshWarnings(input.memory.warnings, mentionedIds)
  const memoryRef = isTradingIntent(intent)
    ? pickMemoryReference(input.recentTrades, input.userMessage)
    : undefined

  const mentionedWarningIds: string[] = []
  let isCriticalHighlight = false
  let body = ""

  switch (intent) {
    case "casual_conversation":
      body = respondToCasual(input.traderName)
      break
    case "market_check":
      body = respondToMarketCheck(input.memory)
      break
    case "pre_trade_coaching":
      body = respondToSetups(input.memory)
      break
    case "post_trade_review":
      body = respondToPostTrade(input.memory)
      break
    case "emotional_check_in":
      body = respondToEmotional(input.memory)
      break
    case "analytics_pattern":
      if (/leak|behavior|behaviour|mistake|discipline/.test(normalized)) {
        body = respondToDiscipline(input.memory)
      } else {
        body = respondToAnalytics(input.memory, memoryRef)
      }
      break
    default:
      body = respondToCasual(input.traderName)
  }

  const followUpQuestion = pickFollowUpQuestion({
    state: companionState,
    memory: input.memory,
    userMessage: input.userMessage,
    intent,
  })

  if (isTradingIntent(intent)) {
    const critical = freshWarnings.find((w) => w.severity === "critical")
    const inlineWarning =
      critical || freshWarnings.find((w) => w.source !== "planned" && w.source !== "leak")

    if (inlineWarning && !wasWarningMentionedRecently(input.recentMessages, inlineWarning.id)) {
      const woven = weaveWarningInline(inlineWarning, false)
      if (woven && !body.includes(inlineWarning.message.slice(0, 24))) {
        if (inlineWarning.severity === "critical") {
          body = joinParts([body, woven])
          isCriticalHighlight = true
        } else {
          body = joinParts([body, woven])
        }
        mentionedWarningIds.push(inlineWarning.id)
      }
    }
  } else {
    const critical = freshWarnings.find((w) => w.severity === "critical")
    if (critical && !wasWarningMentionedRecently(input.recentMessages, critical.id)) {
      body = joinParts([body, gentleCriticalNote(critical.message)])
      mentionedWarningIds.push(critical.id)
      isCriticalHighlight = true
    }
  }

  if (followUpQuestion && !body.includes(followUpQuestion)) {
    body = `${body} ${followUpQuestion}`
  }

  return {
    content: body.trim(),
    followUpQuestion,
    companionState,
    thinkingPhases,
    memoryReference: memoryRef,
    mentionedWarningIds,
    isCriticalHighlight,
  }
}

export function buildConversationalGreeting(input: {
  memory: TraderContextMemory
  recentTrades: RecentTradeMemory[]
  traderName?: string | null
}): { content: string; companionState: CompanionReplyResult["companionState"] } {
  const name = firstNameFromDisplay(input.traderName)
  const hour = new Date().getHours()
  const timeHello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  const hello = name ? `${timeHello}, ${name}.` : `${timeHello}.`

  return {
    content: joinParts([
      hello,
      "I'm here.",
      "How's your day going?",
      "Are we checking the market today, reviewing trades, or keeping it light for now?",
    ]),
    companionState: "calm",
  }
}
