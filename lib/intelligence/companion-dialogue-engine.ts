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
  resolveCompanionState,
  stateOpener,
} from "@/lib/intelligence/conversational-state-engine"

function joinParts(parts: string[]): string {
  return parts.filter(Boolean).join(" ")
}

function respondToEmotion(memory: TraderContextMemory, text: string): string | null {
  if (!/fomo|revenge|tilt|emotional|anxious|euphoric|stress|angry|scared/.test(text)) {
    return null
  }
  const leak = memory.primaryLeak.correctiveAction
  return joinParts([
    "Before you touch the chart — pause.",
    leak,
    "Name the emotion on this setup honestly. If it's outside your playbook, that's the trade to skip.",
  ])
}

function respondToDiscipline(memory: TraderContextMemory): string {
  if (memory.primaryLeak.status === "active") {
    return joinParts([
      stateOpener("reflective"),
      `${memory.primaryLeak.headline}.`,
      `The focus right now: ${memory.primaryLeak.correctiveAction}`,
    ])
  }
  return "Your behavioral read is still forming — I'm watching emotion, session, and confirmation tags. Give me a few more logged trades and I'll sharpen the picture."
}

function respondToSetups(memory: TraderContextMemory): string {
  if (memory.plannedSessions.length === 0) {
    return "Nothing planned in memory yet. When a setup forms, run it through pre-trade coach or let a TradingView alert land — I'll remember the context."
  }
  const plan = memory.plannedSessions[0]
  const label = `${plan.pair || "Setup"} ${plan.direction || ""}`.trim()
  return joinParts([
    `You have ${memory.plannedSessions.length} setup${memory.plannedSessions.length === 1 ? "" : "s"} in memory.`,
    `The next one is ${label}${plan.confidence_score != null ? ` (${plan.confidence_score}% confidence)` : ""}.`,
    "Want to open it and walk through HTF bias before you commit?",
  ])
}

function respondToToday(memory: TraderContextMemory): string {
  const { snapshot, greeting } = memory
  const pnlNote =
    snapshot.todayPnL !== 0
      ? snapshot.todayPnL > 0
        ? `up ${Math.abs(snapshot.todayPnL).toFixed(0)} today`
        : `down ${Math.abs(snapshot.todayPnL).toFixed(0)} today`
      : "flat today"

  return joinParts([
    `${greeting.sessionLabel} is live.`,
    `You've logged ${snapshot.todayTradeCount} trade${snapshot.todayTradeCount === 1 ? "" : "s"} — ${pnlNote}.`,
    snapshot.todayTradeCount === 0
      ? "Clean slate. What's the plan?"
      : "How are you feeling about the quality of those executions?",
  ])
}

function buildDefaultReply(
  memory: TraderContextMemory,
  state: CompanionReplyResult["companionState"],
  memoryRef?: string,
): string {
  const parts: string[] = []
  const opener = stateOpener(state)
  if (opener) parts.push(`${opener}.`)

  if (memoryRef) {
    parts.push(memoryRef + ".")
  }

  if (memory.snapshot.plannedCount > 0) {
    parts.push(`I'm holding ${memory.snapshot.plannedCount} planned setup${memory.snapshot.plannedCount === 1 ? "" : "s"} in memory for you.`)
  } else {
    parts.push("I'm synced to your journal and watching session quality.")
  }

  parts.push("What's on your mind — a setup, a feeling, or a review?")
  return joinParts(parts)
}

