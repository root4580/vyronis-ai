import { describe, expect, it } from "vitest"
import {
  VYRONIS_MAX_SCORE,
  VYRONIS_SCORE_WEIGHTS,
  buildVyronisEvaluation,
  computeWeightedVyronisScore,
  executionQualityFromScore,
  gradeFromVyronisScore,
  recommendationFromGrade,
  scoreEmotionalDisciplineComponent,
  type VyronisScoreComponents,
} from "@/lib/scoring/trade-score"
import type { VyronisComponentResult, VyronisTradeInput } from "@/types/strategy"

function component(ratio: number, maxPoints = 4): VyronisComponentResult {
  return {
    points: Math.round(ratio * maxPoints),
    maxPoints,
    reasons: [],
    warnings: [],
    passed: ratio >= 0.5,
  }
}

/** All seven weighted components at the same pass ratio. */
function componentsAtRatio(
  ratio: number,
): Omit<VyronisScoreComponents, "emotionGlobalPenalty" | "htfAligned" | "emotionStable"> {
  return {
    htfAlignment: component(ratio),
    aoiQuality: component(ratio),
    structureShift: component(ratio),
    confirmationCandle: component(ratio),
    sessionTiming: component(ratio),
    rrQuality: component(ratio),
    emotionalDiscipline: component(ratio),
  }
}

function tradeInput(emotionState = "calm"): VyronisTradeInput {
  // buildVyronisEvaluation and scoreEmotionalDisciplineComponent only read
  // input.emotion — the rest of VyronisTradeInput isn't touched by the
  // functions under test, so a minimal fixture is intentional here.
  return { emotion: { state: emotionState } } as unknown as VyronisTradeInput
}

describe("VYRONIS_SCORE_WEIGHTS / VYRONIS_MAX_SCORE", () => {
  it("weights sum to 100", () => {
    expect(VYRONIS_MAX_SCORE).toBe(100)
    expect(
      Object.values(VYRONIS_SCORE_WEIGHTS).reduce((sum, w) => sum + w, 0),
    ).toBe(100)
  })
})

describe("gradeFromVyronisScore", () => {
  it("grades at the documented thresholds", () => {
    expect(gradeFromVyronisScore(100)).toBe("A+")
    expect(gradeFromVyronisScore(90)).toBe("A+")
    expect(gradeFromVyronisScore(89)).toBe("A")
    expect(gradeFromVyronisScore(80)).toBe("A")
    expect(gradeFromVyronisScore(79)).toBe("B")
    expect(gradeFromVyronisScore(70)).toBe("B")
    expect(gradeFromVyronisScore(69)).toBe("Skip")
    expect(gradeFromVyronisScore(0)).toBe("Skip")
  })
})

describe("recommendationFromGrade", () => {
  it("skips whenever hardSkip is true, regardless of grade", () => {
    expect(recommendationFromGrade("A+", true)).toBe("skip")
    expect(recommendationFromGrade("Skip", true)).toBe("skip")
  })

  it("maps grades to recommendations when not hard-skipped", () => {
    expect(recommendationFromGrade("Skip", false)).toBe("skip")
    expect(recommendationFromGrade("B", false)).toBe("reduce_size")
    expect(recommendationFromGrade("A", false)).toBe("execute")
    expect(recommendationFromGrade("A+", false)).toBe("execute")
  })
})

describe("executionQualityFromScore", () => {
  it("returns blocked whenever hardSkip is true, regardless of score", () => {
    expect(executionQualityFromScore(100, true)).toBe("blocked")
  })

  it("maps score bands to execution quality when not blocked", () => {
    expect(executionQualityFromScore(95, false)).toBe("excellent")
    expect(executionQualityFromScore(85, false)).toBe("good")
    expect(executionQualityFromScore(75, false)).toBe("marginal")
    expect(executionQualityFromScore(50, false)).toBe("poor")
  })
})

describe("computeWeightedVyronisScore", () => {
  it("scores 100 when every component is fully passed with no penalty", () => {
    expect(computeWeightedVyronisScore(componentsAtRatio(1))).toBe(100)
  })

  it("scores 0 when every component is at zero", () => {
    expect(computeWeightedVyronisScore(componentsAtRatio(0))).toBe(0)
  })

  it("weights components proportionally to their share of the 100-point total", () => {
    // Every component at 75% ratio -> weighted sum is 75% of the 100-point total.
    expect(computeWeightedVyronisScore(componentsAtRatio(0.75))).toBe(75)
  })

  it("subtracts the emotion global penalty from the weighted score", () => {
    expect(computeWeightedVyronisScore(componentsAtRatio(1), 25)).toBe(75)
  })

  it("clamps the final score at 0 when the penalty exceeds the weighted score", () => {
    expect(computeWeightedVyronisScore(componentsAtRatio(0), 25)).toBe(0)
  })
})

