import type { VyronisCoachVerdict } from "@/lib/coach/precision-flow-engine"
import type { VyronisCoachTraderContext } from "@/lib/coach/vyronis-coach-trader-context"
import type { PatternMemoryResult } from "@/lib/trade-coach/pattern-memory"
import type { PrecisionFlowResult } from "@/lib/coach/precision-flow-engine"

const BANNED_PHRASES: RegExp[] = [
  /\bhello there\b/gi,
  /\bhi there\b/gi,
  /\bgood (morning|afternoon|evening|night)\b/gi,
  /\bit seems like\b/gi,
  /\bit looks like\b/gi,
  /\bconsider\b/gi,
  /\bit's important to\b/gi,
  /\bmake sure\b/gi,
  /\bgreat job\b/gi,
  /\bwell done\b/gi,
  /\byou(?:'re| are) doing (?:great|well|good)\b/gi,
  /\bdisciplined state\b/gi,
]

const COMPLIMENT_PATTERNS: RegExp[] = [
  /\b(great|good|excellent|strong|solid|impressive|nice)\b/gi,
]

const QUESTION_PATTERNS: RegExp[] = [
  /\bhow (?:are|do) you\b/i,
  /\bwhat do you think\b/i,
  /\bhow(?:'s| is) your\b/i,
  /\?\s*$/,
]

function isQuestionSentence(sentence: string): boolean {
  return QUESTION_PATTERNS.some((pattern) => pattern.test(sentence))
}

function cleanupFragments(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/^[!.,\s-]+|[!.,\s-]+$/g, "")
    .trim()
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

function stripQuestions(sentence: string): string {
  return sentence.replace(/\?+$/g, ".").replace(/\?/g, ".")
}

function ensureDirectiveEnding(sentence: string, verdict: VyronisCoachVerdict): string {
  const trimmed = sentence.trim().replace(/[.!]+$/g, "")
  if (!trimmed) {
    if (verdict === "SKIP") return "Step away and reset before the next entry."
    if (verdict === "CAUTION") return "Reduce size and wait for confirmation before committing."
    return "Execute your plan at full size and do not move the stop."
  }
  return `${trimmed}.`
}

export function enforceCoachTone(text: string, verdict: VyronisCoachVerdict): string {
  let cleaned = text.trim()
  for (const pattern of BANNED_PHRASES) {
    cleaned = cleaned.replace(pattern, "")
  }

  if (verdict === "SKIP" || verdict === "CAUTION") {
    for (const pattern of COMPLIMENT_PATTERNS) {
      cleaned = cleaned.replace(pattern, "")
    }
    cleaned = cleaned.replace(/\b(?:you(?:'re| are) )?disciplined\b/gi, "")
  }

  cleaned = cleanupFragments(cleaned)

  let sentences = splitSentences(stripQuestions(cleaned))
    .filter((sentence) => !isQuestionSentence(sentence))
    .slice(0, 3)

  if (sentences.length === 0) {
    sentences = [
      verdict === "SKIP"
        ? "Process gates fail — stand down until emotion and streak reset."
        : verdict === "CAUTION"
          ? "Setup is borderline — reduce size and wait for confirmation."
          : "Setup aligns with your plan — execute at full size.",
    ]
  }

  const lastIndex = sentences.length - 1
  sentences[lastIndex] = ensureDirectiveEnding(sentences[lastIndex], verdict)

  return sentences.join(" ")
}

export function pickJournalDataPoint(
  trader: VyronisCoachTraderContext,
  patternMemory?: PatternMemoryResult,
): string {
  const losses = Number(trader.consecutive_losses)
  if (losses >= 3) {
    return `${losses} consecutive losses with ${trader.emotion_pattern.toLowerCase()}`
  }
  if (Number(trader.top_mistake_frequency) >= 25) {
    return `${trader.top_mistake} on ${trader.top_mistake_frequency}% of recent trades`
  }
  if (patternMemory?.hasEnoughData) {
    const warning = patternMemory.patterns.find((p) => p.severity === "warning")
    if (warning) return warning.message.replace(/\.$/, "")
  }
  if (trader.recent_mistakes !== "None in recent sample") {
    return trader.recent_mistakes.split(";")[0]?.trim() ?? trader.recent_mistakes
  }
  return `${trader.streak}-trade ${trader.streak_direction} streak with discipline score ${trader.discipline_score}/100`
}

export function buildConversationalMessage(input: {
  verdict: VyronisCoachVerdict
  precisionFlow: PrecisionFlowResult
  trader: VyronisCoachTraderContext
  patternMemory?: PatternMemoryResult
  responses: Record<string, string>
}): string {
  const { verdict, precisionFlow, trader, patternMemory } = input
  const journal = pickJournalDataPoint(trader, patternMemory)
  const failedRule = precisionFlow.rules.find((rule) => !rule.passed)
  const topMistake = trader.top_mistake.replace(/\.$/, "")

  if (verdict === "SKIP") {
    const streakLine =
      Number(trader.consecutive_losses) >= 3
        ? `${trader.consecutive_losses} consecutive losses with ${trader.emotion_pattern.toLowerCase()} means this is a reset session, not an execution session.`
        : `${journal} means this is a reset session, not an execution session.`
    const chartLine =
      precisionFlow.rulesPassed >= 4
        ? "The chart quality is acceptable — your process is not."
        : `${precisionFlow.rulesPassed}/7 Precision Flow rules pass — setup quality is not enough to override state.`
    const directive = "Step away, journal one sentence on what you are trying to prove, then reassess."
    return enforceCoachTone([streakLine, chartLine, directive].join(" "), verdict)
  }

  if (verdict === "CAUTION") {
    const alignmentLine = failedRule
      ? `HTF alignment is partial and your journal flags ${topMistake} as the primary mistake.`
      : `Your journal flags ${topMistake} on ${trader.top_mistake_frequency}% of trades with partial HTF alignment.`
    const sizeLine = `Reduce size to ${Math.max(0.25, Number(trader.max_risk.replace("%", "")) / 2).toFixed(2)}% and wait for a clean CHoCH before committing.`
    const limitLine =
      Number(trader.consecutive_losses) >= 2
        ? `One more impulsive entry this session triggers your daily loss limit.`
        : `Discipline score ${trader.discipline_score}/100 this week — one rule break downgrades this to skip.`
    return enforceCoachTone([alignmentLine, sizeLine, limitLine].join(" "), verdict)
  }

  const setupLine = `Setup aligns with your strongest historical pattern — ${trader.preferred_session}, ${trader.best_setup_type.replace(/^Most profitable setup:\s*/i, "")}.`
  const stateLine = `Your discipline score is ${trader.discipline_score}/100 this week with ${journal.toLowerCase()}.`
  const directive = `Execute at ${trader.max_risk} with your plan and do not move the stop.`
  return enforceCoachTone([setupLine, stateLine, directive].join(" "), verdict)
}
