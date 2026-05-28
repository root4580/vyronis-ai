import { detectTraderPatterns } from "@/lib/intelligence/pattern-intelligence-engine"
import type { FullTraderContext } from "@/lib/intelligence/intelligence-types"
import type {
  CognitiveEngineInput,
  CognitiveStateSnapshot,
  CognitiveTraderState,
} from "@/lib/cognitive/types"

const IMPULSIVE = new Set(["fomo", "revenge", "euphoric", "anxious", "tilted", "impulsive", "frustrated"])

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

function scoreStates(input: CognitiveEngineInput): Map<CognitiveTraderState, number> {
  const { context } = input
  const scores = new Map<CognitiveTraderState, number>([
    ["calm", 40],
    ["focused", 35],
    ["disciplined", 30],
    ["impulsive", 0],
    ["revenge_driven", 0],
    ["fatigued", 10],
    ["euphoric", 5],
  ])

  const emotion = String(
    context.activePlannedContext?.emotion ||
      context.emotionalState.dominantEmotion ||
      "",
  ).toLowerCase()

  if (IMPULSIVE.has(emotion)) {
    scores.set("impulsive", (scores.get("impulsive") ?? 0) + 35)
    if (emotion === "revenge") scores.set("revenge_driven", (scores.get("revenge_driven") ?? 0) + 45)
    if (emotion === "euphoric") scores.set("euphoric", (scores.get("euphoric") ?? 0) + 40)
  }

  if (context.emotionalState.trend === "volatile") {
    scores.set("impulsive", (scores.get("impulsive") ?? 0) + 25)
    scores.set("calm", (scores.get("calm") ?? 0) - 20)
  }

  if (context.emotionalState.impulsiveCount >= 2) {
    scores.set("impulsive", (scores.get("impulsive") ?? 0) + 20)
  }

  const patterns = detectTraderPatterns(context)
  if (patterns.some((p) => p.id === "reversal_chasing")) {
    scores.set("revenge_driven", (scores.get("revenge_driven") ?? 0) + 30)
  }
  if (patterns.some((p) => p.id === "overtrading")) {
    scores.set("fatigued", (scores.get("fatigued") ?? 0) + 28)
    scores.set("impulsive", (scores.get("impulsive") ?? 0) + 15)
  }

  const todayCount = context.memory.snapshot.todayTradeCount
  const maxTrades = context.settings.max_trades_per_day
  if (todayCount >= maxTrades - 1) {
    scores.set("fatigued", (scores.get("fatigued") ?? 0) + 22)
  }

  const recent = context.recentTrades.slice(0, 6)
  const wins = recent.filter((t) => t.result === "WIN").length
  if (recent.length >= 4 && wins / recent.length >= 0.65) {
    scores.set("euphoric", (scores.get("euphoric") ?? 0) + 18)
  }
  if (recent.length >= 3 && recent.filter((t) => t.result === "LOSS").length >= 2) {
    scores.set("revenge_driven", (scores.get("revenge_driven") ?? 0) + 22)
    scores.set("fatigued", (scores.get("fatigued") ?? 0) + 12)
  }

  const rulesOk = context.dailyRules.filter((r) => r.checked).length
  const rulesTotal = context.dailyRules.length
  if (rulesTotal > 0 && rulesOk / rulesTotal >= 0.8) {
    scores.set("disciplined", (scores.get("disciplined") ?? 0) + 25)
    scores.set("focused", (scores.get("focused") ?? 0) + 20)
  }

  if (input.recentMessageTone === "anxious" || input.recentMessageTone === "rushed") {
    scores.set("impulsive", (scores.get("impulsive") ?? 0) + 15)
  }
  if (context.emotionalIntelligence?.activeSignals.includes("hesitation")) {
    scores.set("fatigued", (scores.get("fatigued") ?? 0) + 12)
  }
  if (context.emotionalIntelligence?.activeSignals.includes("overconfidence")) {
    scores.set("euphoric", (scores.get("euphoric") ?? 0) + 22)
  }
  if (context.emotionalIntelligence?.activeSignals.includes("execution_discipline")) {
    scores.set("disciplined", (scores.get("disciplined") ?? 0) + 20)
  }
  if (input.recentMessageTone === "calm") {
    scores.set("calm", (scores.get("calm") ?? 0) + 15)
    scores.set("focused", (scores.get("focused") ?? 0) + 10)
  }

  const shadow = context.autonomous?.shadow
  if (shadow && shadow.emotionalRiskScore >= 70) {
    scores.set("impulsive", (scores.get("impulsive") ?? 0) + 20)
    scores.set("calm", (scores.get("calm") ?? 0) - 15)
  }
  if (shadow && shadow.disciplineConfidence >= 72) {
    scores.set("disciplined", (scores.get("disciplined") ?? 0) + 18)
  }

  return scores
}

export function evaluateCognitiveState(input: CognitiveEngineInput): CognitiveStateSnapshot {
  const scores = scoreStates(input)
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1])
  const primary = ranked[0]?.[0] ?? "calm"
  const secondary = ranked[1] && ranked[1][1] >= ranked[0][1] * 0.65 ? ranked[1][0] : null

  const drivers: string[] = []
  if (input.context.memory.snapshot.todayTradeCount >= input.context.settings.max_trades_per_day) {
    drivers.push("Near daily trade limit")
  }
  if (input.context.emotionalState.trend === "volatile") {
    drivers.push("Volatile emotional trend in journal")
  }
  if (detectTraderPatterns(input.context).some((p) => p.id === "overtrading")) {
    drivers.push("Overtrading pattern active")
  }
  if (input.context.autonomous?.shadow.overallRiskLevel === "critical") {
    drivers.push("Shadow risk critical")
  }

  const riskyStates: CognitiveTraderState[] = [
    "impulsive",
    "revenge_driven",
    "fatigued",
    "euphoric",
  ]
  const isRisky = riskyStates.includes(primary)

  let verdictStrictness = isRisky ? 78 : primary === "disciplined" || primary === "focused" ? 42 : 55
  let riskPermission = isRisky ? 28 : primary === "calm" ? 72 : 55

  if (input.context.risk.todayLossPercent >= input.context.settings.daily_drawdown_limit * 0.8) {
    verdictStrictness = clamp(verdictStrictness + 15)
    riskPermission = clamp(riskPermission - 20)
    drivers.push("Near drawdown limit")
  }

  const stability = clamp(
    100 -
      (riskyStates.includes(primary) ? 35 : 0) -
      (secondary && riskyStates.includes(secondary) ? 15 : 0) -
      input.context.emotionalState.impulsiveCount * 8,
  )

  const narrative = isRisky
    ? `Cognitive state: ${primary.replace("_", " ")} — Vyronis will use stricter verdicts and protective coaching.`
    : `Cognitive state: ${primary} — process-aligned; standard coaching with measured risk permission.`

  return {
    primary,
    secondary,
    confidence: ranked[0]?.[1] ?? 50,
    stability,
    narrative,
    drivers: drivers.slice(0, 4),
    verdictStrictness,
    riskPermission,
    updatedAt: new Date().toISOString(),
  }
}
