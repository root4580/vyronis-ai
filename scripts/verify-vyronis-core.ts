import { evaluateVyronisCore } from "@/lib/strategy/vyronis-core"
import type { VyronisTradeInput } from "@/types/strategy"

const strongSetup: VyronisTradeInput = {
  pair: "EURUSD",
  htf: {
    weekly: "bullish",
    daily: "bullish",
    h4: "bullish",
    tradeDirection: "long",
  },
  aoi: { reached: true, qualityScore: 88, invalidationClear: true },
  liquidity: { sweepDetected: true, alignedWithDirection: true },
  structure: { shift: "choch", alignedWithDirection: true },
  confirmation: { engulfing: "bullish", alignedWithDirection: true },
  session: { session: "london", favorable: true },
  risk: { riskReward: 2.5, riskPercent: 0.5, maxRiskPercent: 1 },
  news: { majorNewsProximity: false },
  emotion: { state: "calm", checkScore: 85 },
}

const skipSetup: VyronisTradeInput = {
  ...strongSetup,
  htf: {
    weekly: "bullish",
    daily: "bearish",
    h4: "bullish",
    tradeDirection: "long",
  },
  emotion: { state: "revenge" },
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const aPlus = evaluateVyronisCore(strongSetup)
assert(aPlus.grade === "A+" || aPlus.grade === "A", `Expected A+/A, got ${aPlus.grade} (${aPlus.score})`)
assert(!aPlus.hardSkip, "Strong setup should not hard skip")
assert(aPlus.emotionalState === "calm", "Emotion should normalize to calm")

const skip = evaluateVyronisCore(skipSetup)
assert(skip.hardSkip, "Conflict + revenge must hard skip")
assert(skip.grade === "Skip", `Expected Skip, got ${skip.grade}`)
assert(skip.recommendation === "skip", "Recommendation must be skip")

console.log("Vyronis Core verify passed")
console.log("Strong setup:", {
  score: aPlus.score,
  grade: aPlus.grade,
  recommendation: aPlus.recommendation,
  breakdown: aPlus.breakdown,
})
console.log("Skip setup:", {
  score: skip.score,
  grade: skip.grade,
  hardSkipReasons: skip.hardSkipReasons,
})
