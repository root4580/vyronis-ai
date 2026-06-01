import { generateDebriefNarrativeWithProvider, getConfiguredAiProviderId } from "@/lib/ai/providers"
import type { ChapterReviewPattern, WeeklySummaryRecord } from "@/lib/weekly-chapters/types"
import { formatWeekOfLabel } from "@/lib/weekly-chapters/week-utils"

export function patternIdsKey(patterns: ChapterReviewPattern[]): string {
  return patterns
    .map((pattern) => pattern.id)
    .sort()
    .join("|")
}

export function buildFallbackPatternAction(patterns: ChapterReviewPattern[]): string | null {
  if (patterns.length === 0) return null
  return patterns[0]!.message.trim() || null
}

export async function generateChapterPatternAction(input: {
  summary: WeeklySummaryRecord
  patterns: ChapterReviewPattern[]
  carryForwardLesson: string
}): Promise<{ action: string | null; provider: string | null }> {
  const fallback = buildFallbackPatternAction(input.patterns)
  if (!fallback) {
    return { action: null, provider: null }
  }

  if (!getConfiguredAiProviderId()) {
    return { action: fallback, provider: "rule-based" }
  }

  const prompt = [
    `You are Vyronis Coach. Turn these chapter patterns into ONE concrete action for next week.`,
    `Chapter ${input.summary.chapter_number} · ${formatWeekOfLabel(input.summary.week_start)}`,
    `Patterns detected:\n${input.patterns.map((pattern) => `- ${pattern.message}`).join("\n")}`,
    input.summary.key_lesson ? `Key lesson: ${input.summary.key_lesson}` : null,
    `Carry forward: ${input.carryForwardLesson}`,
    `Write exactly one sentence (max 28 words).`,
    `Start with an imperative verb. Be specific (session, wait time, Coach, emotion). No hype.`,
    `Do not use bullet points or quotes.`,
  ]
    .filter(Boolean)
    .join("\n")

  const action = await generateDebriefNarrativeWithProvider({
    summary: `Chapter ${input.summary.chapter_number} pattern action`,
    tradeCount: input.summary.trades_taken,
    winRate: input.summary.win_rate,
    recurringMistakes: input.patterns.map((pattern) => pattern.message),
    prompt,
  })

  const trimmed = action?.trim().replace(/^["']|["']$/g, "") ?? ""
  if (!trimmed) {
    return { action: fallback, provider: "rule-based" }
  }

  return {
    action: trimmed,
    provider: getConfiguredAiProviderId(),
  }
}
