export type ScannerBias = "Bullish" | "Bearish" | "Neutral"

export type ScannerGrade = "A+" | "A" | "B" | "C" | "Skip"

export type ScannerLiquiditySweepStatus = "Confirmed" | "Pending" | "None"

export type ScannerChochBosStatus = "CHoCH" | "BOS" | "Pending" | "None"

export type ScannerSetupFactors = {
  direction: "BUY" | "SELL"
  dailyBias: ScannerBias
  h4Bias: ScannerBias
  validZone: boolean
  zoneType: string
  liquiditySweep: ScannerLiquiditySweepStatus
  chochBos: ScannerChochBosStatus
  engulfingConfirmation: boolean
  confirmationType: string
  sessionAlignment: boolean
  session: string
  riskRewardRatio: number
}

export type ScannerScoreFactorId =
  | "dailyH4Alignment"
  | "validZone"
  | "liquiditySweep"
  | "chochBos"
  | "engulfingConfirmation"
  | "sessionAlignment"
  | "riskReward"

export type ScannerScoreFactor = {
  id: ScannerScoreFactorId
  label: string
  points: number
  maxPoints: number
  met: boolean
  reason: string
}

export type ScannerScoreResult = {
  score: number
  grade: ScannerGrade
  confidence: number
  factors: ScannerScoreFactor[]
  strengths: string[]
  warnings: string[]
}

const FACTOR_WEIGHTS: Record<ScannerScoreFactorId, { label: string; max: number }> = {
  dailyH4Alignment: { label: "Daily / H4 alignment", max: 18 },
  validZone: { label: "Valid zone", max: 14 },
  liquiditySweep: { label: "Liquidity sweep", max: 14 },
  chochBos: { label: "CHoCH / BOS", max: 14 },
  engulfingConfirmation: { label: "Engulfing confirmation", max: 12 },
  sessionAlignment: { label: "Session alignment", max: 14 },
  riskReward: { label: "R:R ≥ 1:2", max: 14 },
}

function biasSupportsDirection(bias: ScannerBias, direction: "BUY" | "SELL"): boolean {
  if (bias === "Neutral") return false
  return (direction === "BUY" && bias === "Bullish") || (direction === "SELL" && bias === "Bearish")
}

function scoreFromGrade(total: number): ScannerGrade {
  if (total >= 90) return "A+"
  if (total >= 80) return "A"
  if (total >= 70) return "B"
  if (total >= 60) return "C"
  return "Skip"
}

function scoreDailyH4Alignment(
  setup: ScannerSetupFactors,
): Pick<ScannerScoreFactor, "points" | "met" | "reason"> {
  const { max } = FACTOR_WEIGHTS.dailyH4Alignment
  const dailyOk = biasSupportsDirection(setup.dailyBias, setup.direction)
  const h4Ok = biasSupportsDirection(setup.h4Bias, setup.direction)

  if (dailyOk && h4Ok) {
    return {
      points: max,
      met: true,
      reason: `Daily ${setup.dailyBias.toLowerCase()} and H4 ${setup.h4Bias.toLowerCase()} support ${setup.direction}.`,
    }
  }
  if (dailyOk || h4Ok) {
    return {
      points: 10,
      met: false,
      reason: dailyOk
        ? "Daily aligned — H4 not fully confirmed yet."
        : "H4 aligned — daily structure still mixed.",
    }
  }
  if (setup.dailyBias === "Neutral" && setup.h4Bias === "Neutral") {
    return {
      points: 4,
      met: false,
      reason: "No clear HTF bias — counter-flow risk elevated.",
    }
  }
  return {
    points: 0,
    met: false,
    reason: "HTF bias conflicts with trade direction.",
  }
}

function scoreValidZone(
  setup: ScannerSetupFactors,
): Pick<ScannerScoreFactor, "points" | "met" | "reason"> {
  const { max } = FACTOR_WEIGHTS.validZone
  if (setup.validZone) {
    return {
      points: max,
      met: true,
      reason: `${setup.zoneType} tagged and price reacting inside zone.`,
    }
  }
  return {
    points: 0,
    met: false,
    reason: "No valid AOI — price between zones or mid-range.",
  }
}

function scoreLiquiditySweep(
  setup: ScannerSetupFactors,
): Pick<ScannerScoreFactor, "points" | "met" | "reason"> {
  const { max } = FACTOR_WEIGHTS.liquiditySweep
  if (setup.liquiditySweep === "Confirmed") {
    return { points: max, met: true, reason: "Liquidity pool swept before reversal." }
  }
  if (setup.liquiditySweep === "Pending") {
    return { points: 7, met: false, reason: "Sweep forming — wait for wick rejection close." }
  }
  return { points: 0, met: false, reason: "No liquidity sweep detected." }
}

