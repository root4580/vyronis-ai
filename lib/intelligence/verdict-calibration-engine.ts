import type { OutcomeLessonRecord } from "@/lib/learning/outcome-learning-engine"
import type { TradeDecisionRecommendation } from "@/lib/intelligence/intelligence-types"

export type VerdictCalibrationSnapshot = {
  sampleCount: number
  skipAccuracy: number | null
  cautionAccuracy: number | null
  takeAccuracy: number | null
  /** Positive = Vyronis was too aggressive; negative = too conservative */
  strictnessBias: number
  emotionalWeightMultiplier: number
  performanceWeightMultiplier: number
  narrative: string
}

function accuracy(
  lessons: OutcomeLessonRecord[],
  verdict: TradeDecisionRecommendation,
): number | null {
  const subset = lessons.filter(
    (l) => l.vyronisVerdictAtPlan === verdict && l.vyronisWasRight != null,
  )
  if (subset.length < 2) return null
  const right = subset.filter((l) => l.vyronisWasRight === true).length
  return Math.round((right / subset.length) * 100)
}

/**
 * Closed-loop calibration from outcome_lessons — nudges strictness and factor weights.
 */
export function computeVerdictCalibration(
  lessons: OutcomeLessonRecord[],
): VerdictCalibrationSnapshot {
  const withVerdict = lessons.filter((l) => l.vyronisVerdictAtPlan != null)
  const skipAccuracy = accuracy(withVerdict, "SKIP")
  const cautionAccuracy = accuracy(withVerdict, "CAUTION")
  const takeAccuracy = accuracy(withVerdict, "TAKE")

  let strictnessBias = 0
  if (takeAccuracy != null && takeAccuracy < 45) strictnessBias += 8
  if (skipAccuracy != null && skipAccuracy >= 70) strictnessBias += 5
  if (cautionAccuracy != null && cautionAccuracy >= 65) strictnessBias -= 2

  const wrongTake = withVerdict.filter(
    (l) => l.vyronisVerdictAtPlan === "TAKE" && l.vyronisWasRight === false,
  ).length
  const emotionalMisses = withVerdict.filter(
    (l) =>
      l.vyronisWasRight === false &&
      /revenge|fomo|emotional|impulsive/i.test(
        `${l.emotion} ${l.overrideReason} ${l.lesson}`,
      ),
  ).length

  let emotionalWeightMultiplier = 1
  let performanceWeightMultiplier = 1
  if (withVerdict.length >= 3 && emotionalMisses >= 2) {
    emotionalWeightMultiplier = 1.12
  }
  if (wrongTake >= 2 && takeAccuracy != null && takeAccuracy < 50) {
    performanceWeightMultiplier = 1.08
  }

  const narrative =
    withVerdict.length < 3
      ? "Calibration warming up — more closed trades will sharpen verdicts."
      : strictnessBias >= 6
        ? "Recent outcomes suggest tighter SKIP/CAUTION when emotions are elevated."
        : strictnessBias <= -2
          ? "Calibration allows slightly more TAKE when process has been clean."
          : "Verdict calibration is balanced for your recent journal."

  return {
    sampleCount: withVerdict.length,
    skipAccuracy,
    cautionAccuracy,
    takeAccuracy,
    strictnessBias,
    emotionalWeightMultiplier,
    performanceWeightMultiplier,
    narrative,
  }
}

export function applyCalibrationToStrictness(
  base: number,
  calibration: VerdictCalibrationSnapshot | null | undefined,
): number {
  if (!calibration || calibration.sampleCount < 3) return base
  return Math.max(0, Math.min(100, Math.round(base + calibration.strictnessBias)))
}
