import { describe, expect, it } from "vitest"
import {
  evaluateEmotionalDiscipline,
  isEmotionStable,
  normalizeEmotionState,
  requiresHeavyEmotionPenalty,
} from "@/lib/psychology/emotion-filter"

describe("normalizeEmotionState", () => {
  it("maps known aliases to their canonical state", () => {
    expect(normalizeEmotionState("calm")).toBe("calm")
    expect(normalizeEmotionState("disciplined")).toBe("confident")
    expect(normalizeEmotionState("neutral")).toBe("calm")
    expect(normalizeEmotionState("fear")).toBe("fearful")
    expect(normalizeEmotionState("anxious")).toBe("fearful")
    expect(normalizeEmotionState("fomo")).toBe("impulsive")
    expect(normalizeEmotionState("euphoric")).toBe("overconfident")
    expect(normalizeEmotionState("greedy")).toBe("overconfident")
  })

  it("is case-insensitive and trims whitespace", () => {
    expect(normalizeEmotionState("  Calm  ")).toBe("calm")
    expect(normalizeEmotionState("REVENGE")).toBe("revenge")
  })

  it("normalizes multi-word input by collapsing spaces to underscores", () => {
    // "over confident" -> "over_confident", which is not a known alias key,
    // so it should fall back to the unknown-state default.
    expect(normalizeEmotionState("over confident")).toBe("fearful")
  })

  it("defaults unknown or empty input to fearful (fail-safe, not fail-open)", () => {
    expect(normalizeEmotionState("")).toBe("fearful")
    expect(normalizeEmotionState(null)).toBe("fearful")
    expect(normalizeEmotionState(undefined)).toBe("fearful")
    expect(normalizeEmotionState("gibberish")).toBe("fearful")
  })
})

describe("isEmotionStable", () => {
  it("treats only calm and confident as stable", () => {
    expect(isEmotionStable("calm")).toBe(true)
    expect(isEmotionStable("confident")).toBe(true)
    expect(isEmotionStable("fearful")).toBe(false)
    expect(isEmotionStable("revenge")).toBe(false)
    expect(isEmotionStable("impulsive")).toBe(false)
    expect(isEmotionStable("overconfident")).toBe(false)
  })
})

describe("requiresHeavyEmotionPenalty", () => {
  it("flags only revenge and impulsive as heavy-penalty states", () => {
    expect(requiresHeavyEmotionPenalty("revenge")).toBe(true)
    expect(requiresHeavyEmotionPenalty("impulsive")).toBe(true)
    expect(requiresHeavyEmotionPenalty("overconfident")).toBe(false)
    expect(requiresHeavyEmotionPenalty("fearful")).toBe(false)
    expect(requiresHeavyEmotionPenalty("calm")).toBe(false)
    expect(requiresHeavyEmotionPenalty("confident")).toBe(false)
  })
})

describe("evaluateEmotionalDiscipline", () => {
  it("awards full points for calm with no global penalty", () => {
    const result = evaluateEmotionalDiscipline({ state: "calm" }, 10)
    expect(result.component.points).toBe(10)
    expect(result.globalPenalty).toBe(0)
    expect(result.stable).toBe(true)
    expect(result.component.passed).toBe(true)
  })

  it("awards 90% of max points for confident", () => {
    const result = evaluateEmotionalDiscipline({ state: "confident" }, 10)
    expect(result.component.points).toBe(9)
    expect(result.globalPenalty).toBe(0)
  })

  it("applies an 8-point global penalty and 35% points for fearful", () => {
    const result = evaluateEmotionalDiscipline({ state: "fearful" }, 10)
    expect(result.component.points).toBe(4) // round(10 * 0.35)
    expect(result.globalPenalty).toBe(8)
    expect(result.stable).toBe(false)
  })

  it("applies a 12-point global penalty and 30% points for overconfident", () => {
    const result = evaluateEmotionalDiscipline({ state: "overconfident" }, 10)
    expect(result.component.points).toBe(3) // round(10 * 0.3)
    expect(result.globalPenalty).toBe(12)
  })

  it("hard-zeroes points and applies a 25-point global penalty for revenge", () => {
    const result = evaluateEmotionalDiscipline({ state: "revenge" }, 10)
    expect(result.component.points).toBe(0)
    expect(result.globalPenalty).toBe(25)
    expect(result.heavyPenalty).toBe(true)
    expect(result.component.passed).toBe(false)
  })

  it("hard-zeroes points and applies a 25-point global penalty for impulsive", () => {
    const result = evaluateEmotionalDiscipline({ state: "impulsive" }, 10)
    expect(result.component.points).toBe(0)
    expect(result.globalPenalty).toBe(25)
    expect(result.heavyPenalty).toBe(true)
  })

  it("boosts points by 1 (capped at max) when checkScore is 80+", () => {
    const result = evaluateEmotionalDiscipline({ state: "confident", checkScore: 85 }, 10)
    expect(result.component.points).toBe(10) // 9 + 1, capped at maxPoints
  })

  it("does not exceed maxPoints even with a high checkScore on an already-maxed state", () => {
    const result = evaluateEmotionalDiscipline({ state: "calm", checkScore: 100 }, 10)
    expect(result.component.points).toBe(10)
  })

  it("subtracts 2 points (floored at 0) when checkScore is below 50", () => {
    const result = evaluateEmotionalDiscipline({ state: "fearful", checkScore: 30 }, 10)
    expect(result.component.points).toBe(2) // 4 - 2
  })

  it("does not go below 0 points when checkScore penalty would push it negative", () => {
    const result = evaluateEmotionalDiscipline({ state: "revenge", checkScore: 10 }, 10)
    expect(result.component.points).toBe(0)
  })

  it("respects a custom maxPoints value", () => {
    const result = evaluateEmotionalDiscipline({ state: "calm" }, 20)
    expect(result.component.points).toBe(20)
    expect(result.component.maxPoints).toBe(20)
  })
})
