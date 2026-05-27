import type { CoachRedFlag, PreTradePlannedContext } from "@/lib/trade-coach/types"

const BEARISH_SIGNALS = new Set([
  "Head and Shoulders",
  "Double Top",
  "Triple Top",
  "Bearish Engulfing",
  "Evening Star",
  "Shooting Star",
  "Bear Flag",
  "Descending Triangle",
  "Resistance Rejection",
])

const BULLISH_SIGNALS = new Set([
  "Inverse Head and Shoulders",
  "Double Bottom",
  "Triple Bottom",
  "Bullish Engulfing",
  "Morning Star",
  "Hammer",
  "Bull Flag",
  "Ascending Triangle",
  "Support Rejection",
])

const RISKY_EMOTIONS = new Set(["FOMO", "Revenge", "Euphoric", "Anxious", "Fearful", "Greed"])

function parsePercent(value: string | undefined): number | null {
  if (!value) return null
  const parsed = parseFloat(value.replace("%", "").trim())
  return Number.isFinite(parsed) ? parsed : null
}

function isCounterTrend(context: PreTradePlannedContext): boolean {
  const signal = context.confirmation_signal
  const direction = context.direction?.toUpperCase()
  if (!signal || !direction) return false

  const bearish =
    BEARISH_SIGNALS.has(signal) ||
    signal.toLowerCase().includes("bearish") ||
    signal.toLowerCase().includes("resistance")
  const bullish =
    BULLISH_SIGNALS.has(signal) ||
    signal.toLowerCase().includes("bullish") ||
    signal.toLowerCase().includes("support")

  if (direction === "BUY" && bearish && !bullish) return true
  if (direction === "SELL" && bullish && !bearish) return true
  return false
}

export function detectCoachRedFlags(
  context: PreTradePlannedContext,
  responses: Record<string, string>,
  maxRiskPerTrade: number,
): CoachRedFlag[] {
  const flags: CoachRedFlag[] = []
  const emotion = responses.emotional_state || context.emotion || ""
  const plannedRisk =
    parsePercent(responses.planned_risk) ?? parsePercent(context.risk_percent)
  const ruleCheck = responses.rule_check?.toLowerCase()

  if (emotion === "Euphoric") {
    flags.push({
      id: "euphoric",
      severity: "critical",
      message: "Euphoric state detected — overconfidence often leads to oversized risk.",
    })
  }

  if (emotion === "Revenge") {
    flags.push({
      id: "revenge",
      severity: "critical",
      message: "Revenge trading detected — step away until you are calm and objective.",
    })
  }

  if (emotion === "FOMO") {
    flags.push({
      id: "fomo",
      severity: "critical",
      message: "FOMO detected — chasing price rarely matches your planned edge.",
    })
  }

  if (plannedRisk !== null && plannedRisk > maxRiskPerTrade) {
    flags.push({
      id: "over_risking",
      severity: "critical",
      message: `Over-risking detected — planned ${plannedRisk}% exceeds your ${maxRiskPerTrade}% max.`,
    })
  }

  if (isCounterTrend(context)) {
    flags.push({
      id: "countertrend",
      severity: "warning",
      message: "Countertrend setup detected — signal conflicts with trade direction.",
    })
  }

  if (ruleCheck === "no" || ruleCheck === "false") {
    flags.push({
      id: "rules_break",
      severity: "critical",
      message: "You flagged a rule break before entry — discipline risk is elevated.",
    })
  } else if (RISKY_EMOTIONS.has(emotion) && emotion !== "FOMO" && emotion !== "Revenge" && emotion !== "Euphoric") {
    flags.push({
      id: "emotional_risk",
      severity: "warning",
      message: `${emotion} emotional state may reduce execution quality.`,
    })
  }

  return flags
}
