import type {
  ChapterEmotionScorePoint,
  ChapterEmotionSummary,
  ChapterReviewTrade,
} from "@/lib/weekly-chapters/types"
import { buildMistakeAnalysis } from "@/lib/mistake-analysis"

const STABLE_EMOTIONS = new Set(["Calm", "Confident", "Disciplined"])
const IMPULSIVE_EMOTIONS = new Set(["FOMO", "Revenge", "Euphoric", "Anxious", "Fearful"])

function scoreEmotion(emotion: string | null): number {
  if (!emotion?.trim()) return 55
  if (STABLE_EMOTIONS.has(emotion)) return 88
  if (IMPULSIVE_EMOTIONS.has(emotion)) return 38
  return 62
}

function tradeLabel(trade: ChapterReviewTrade, index: number): string {
  const date = trade.trade_date?.slice(5).replace("-", "/")
  return date ? `${trade.pair} · ${date}` : `${trade.pair} #${index + 1}`
}

export function buildChapterEmotionSummary(input: {
  trades: ChapterReviewTrade[]
  disciplineByTradeId: Map<string, number>
  summaryDisciplineScore: number | null
}): ChapterEmotionSummary | null {
  if (input.trades.length === 0) return null

  const chronological = [...input.trades].reverse()
  const timeline: ChapterEmotionScorePoint[] = chronological.map((trade, index) => ({
    tradeId: trade.id,
    pair: trade.pair,
    label: tradeLabel(trade, index),
    emotionalScore: scoreEmotion(trade.emotion),
    disciplineScore: input.disciplineByTradeId.get(trade.id) ?? null,
    emotion: trade.emotion,
    result: trade.result,
  }))

  const emotionalStability =
    timeline.length > 0
      ? Math.round(
          timeline.reduce((sum, point) => sum + point.emotionalScore, 0) / timeline.length,
        )
      : 0

  const disciplineScores = timeline
    .map((point) => point.disciplineScore)
    .filter((value): value is number => value != null)

  let disciplineAverage: number | null = null
  if (disciplineScores.length > 0) {
    disciplineAverage = Math.round(
      disciplineScores.reduce((sum, value) => sum + value, 0) / disciplineScores.length,
    )
  } else if (input.summaryDisciplineScore != null) {
    disciplineAverage = Math.round(input.summaryDisciplineScore)
  } else {
    const mistakeAnalysis = buildMistakeAnalysis(
      input.trades.map((trade) => ({
        direction: trade.direction,
        result: trade.result,
        pnl: trade.pnl,
        emotion: trade.emotion ?? "",
        session: trade.session,
        rule_followed: trade.rule_followed,
        mistake_tags: trade.mistake_tags,
        created_at: trade.trade_date ?? new Date().toISOString(),
      })),
    )
    disciplineAverage = mistakeAnalysis.disciplineScore
  }

  return {
    emotionalStability,
    disciplineAverage,
    timeline,
  }
}
