import type { TradeQualityGrade } from "@/lib/trade-coach/trade-quality-engine"

export type TradeQualitySessionRow = {
  id: string
  trade_id: string | null
  quality_score: number | null
  quality_grade: TradeQualityGrade | null
  recommendation: string | null
  confidence_score: number | null
  discipline_score?: number | null
  trade_result?: string | null
}

export type TradeQualityAnalytics = {
  hasData: boolean
  sessionCount: number
  averageQualityScore: number
  averageDisciplineScore: number
  bestQualityTrades: Array<{
    sessionId: string
    tradeId: string | null
    score: number
    grade: TradeQualityGrade
    result: string | null
  }>
  lowQualityPerformance: {
    count: number
    winRate: number
    avgDiscipline: number
  }
  winRateByGrade: Array<{
    grade: TradeQualityGrade
    winRate: number
    count: number
  }>
  disciplineCorrelation: number
  summary: string
}

export function buildTradeQualityAnalytics(
  sessions: TradeQualitySessionRow[],
): TradeQualityAnalytics {
  const scored = sessions.filter(
    (session): session is TradeQualitySessionRow & { quality_score: number; quality_grade: TradeQualityGrade } =>
      session.quality_score !== null && session.quality_grade !== null,
  )

  if (scored.length === 0) {
    return {
      hasData: false,
      sessionCount: 0,
      averageQualityScore: 0,
      averageDisciplineScore: 0,
      bestQualityTrades: [],
      lowQualityPerformance: { count: 0, winRate: 0, avgDiscipline: 0 },
      winRateByGrade: [],
      disciplineCorrelation: 0,
      summary: "Complete pre-trade coach check-ins to unlock quality analytics.",
    }
  }

  const averageQualityScore = Math.round(
    scored.reduce((sum, session) => sum + session.quality_score, 0) / scored.length,
  )

  const disciplineRows = scored.filter((session) => session.discipline_score != null)
  const averageDisciplineScore =
    disciplineRows.length > 0
      ? Math.round(
          disciplineRows.reduce((sum, session) => sum + (session.discipline_score ?? 0), 0) /
            disciplineRows.length,
        )
      : 0

  const bestQualityTrades = [...scored]
    .sort((a, b) => b.quality_score - a.quality_score)
    .slice(0, 3)
    .map((session) => ({
      sessionId: session.id,
      tradeId: session.trade_id,
      score: session.quality_score,
      grade: session.quality_grade,
      result: session.trade_result ?? null,
    }))

  const lowQuality = scored.filter((session) => session.quality_score < 50)
  const lowQualityWins = lowQuality.filter((session) => session.trade_result === "WIN").length
  const lowQualityDisciplineRows = lowQuality.filter((session) => session.discipline_score != null)
  const lowQualityDiscipline =
    lowQualityDisciplineRows.length > 0
      ? Math.round(
          lowQualityDisciplineRows.reduce(
            (sum, session) => sum + (session.discipline_score ?? 0),
            0,
          ) / lowQualityDisciplineRows.length,
        )
      : 0

  const grades: TradeQualityGrade[] = ["A", "B", "C", "D", "F"]
  const winRateByGrade = grades
    .map((grade) => {
      const rows = scored.filter(
        (session) => session.quality_grade === grade && session.trade_result,
      )
      if (rows.length === 0) return null
      const wins = rows.filter((session) => session.trade_result === "WIN").length
      return {
        grade,
        winRate: Math.round((wins / rows.length) * 100),
        count: rows.length,
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  const linked = scored.filter(
    (session) => session.discipline_score != null && session.quality_score != null,
  )
  let disciplineCorrelation = 0
  if (linked.length >= 2) {
    const qualityMean =
      linked.reduce((sum, session) => sum + session.quality_score, 0) / linked.length
    const disciplineMean =
      linked.reduce((sum, session) => sum + (session.discipline_score ?? 0), 0) / linked.length

    let numerator = 0
    let qualityVariance = 0
    let disciplineVariance = 0
    for (const session of linked) {
      const qualityDelta = session.quality_score - qualityMean
      const disciplineDelta = (session.discipline_score ?? 0) - disciplineMean
      numerator += qualityDelta * disciplineDelta
      qualityVariance += qualityDelta ** 2
      disciplineVariance += disciplineDelta ** 2
    }

    const denominator = Math.sqrt(qualityVariance * disciplineVariance)
    disciplineCorrelation =
      denominator > 0 ? Math.round((numerator / denominator) * 100) / 100 : 0
  }

  const summary =
    averageQualityScore >= 70
      ? `Average pre-trade quality is ${averageQualityScore}/100 — process quality is supporting your edge.`
      : averageQualityScore >= 50
        ? `Average pre-trade quality is ${averageQualityScore}/100 — tighten psychology and plan completeness.`
        : `Average pre-trade quality is ${averageQualityScore}/100 — low-quality entries are dominating recent plans.`

  return {
    hasData: true,
    sessionCount: scored.length,
    averageQualityScore,
    averageDisciplineScore,
    bestQualityTrades,
    lowQualityPerformance: {
      count: lowQuality.length,
      winRate:
        lowQuality.length > 0 ? Math.round((lowQualityWins / lowQuality.length) * 100) : 0,
      avgDiscipline: lowQualityDiscipline,
    },
    winRateByGrade,
    disciplineCorrelation,
    summary,
  }
}
