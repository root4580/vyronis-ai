import { generateDebriefNarrativeWithProvider, getConfiguredAiProviderId } from "@/lib/ai/providers"
import type {
  ChapterEmotionSummary,
  ChapterReviewPaperTrade,
  ChapterReviewPattern,
  ChapterReviewTrade,
  WeeklySummaryRecord,
} from "@/lib/weekly-chapters/types"
import { formatWeekOfLabel } from "@/lib/weekly-chapters/week-utils"

export async function generateChapterReviewAiNarrative(input: {
  summary: WeeklySummaryRecord
  patterns: ChapterReviewPattern[]
  trades: ChapterReviewTrade[]
  paperLine: string | null
  paperTrades: ChapterReviewPaperTrade[]
  emotionSummary: ChapterEmotionSummary | null
  coachInsights: string[]
  carryForwardLesson: string
}): Promise<{ narrative: string | null; provider: string | null }> {
  if (!getConfiguredAiProviderId()) {
    return { narrative: null, provider: null }
  }

  const losses = input.trades.filter(
    (trade) => trade.result.toUpperCase() === "LOSS" || trade.pnl < 0,
  )
  const wins = input.trades.filter(
    (trade) => trade.result.toUpperCase() === "WIN" || trade.pnl > 0,
  )

  const tradeLines = input.trades.slice(0, 8).map((trade) => {
    const extras = [
      trade.session ? `session ${trade.session}` : null,
      trade.emotion ? `emotion ${trade.emotion}` : null,
      trade.coach_grade ? `Coach ${trade.coach_grade}` : null,
      trade.what_went_wrong ? `issue: ${trade.what_went_wrong}` : null,
      trade.what_went_right ? `strength: ${trade.what_went_right}` : null,
    ].filter(Boolean)
    return `- ${trade.pair} ${trade.direction} ${trade.result} (${extras.join(", ") || "no tags"})`
  })

  const prompt = [
    `Write a weekly trading chapter review for a disciplined forex trader.`,
    `Chapter ${input.summary.chapter_number} · ${formatWeekOfLabel(input.summary.week_start)}`,
    `Live: ${input.summary.trades_taken} trades, ${input.summary.win_rate}% win rate, P&L ${input.summary.pnl.toFixed(2)}.`,
    `Wins: ${wins.length}, Losses: ${losses.length}.`,
    input.paperLine ? `Practice Room: ${input.paperLine}.` : null,
    input.paperTrades.length > 0
      ? `Paper trades this week: ${input.paperTrades.length}.`
      : null,
    input.emotionSummary
      ? `Emotional stability score: ${input.emotionSummary.emotionalStability}/100. Discipline avg: ${input.emotionSummary.disciplineAverage ?? "n/a"}/100.`
      : null,
    input.patterns.length > 0
      ? `Rule-based patterns:\n${input.patterns.map((pattern) => `- ${pattern.message}`).join("\n")}`
      : null,
    input.coachInsights.length > 0
      ? `Coach insights:\n${input.coachInsights.map((line) => `- ${line}`).join("\n")}`
      : null,
    input.summary.key_lesson ? `Key lesson: ${input.summary.key_lesson}` : null,
    `Carry forward: ${input.carryForwardLesson}`,
    tradeLines.length > 0 ? `Trades:\n${tradeLines.join("\n")}` : null,
    `Write 2 short paragraphs (max 120 words total).`,
    `Paragraph 1: what the data says happened this chapter — be specific about sessions, emotions, or Coach grades when relevant.`,
    `Paragraph 2: one concrete focus for next chapter. No hype. Speak like Vyronis Coach.`,
  ]
    .filter(Boolean)
    .join("\n")

  const narrative = await generateDebriefNarrativeWithProvider({
    summary: `Chapter ${input.summary.chapter_number} review`,
    tradeCount: input.summary.trades_taken,
    winRate: input.summary.win_rate,
    recurringMistakes: input.patterns.map((pattern) => pattern.message),
    prompt,
  })

  return {
    narrative: narrative?.trim() || null,
    provider: narrative ? getConfiguredAiProviderId() : null,
  }
}
