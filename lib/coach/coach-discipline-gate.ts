const BLOCKED_EMOTIONS = new Set([
  "revenge",
  "revenge trading",
  "fearful",
  "impulsive",
  "fomo",
  "anxious",
  "euphoric",
  "greed",
])

const WARNING_EMOTIONS = new Set([
  "revenge",
  "revenge trading",
  "impulsive",
  "fomo",
  "anxious",
])

export type CoachDisciplineInput = {
  weeklyTradesTaken?: number
  maxTradesPerWeek?: number
  emotionalState?: string | null
  /** When true, blocked emotions force SKIP instead of COACH_WARNING. */
  strictEmotionGate?: boolean
}

export type CoachDisciplineResult = {
  tradeLimitReached: boolean
  tradeLimitMessage: string | null
  emotionBlocked: boolean
  emotionWarning: boolean
  emotionMessage: string | null
}

function normalizeEmotion(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase()
}

export function evaluateCoachDiscipline(
  input: CoachDisciplineInput | null | undefined,
): CoachDisciplineResult {
  const weeklyTaken = input?.weeklyTradesTaken ?? 0
  const weeklyMax = input?.maxTradesPerWeek ?? 2
  const emotion = normalizeEmotion(input?.emotionalState)

  const tradeLimitReached =
    weeklyMax > 0 && weeklyTaken >= weeklyMax

  const emotionBlocked = BLOCKED_EMOTIONS.has(emotion)
  const emotionWarning = WARNING_EMOTIONS.has(emotion)

  return {
    tradeLimitReached,
    tradeLimitMessage: tradeLimitReached
      ? `Chapter trade limit reached (${weeklyTaken}/${weeklyMax} trades this week).`
      : null,
    emotionBlocked,
    emotionWarning,
    emotionMessage: emotionBlocked
      ? `${input?.emotionalState || "State"} blocks execution — reset before sizing live.`
      : null,
  }
}

export function shouldSkipForEmotion(
  discipline: CoachDisciplineResult,
  strictEmotionGate: boolean,
): boolean {
  if (!discipline.emotionBlocked) return false
  return strictEmotionGate
}

export function shouldWarnForEmotion(discipline: CoachDisciplineResult): boolean {
  return discipline.emotionWarning && !discipline.tradeLimitReached
}
