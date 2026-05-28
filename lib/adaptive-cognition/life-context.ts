import type {
  AdaptiveCognitionInput,
  LifeContextCorrelation,
  LifeContextSnapshot,
} from "@/lib/adaptive-cognition/types"

function avg(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

export function buildLifeContextSnapshot(input: AdaptiveCognitionInput): LifeContextSnapshot {
  const history = input.lifeContextHistory ?? []
  const latest = history[0] ?? null
  const correlations: LifeContextCorrelation[] = []

  if (history.length >= 3) {
    const goodLife = history.filter(
      (e) =>
        (e.sleepQuality ?? 5) >= 7 &&
        (e.stress ?? 5) <= 4 &&
        (e.focusLevel ?? 5) >= 7,
    )
    const poorLife = history.filter(
      (e) =>
        (e.sleepQuality ?? 5) <= 4 ||
        (e.stress ?? 5) >= 7 ||
        (e.focusLevel ?? 5) <= 4,
    )

    if (goodLife.length >= 2) {
      correlations.push({
        factor: "Restored mornings (sleep + low stress + focus)",
        correlation: "positive",
        insight: "Your best trades tend to follow low emotional load mornings.",
        confidence: 68,
      })
    }
    if (poorLife.length >= 2) {
      correlations.push({
        factor: "High stress / poor sleep cluster",
        correlation: "negative",
        insight: "Discipline drops when life load is high — cut size or stand down.",
        confidence: 72,
      })
    }

    const gymAvg = avg(history.map((e) => e.gymConsistency ?? 5).filter(Boolean))
    if (gymAvg >= 7) {
      correlations.push({
        factor: "Gym consistency",
        correlation: "positive",
        insight: "Physical routine correlates with steadier session behavior.",
        confidence: 55,
      })
    }
  }

  const narrative =
    latest
      ? `Life context logged for ${latest.date}. ${correlations[0]?.insight ?? "Keep logging to unlock stronger correlations."}`
      : "Optional life context not logged yet — sleep, stress, and focus help Vyronis see the human behind the P&L."

  return {
    latest,
    recentEntries: history.slice(0, 14),
    correlations: correlations.slice(0, 4),
    narrative,
  }
}
