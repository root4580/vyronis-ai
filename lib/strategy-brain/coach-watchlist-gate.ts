import { checkCoachReadiness, type CoachReadinessResult } from "@/lib/strategy-brain/coach-readiness-gate"

export type { CoachReadinessResult as WeeklyWatchlistGateResult } from "@/lib/strategy-brain/coach-readiness-gate"

/** @deprecated Use checkCoachReadiness — includes watchlist + HTF bias checks. */
export async function checkCoachWatchlistGate(
  pair?: string | null,
): Promise<CoachReadinessResult> {
  return checkCoachReadiness(pair)
}

export { checkCoachReadiness }
