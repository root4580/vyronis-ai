const EMOTION_QUESTION =
  /how are you feeling today|scale of 1 to 10|rate yourself 1-10|1 to 10 today/i

export function buildNovaEmotionCheckQuestion(traderFirstName: string): string {
  return `${traderFirstName}, before we dive in — how are you feeling today on a scale of 1 to 10?`
}

export function buildRexLowEmotionResponse(score: number): string {
  return `You logged ${score}/10. Recommend observation only today — protect capital until you're steadier.`
}

export function buildNovaEmotionAck(score: number): string {
  if (score >= 7) {
    return `Thank you — ${score}/10 logged. You're in a solid headspace. Let's stay process-focused.`
  }
  return `Thank you — ${score}/10 logged. I'm noting that for the room.`
}

export function parseEmotionScoreFromMessage(message: string): number | null {
  const trimmed = message.trim()
  if (!trimmed) return null

  const direct = trimmed.match(/^(\d{1,2})(?:\s*\/\s*10)?$/i)
  if (direct) {
    const score = Number(direct[1])
    if (score >= 1 && score <= 10) return score
  }

  const embedded = trimmed.match(/\b(\d{1,2})\s*(?:\/\s*10|out of 10)\b/i)
  if (embedded) {
    const score = Number(embedded[1])
    if (score >= 1 && score <= 10) return score
  }

  const wordMatch = trimmed.match(/\b(?:i(?:'m| am)|feeling|at)\s*(?:a\s*)?(\d{1,2})\b/i)
  if (wordMatch) {
    const score = Number(wordMatch[1])
    if (score >= 1 && score <= 10) return score
  }

  return null
}

export function isNovaEmotionCheckPending(transcript: Array<{ agent: string; content: string }>): boolean {
  for (let index = transcript.length - 1; index >= 0; index -= 1) {
    const entry = transcript[index]!
    if (entry.agent === "user") return false
    if (entry.agent === "nova" && EMOTION_QUESTION.test(entry.content)) return true
    if (entry.agent !== "system") return false
  }
  return false
}