export function generateCompanionDialogue(input: {
  userMessage: string
  memory: TraderContextMemory
  recentTrades: RecentTradeMemory[]
  recentMessages: CommandCenterMessageRecord[]
}): CompanionReplyResult {
  const text = input.userMessage.trim().toLowerCase()
  const state = resolveCompanionState(input.memory)
  const thinkingPhases = buildThinkingPhases({ userMessage: input.userMessage, state })
  const mentionedIds = extractMentionedWarningIds(input.recentMessages)
  const freshWarnings = filterFreshWarnings(input.memory.warnings, mentionedIds)
  const memoryRef = pickMemoryReference(input.recentTrades, input.userMessage)
  const followUpQuestion = pickFollowUpQuestion({
    state,
    memory: input.memory,
    userMessage: input.userMessage,
  })

  const mentionedWarningIds: string[] = []
  let isCriticalHighlight = false
  let body = ""

  if (!text) {
    body = "Talk to me — a setup you're considering, how you're feeling, or something from the journal you want to unpack."
  } else if (respondToEmotion(input.memory, text)) {
    body = respondToEmotion(input.memory, text)!
    mentionedWarningIds.push(...freshWarnings.filter((w) => w.source === "pattern").map((w) => w.id))
  } else if (/leak|behavior|mistake|discipline/.test(text)) {
    body = respondToDiscipline(input.memory)
  } else if (/pattern|memory|history|stats|similar|last week/.test(text)) {
    const pattern = input.memory.topPatterns[0]
    if (memoryRef) {
      body = joinParts([memoryRef + ".", pattern ? pattern.message : ""])
    } else if (pattern) {
      body = joinParts(["From your journal:", pattern.message])
    } else {
      body = `${input.memory.snapshot.tradeCount} trades logged. Keep tagging emotion and mistakes — patterns emerge with consistency, not luck.`
    }
  } else if (/plan|setup|trade|coach|pre.?trade|entry/.test(text)) {
    body = respondToSetups(input.memory)
  } else if (/today|session|market|morning|afternoon/.test(text)) {
    body = respondToToday(input.memory)
  } else if (/week|review|analytics/.test(text)) {
    body = "Weekly analytics live on the dashboard, but I read the same journal. Ask me about a specific pattern, session, or pair — I'll compare it to your history."
  } else {
    body = buildDefaultReply(input.memory, state, memoryRef)
  }

  const critical = freshWarnings.find((w) => w.severity === "critical")
  const inlineWarning = critical || freshWarnings.find((w) => w.source !== "planned")

  if (inlineWarning && !wasWarningMentionedRecently(input.recentMessages, inlineWarning.id)) {
    const woven = weaveWarningInline(inlineWarning, false)
    if (woven) {
      if (inlineWarning.severity === "critical") {
        body = joinParts([woven, body])
        isCriticalHighlight = true
      } else if (!body.includes(inlineWarning.message.slice(0, 24))) {
        body = joinParts([body, woven])
      }
      mentionedWarningIds.push(inlineWarning.id)
    }
  }

  if (followUpQuestion && !body.includes(followUpQuestion)) {
    body = `${body} ${followUpQuestion}`
  }

  return {
    content: body.trim(),
    followUpQuestion,
    companionState: state,
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
  const state = resolveCompanionState(input.memory)
  const hour = new Date().getHours()
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  const name = input.traderName?.trim()?.split(" ")[0]
  const prefix = name ? `${hello}, ${name}.` : `${hello}.`

  const memoryRef = pickMemoryReference(input.recentTrades, "history")
  const parts: string[] = [prefix]

  switch (state) {
    case "protective":
      parts.push("I'm in protective mode today — let's prioritize capital over action.")
      break
    case "warning":
      parts.push("I'm watching your recent execution closely.")
      break
    case "confident":
      parts.push("You're building momentum — let's protect it.")
      break
    case "analytical":
      parts.push("I've got planned setups in memory when you're ready.")
      break
    default:
      parts.push("I'm here.")
  }

  if (input.memory.snapshot.todayTradeCount > 0) {
    parts.push(
      `${input.memory.snapshot.todayTradeCount} trade${input.memory.snapshot.todayTradeCount === 1 ? "" : "s"} logged today.`,
    )
  }

  if (memoryRef) {
    parts.push(memoryRef + ".")
  } else if (input.memory.plannedSessions[0]) {
    const p = input.memory.plannedSessions[0]
    parts.push(`${p.pair || "A setup"} is waiting in memory if you want to review it.`)
  }

  parts.push("What's the focus right now?")

  return {
    content: joinParts(parts),
    companionState: state,
  }
}