function scoreChochBos(
  setup: ScannerSetupFactors,
): Pick<ScannerScoreFactor, "points" | "met" | "reason"> {
  const { max } = FACTOR_WEIGHTS.chochBos
  if (setup.chochBos === "CHoCH" || setup.chochBos === "BOS") {
    return {
      points: max,
      met: true,
      reason: `${setup.chochBos} confirmed on entry timeframe.`,
    }
  }
  if (setup.chochBos === "Pending") {
    return { points: 6, met: false, reason: "Structure shift building — no clean break yet." }
  }
  return { points: 0, met: false, reason: "No CHoCH or BOS on entry TF." }
}

function scoreEngulfing(
  setup: ScannerSetupFactors,
): Pick<ScannerScoreFactor, "points" | "met" | "reason"> {
  const { max } = FACTOR_WEIGHTS.engulfingConfirmation
  if (setup.engulfingConfirmation) {
    return {
      points: max,
      met: true,
      reason: `${setup.confirmationType} closed in trade direction.`,
    }
  }
  return { points: 0, met: false, reason: "No engulfing confirmation candle yet." }
}

function scoreSession(
  setup: ScannerSetupFactors,
): Pick<ScannerScoreFactor, "points" | "met" | "reason"> {
  const { max } = FACTOR_WEIGHTS.sessionAlignment
  if (setup.sessionAlignment) {
    return {
      points: max,
      met: true,
      reason: `Setup aligns with active ${setup.session} session volatility.`,
    }
  }
  return {
    points: 0,
    met: false,
    reason: `Outside optimal session window for ${setup.session}.`,
  }
}

function scoreRiskReward(
  setup: ScannerSetupFactors,
): Pick<ScannerScoreFactor, "points" | "met" | "reason"> {
  const { max } = FACTOR_WEIGHTS.riskReward
  const rr = setup.riskRewardRatio
  if (rr >= 2) {
    return {
      points: max,
      met: true,
      reason: `R:R 1:${rr.toFixed(1)} meets minimum 1:2 rule.`,
    }
  }
  if (rr >= 1.5) {
    return {
      points: 8,
      met: false,
      reason: `R:R 1:${rr.toFixed(1)} below 1:2 minimum — adjust target or skip.`,
    }
  }
  return {
    points: 0,
    met: false,
    reason: `R:R 1:${rr.toFixed(1)} too tight for Precision Flow.`,
  }
}

export function scoreScannerSetup(setup: ScannerSetupFactors): ScannerScoreResult {
  const evaluators: Record<
    ScannerScoreFactorId,
    (s: ScannerSetupFactors) => Pick<ScannerScoreFactor, "points" | "met" | "reason">
  > = {
    dailyH4Alignment: scoreDailyH4Alignment,
    validZone: scoreValidZone,
    liquiditySweep: scoreLiquiditySweep,
    chochBos: scoreChochBos,
    engulfingConfirmation: scoreEngulfing,
    sessionAlignment: scoreSession,
    riskReward: scoreRiskReward,
  }

  const factors: ScannerScoreFactor[] = (
    Object.keys(FACTOR_WEIGHTS) as ScannerScoreFactorId[]
  ).map((id) => {
    const { label, max } = FACTOR_WEIGHTS[id]
    const result = evaluators[id](setup)
    return { id, label, maxPoints: max, ...result }
  })

  const score = Math.min(100, factors.reduce((sum, f) => sum + f.points, 0))
  const grade = scoreFromGrade(score)
  const metCount = factors.filter((f) => f.met).length

  const confidence = Math.min(
    99,
    Math.max(
      0,
      Math.round(score - (grade === "Skip" ? 8 : 0) + (metCount >= 6 ? 2 : 0)),
    ),
  )

  const strengths = factors.filter((f) => f.met).map((f) => f.reason)
  const warnings = factors.filter((f) => !f.met && f.points > 0).map((f) => f.reason)
  const failures = factors.filter((f) => f.points === 0).map((f) => f.reason)

  return {
    score,
    grade,
    confidence,
    factors,
    strengths,
    warnings: [...warnings, ...failures.slice(0, 2)],
  }
}

export function formatRiskReward(ratio: number): string {
  return `1:${ratio.toFixed(1)}`
}

export function scannerGradeToSetupClassification(
  grade: ScannerGrade,
): "A+" | "A" | "B" | "C" | "Skip" {
  return grade
}
