import type { CompanionConversationalState } from "@/lib/intelligence/conversational-types"
import type { TraderContextMemory } from "@/lib/intelligence/trader-context"

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

export function stateOpener(state: CompanionConversationalState): string {
  switch (state) {
    case "protective":
      return "I'm going to be direct with you"
    case "warning":
      return "Something in your recent data stands out"
    case "reflective":
      return "Looking at your journal honestly"
    case "confident":
      return "You're executing with decent rhythm today"
    case "analytical":
      return "Let me walk through what I'm seeing"
    case "calm":
    default:
      return ""
  }
}

export function buildThinkingPhases(input: {
  userMessage: string
  state: CompanionConversationalState
}): string[] {
  const text = input.userMessage.toLowerCase()
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
    phases.push("Analyzing recent execution…")
  }
  if (input.state === "protective" || input.state === "warning") {
    phases.push("Checking risk guardrails…")
  }
  phases.push("Formulating response…")
  return phases
}

export function pickFollowUpQuestion(input: {
  state: CompanionConversationalState
  memory: TraderContextMemory
  userMessage: string
}): string | undefined {
  const text = input.userMessage.toLowerCase()
  const { memory, state } = input

  if (/why|rush|fomo|revenge|tilt/.test(text)) return undefined

  if (state === "protective" && memory.snapshot.todayTradeCount >= 2) {
    return "Why did you rush this entry?"
  }
  if (state === "warning" || state === "reflective") {
    if (memory.topPatterns.some((p) => /loss|emotion|discipline/i.test(p.message))) {
      return "Were you emotionally affected by the previous loss?"
    }
    return "Did your HTF bias change — or did execution fail?"
  }
  if (state === "analytical" && memory.plannedSessions.length > 0) {
    return "Want to walk through your planned setup before the session moves on?"
  }
  if (state === "confident") {
    return "What would it take to repeat today's discipline tomorrow?"
  }
  return undefined
}
