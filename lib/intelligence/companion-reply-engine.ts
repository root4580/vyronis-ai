import type { TraderContextMemory } from "@/lib/intelligence/trader-context"

export function generateCompanionReply(input: {
  userMessage: string
  memory: TraderContextMemory
}): string {
  const text = input.userMessage.trim().toLowerCase()
  const { memory } = input

  if (!text) {
    return "Tell me what you're working on — a setup, a journal review, or how you're feeling before the session."
  }

  if (/fomo|revenge|tilt|emotional|anxious|euphoric/.test(text)) {
    return `Before you click: ${memory.primaryLeak.correctiveAction} What's the emotion tag on this setup — and is it inside your playbook?`
  }

  if (/leak|behavior|mistake|discipline/.test(text)) {
    if (memory.primaryLeak.status === "active") {
      return `${memory.primaryLeak.headline} Focus: ${memory.primaryLeak.correctiveAction}`
    }
    return "Your behavioral profile is still forming. Keep logging emotion, session, and confirmation on every trade — I'll sharpen the leak read as sample size grows."
  }

  if (/pattern|memory|history|stats/.test(text)) {
    const top = memory.topPatterns[0]
    if (top) return `Top pattern right now: ${top.message}`
    return `You have ${memory.snapshot.tradeCount} trades logged. Add a few more tagged entries and I'll surface repeatable edges and leaks.`
  }

  if (/plan|setup|trade|coach|pre.?trade/.test(text)) {
    if (memory.plannedSessions.length === 0) {
      return "No planned setups yet. Start a pre-trade coach session from Journal or drop a TradingView alert — I'll keep it in memory here."
    }
    const plan = memory.plannedSessions[0]
    return `You have ${memory.plannedSessions.length} planned setup${memory.plannedSessions.length === 1 ? "" : "s"}. Next up: ${plan.pair || "Unknown"} ${plan.direction || ""}. Open it from the memory feed below or launch the full pre-trade coach.`
  }

  if (/today|session|market/.test(text)) {
    return `${memory.greeting.sessionLabel}. Today: ${memory.snapshot.todayTradeCount} trade${memory.snapshot.todayTradeCount === 1 ? "" : "s"} logged. ${memory.greeting.subline}`
  }

  if (/week|review|analytics/.test(text)) {
    return "Weekly review and analytics are still on the dashboard — I'm learning from the same journal data. Ask about patterns or your primary leak for a focused read."
  }

  const warning = memory.warnings[0]
  if (warning) {
    return `${warning.title}: ${warning.message} What would you like to dig into?`
  }

  return `${memory.greeting.headline.split("—")[0].trim()}. I'm synced to your journal, planned trades, and behavioral patterns. Ask about setups, leaks, or how you're feeling before you trade.`
}
