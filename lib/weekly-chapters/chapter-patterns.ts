import type { ChapterReviewPattern, ChapterReviewTrade } from "@/lib/weekly-chapters/types"

function isLoss(trade: ChapterReviewTrade): boolean {
  return trade.result.toUpperCase() === "LOSS" || trade.pnl < 0
}

function isWin(trade: ChapterReviewTrade): boolean {
  return trade.result.toUpperCase() === "WIN" || trade.pnl > 0
}

function sessionLabel(session: string): string {
  const normalized = session.trim()
  if (!normalized) return "this session"
  if (/new york|ny/i.test(normalized)) return "NY open"
  if (/london/i.test(normalized)) return "London"
  if (/asia/i.test(normalized)) return "Asia"
  return normalized
}

export function detectChapterReviewPatterns(trades: ChapterReviewTrade[]): ChapterReviewPattern[] {
  if (trades.length === 0) return []

  const patterns: ChapterReviewPattern[] = []
  const losses = trades.filter(isLoss)
  const wins = trades.filter(isWin)

  const lossesBySession = new Map<string, ChapterReviewTrade[]>()
  for (const trade of losses) {
    const key = (trade.session ?? "").trim()
    if (!key) continue
    const bucket = lossesBySession.get(key) ?? []
    bucket.push(trade)
    lossesBySession.set(key, bucket)
  }

  for (const [session, bucket] of lossesBySession) {
    if (bucket.length >= 2) {
      const label = sessionLabel(session)
      patterns.push({
        id: `session-loss-cluster-${session}`,
        message: `${bucket.length} losses clustered during ${label}. Consider waiting 15 minutes after the open before entering.`,
      })
      break
    }
  }

  const impulsiveLosses = losses.filter((trade) => {
    const emotion = (trade.emotion ?? "").toLowerCase()
    return emotion.includes("revenge") || emotion.includes("fomo") || emotion.includes("euphoric")
  })
  if (impulsiveLosses.length > 0) {
    patterns.push({
      id: "impulsive-emotion-losses",
      message: `${impulsiveLosses.length} loss${impulsiveLosses.length === 1 ? "" : "es"} tagged with impulsive emotion — pause before the next entry.`,
    })
  }

  const ruleBreakLosses = losses.filter((trade) => trade.rule_followed === false)
  if (ruleBreakLosses.length > 0) {
    patterns.push({
      id: "rule-break-losses",
      message: `${ruleBreakLosses.length} losing trade${ruleBreakLosses.length === 1 ? "" : "s"} broke your rules. Tighten pre-trade checklist before Chapter continues.`,
    })
  }

  const coachSkippedLosses = losses.filter((trade) => !trade.coach_grade?.trim())
  if (coachSkippedLosses.length >= 2) {
    patterns.push({
      id: "coach-skipped-losses",
      message: `${coachSkippedLosses.length} losses had no Coach grade — run War Room Coach before sizing up next week.`,
    })
  }

  const strongWins = wins.filter((trade) => {
    const grade = (trade.coach_grade ?? "").replace(/\s+/g, "").toUpperCase()
    return grade === "A+" || grade === "A"
  })
  if (strongWins.length > 0 && wins.length > 0) {
    patterns.push({
      id: "strong-coach-wins",
      message: `${strongWins.length} win${strongWins.length === 1 ? "" : "s"} matched Coach A/A+ setups — repeat that preparation routine.`,
    })
  }

  return patterns.slice(0, 4)
}
