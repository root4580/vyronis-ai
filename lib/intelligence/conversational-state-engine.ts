import type { CompanionConversationalState } from "@/lib/intelligence/conversational-types"
import type { TraderContextMemory } from "@/lib/intelligence/trader-context"
import type { CompanionIntent } from "@/lib/intelligence/companion-intent-engine"

export function resolveCompanionState(memory: TraderContextMemory): CompanionConversationalState {
  const { snapshot, primaryLeak, warnings } = memory
  const hasCritical = warnings.some((w) => w.severity === "critical")
  const hasPatternWarning = warnings.some((w) => w.source === "pattern")
  const todayLoss = snapshot.todayPnL < 0
  const nearLimit = snapshot.todayTradeCount >= 2

  if (hasCritical) return "protective"
  if (hasPatternWarning && todayLoss) return "warning"
  if (primaryLeak.status === "active" && nearLimit) return "protective"
  if (primaryLeak.status === "active") return "reflective"
  if (snapshot.todayTradeCount > 0 && snapshot.todayPnL > 0) return "confident"
  if (snapshot.plannedCount > 0) return "analytical"
  return "calm"
}

export function buildThinkingPhases(input: {
  userMessage: string
  state: CompanionConversationalState
  intent?: CompanionIntent
}): string[] {
  const intent = input.intent
  const text = input.userMessage.toLowerCase()

  if (intent === "casual_conversation") {
    return ["One moment…"]
  }

  if (intent === "market_check") {
    return [
      "Checking your session…",
      "Reviewing planned trades…",
      "Scanning recent patterns and risk…",
      "Putting it together…",
    ]
  }

  if (intent === "emotional_check_in") {
    return ["Listening…", "Reviewing emotional patterns…", "Formulating response…"]
  }

  if (intent === "pre_trade_coaching") {
    return ["Reviewing planned setups…", "Comparing against your playbook…", "Formulating response…"]
  }

  if (intent === "post_trade_review") {
    return ["Pulling up recent trades…", "Comparing plan vs execution…", "Formulating response…"]
  }

  if (intent === "analytics_pattern") {
    return ["Reviewing journal patterns…", "Checking discipline trends…", "Formulating response…"]
  }

  const phases: string[] = []
  if (/plan|setup|coach|entry|trade/.test(text)) {
    phases.push("Comparing against past setups…")
  }
  if (/emotion|feel|tilt|fomo|revenge/.test(text)) {
    phases.push("Reviewing emotional patterns…")
  }
  if (/leak|discipline|mistake|pattern/.test(text)) {
    phases.push("Reviewing discipline trend…")
  }
  if (phases.length === 0) {
    phases.push("Thinking…")
  }
  phases.push("Formulating response…")
  return phases
}

export function pickFollowUpQuestion(input: {
  state: CompanionConversationalState
  memory: TraderContextMemory
  userMessage: string
  intent?: CompanionIntent
}): string | undefined {
  const text = input.userMessage.toLowerCase()
  const { memory, intent } = input

  if (intent === "casual_conversation") return undefined
  if (/why|rush|fomo|revenge|tilt/.test(text)) return undefined

  if (intent === "market_check") {
    return "Want me to dig into setups, discipline, or risk next?"
  }

  if (intent === "emotional_check_in") {
    return "What's the strongest emotion on your mind right now?"
  }

  if (intent === "pre_trade_coaching" && memory.plannedSessions.length > 0) {
    return "Should we open your next planned setup together?"
  }

  if (intent === "post_trade_review") {
    return "Which trade should we break down first?"
  }

  if (intent === "analytics_pattern") {
    return "Want me to compare this to a specific session or pair?"
  }

  return undefined
}
