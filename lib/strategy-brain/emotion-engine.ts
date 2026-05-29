import type { EmotionCheckAnswers, EmotionCheckResult } from "@/lib/strategy-brain/types"

export const EMOTION_CHECK_QUESTIONS: Array<{
  key: keyof EmotionCheckAnswers
  label: string
  positiveWhen: boolean
}> = [
  { key: "calm", label: "Are you calm right now?", positiveWhen: true },
  { key: "fomo", label: "Any FOMO on this pair?", positiveWhen: false },
  { key: "chasing", label: "Are you chasing price?", positiveWhen: false },
  { key: "revenge", label: "Revenge trading after a loss?", positiveWhen: false },
  { key: "emotion_stable", label: "Emotion stable for execution?", positiveWhen: true },
  { key: "major_news", label: "Major news risk in the next hour?", positiveWhen: false },
]

export function defaultEmotionAnswers(): EmotionCheckAnswers {
  return {
    calm: true,
    fomo: false,
    chasing: false,
    revenge: false,
    emotion_stable: true,
    major_news: false,
  }
}

export function evaluateEmotionCheck(answers: EmotionCheckAnswers): EmotionCheckResult {
  const flags: string[] = []
  let score = 100

  if (!answers.calm) {
    flags.push("Not calm")
    score -= 18
  }
  if (answers.fomo) {
    flags.push("FOMO")
    score -= 22
  }
  if (answers.chasing) {
    flags.push("Chasing")
    score -= 20
  }
  if (answers.revenge) {
    flags.push("Revenge")
    score -= 25
  }
  if (!answers.emotion_stable) {
    flags.push("Unstable emotion")
    score -= 20
  }
  if (answers.major_news) {
    flags.push("News risk")
    score -= 15
  }

  score = Math.max(0, Math.min(100, score))
  const emotion_stable = score >= 70 && !answers.revenge && !answers.fomo
  const major_news_risk = answers.major_news

  let coach_message: string
  if (score >= 80) {
    coach_message = "Psychology is clear — protect that state through entry and management."
  } else if (score >= 55) {
    coach_message = "Mixed emotional signals — reduce size or wait one confirmation candle."
  } else {
    coach_message = "Execution risk is elevated — a pause now is a professional decision, not weakness."
  }

  return {
    emotion_score: score,
    emotion_stable,
    major_news_risk,
    flags,
    coach_message,
  }
}