describe("scoreEmotionalDisciplineComponent", () => {
  it("marks calm as a stable emotional state with full points", () => {
    const result = scoreEmotionalDisciplineComponent(tradeInput("calm"))
    expect(result.emotionStable).toBe(true)
    expect(result.emotionGlobalPenalty).toBe(0)
    expect(result.emotionalDiscipline.points).toBe(VYRONIS_SCORE_WEIGHTS.emotionalDiscipline)
  })

  it("marks revenge as unstable with the full heavy penalty", () => {
    const result = scoreEmotionalDisciplineComponent(tradeInput("revenge"))
    expect(result.emotionStable).toBe(false)
    expect(result.emotionGlobalPenalty).toBe(25)
    expect(result.emotionalDiscipline.points).toBe(0)
  })
})

describe("buildVyronisEvaluation", () => {
  it("grades a fully-passed, emotionally stable trade as A+ / execute / excellent", () => {
    const evaluation = buildVyronisEvaluation(tradeInput("calm"), {
      ...componentsAtRatio(1),
      emotionGlobalPenalty: 0,
      htfAligned: true,
      emotionStable: true,
    })

    expect(evaluation.score).toBe(100)
    expect(evaluation.grade).toBe("A+")
    expect(evaluation.hardSkip).toBe(false)
    expect(evaluation.recommendation).toBe("execute")
    expect(evaluation.executionQuality).toBe("excellent")
  })

  it("hard-skips when HTF alignment is missing, even with a perfect score otherwise", () => {
    const evaluation = buildVyronisEvaluation(tradeInput("calm"), {
      ...componentsAtRatio(1),
      emotionGlobalPenalty: 0,
      htfAligned: false,
      emotionStable: true,
    })

    expect(evaluation.hardSkip).toBe(true)
    expect(evaluation.grade).toBe("Skip")
    expect(evaluation.recommendation).toBe("skip")
    expect(evaluation.executionQuality).toBe("blocked")
    expect(evaluation.score).toBeLessThanOrEqual(69)
    expect(
      evaluation.hardSkipReasons.some((reason) => reason.includes("HTF alignment")),
    ).toBe(true)
  })

  it("hard-skips when the emotional state is unstable, even with a perfect score otherwise", () => {
    const evaluation = buildVyronisEvaluation(tradeInput("revenge"), {
      ...componentsAtRatio(1),
      emotionGlobalPenalty: 25,
      htfAligned: true,
      emotionStable: false,
    })

    expect(evaluation.hardSkip).toBe(true)
    expect(evaluation.grade).toBe("Skip")
    expect(evaluation.recommendation).toBe("skip")
    expect(
      evaluation.hardSkipReasons.some((reason) => reason.toLowerCase().includes("unstable")),
    ).toBe(true)
  })

  it("recommends reduce_size for a mid-band (B grade) trade that isn't hard-skipped", () => {
    const evaluation = buildVyronisEvaluation(tradeInput("calm"), {
      ...componentsAtRatio(0.75),
      emotionGlobalPenalty: 0,
      htfAligned: true,
      emotionStable: true,
    })

    expect(evaluation.score).toBe(75)
    expect(evaluation.grade).toBe("B")
    expect(evaluation.hardSkip).toBe(false)
    expect(evaluation.recommendation).toBe("reduce_size")
    expect(evaluation.executionQuality).toBe("marginal")
  })

  it("de-duplicates reasons/warnings and caps them at 12 entries", () => {
    const repeatedReasonComponent: VyronisComponentResult = {
      points: 4,
      maxPoints: 4,
      reasons: ["Same reason repeated"],
      warnings: [],
      passed: true,
    }
    const evaluation = buildVyronisEvaluation(tradeInput("calm"), {
      htfAlignment: repeatedReasonComponent,
      aoiQuality: repeatedReasonComponent,
      structureShift: repeatedReasonComponent,
      confirmationCandle: repeatedReasonComponent,
      sessionTiming: repeatedReasonComponent,
      rrQuality: repeatedReasonComponent,
      emotionalDiscipline: repeatedReasonComponent,
      emotionGlobalPenalty: 0,
      htfAligned: true,
      emotionStable: true,
    })

    // 7 components all report the exact same reason string -> deduped to 1.
    expect(evaluation.reasons).toEqual(["Same reason repeated"])
    expect(evaluation.reasons.length).toBeLessThanOrEqual(12)
    expect(evaluation.warnings.length).toBeLessThanOrEqual(12)
  })
})
