import type { AdaptiveCognitionInput, PersonalOperatingSystem, PersonalOsMode } from "@/lib/adaptive-cognition/types"

export function buildPersonalOperatingSystem(input: AdaptiveCognitionInput): PersonalOperatingSystem {
  const { context } = input
  const intervention = context.tradingOs?.intervention
  const drift = context.tradingOs?.liveSession.emotionalDriftScore ?? 0

  let recommendedMode: PersonalOsMode = "neutral"
  if (intervention?.active && !intervention.canProceedToEntry) {
    recommendedMode = "recovery"
  } else if (drift >= 65 || context.emotionalState.trend === "volatile") {
    recommendedMode = "recovery"
  } else if (context.memory.snapshot.plannedCount > 0) {
    recommendedMode = "planning"
  } else if (
    context.cognitive?.state.primary === "focused" ||
    context.cognitive?.state.primary === "disciplined"
  ) {
    recommendedMode = "focus"
  } else if (context.memory.snapshot.todayTradeCount > 0) {
    recommendedMode = "reflection"
  }

  const activeFlows = [
    {
      id: "daily_reflection",
      label: "Daily reflection",
      description: "3-minute close: what did the market mirror about you today?",
      status: "active" as const,
    },
    {
      id: "planning",
      label: "Planning system",
      description: "Session intent, max trades, and A+ setup definition.",
      status: "active" as const,
    },
    {
      id: "focus_mode",
      label: "Focus mode",
      description: "One setup, one session, no impulsive adds.",
      status: recommendedMode === "focus" ? ("active" as const) : ("available" as const),
    },
    {
      id: "recovery_mode",
      label: "Recovery mode",
      description: "Stand down, walk, journal — no chart until reset.",
      status: recommendedMode === "recovery" ? ("active" as const) : ("available" as const),
    },
    {
      id: "deep_work",
      label: "Deep work tracking",
      description: "Backtest and review blocks without live execution.",
      status: "available" as const,
    },
    {
      id: "emotional_journal",
      label: "Emotional journaling",
      description: "Tag emotion before entry; compare to outcome.",
      status: "active" as const,
    },
    {
      id: "self_review",
      label: "Self-review system",
      description: "Weekly identity check vs discipline metrics.",
      status: "active" as const,
    },
  ]

  return {
    recommendedMode,
    activeFlows,
    dailyReflectionPrompt:
      "What did today teach you about who you are becoming — not what the market did?",
    planningPrompt:
      "Define one A+ setup, max risk, and the emotion you refuse to trade with today.",
    selfReviewCadence: "weekly",
  }
}
