import type { CompanionConversationalState } from "@/lib/intelligence/conversational-types"
import type { TraderResponseMode } from "@/lib/intelligence/trader-response-mode"
import { TRADER_MODE_LABELS } from "@/lib/intelligence/trader-response-mode"
import type {
  AdaptiveCoachingMode,
  AdaptiveCoachingSnapshot,
  CognitiveEngineInput,
  CognitiveStateSnapshot,
} from "@/lib/cognitive/types"

export function resolveAdaptiveCoaching(input: {
  cognitive: CognitiveEngineInput
  state: CognitiveStateSnapshot
}): AdaptiveCoachingSnapshot {
  const { context } = input.cognitive
  const { state } = input
  const shadow = context.autonomous?.shadow
  const nearLimit =
    context.memory.snapshot.todayTradeCount >= context.settings.max_trades_per_day
  const nearDrawdown =
    context.risk.todayLossPercent >= context.settings.daily_drawdown_limit * 0.75

  let mode: AdaptiveCoachingMode = "calm_analytical"
  let responseMode: TraderResponseMode = "analytical"
  let companionState: CompanionConversationalState = "analytical"
  let headline = "Calm analytical mode"
  let toneGuide =
    "Synthesize structure clearly — HTF/LTF, one journal line, verdict. Conversation stays measured."
  let coachingFocus = "Clarity and alignment"
  let maxParagraphs = 3

  if (state.primary === "revenge_driven" || (shadow?.revengeTradingSignal ?? 0) >= 40) {
    mode = "anti_revenge"
    responseMode = "strict_risk"
    companionState = "protective"
    headline = "Anti-revenge mode"
    toneGuide =
      "Direct, zero tolerance for reaction trades. Name the revenge pattern. Do not validate impulsive entries."
    coachingFocus = "Break revenge loop before any entry"
    maxParagraphs = 2
  } else if (
    state.primary === "impulsive" ||
    state.primary === "euphoric" ||
    shadow?.overallRiskLevel === "critical"
  ) {
    mode = "emotional_reset"
    responseMode = "calm_reflection"
    companionState = "reflective"
    headline = "Emotional reset coach"
    toneGuide =
      "Slow down. Validate emotion without pushing trades. One reset step, then reassess."
    coachingFocus = "Emotional stabilization"
    maxParagraphs = 2
  } else if (nearLimit || nearDrawdown || state.primary === "fatigued") {
    mode = "strict_funded_guardian"
    responseMode = "strict_risk"
    companionState = "protective"
    headline = "Funded-account guardian"
    toneGuide =
      "Protect capital like a funded account manager. Rules, limits, and preservation first."
    coachingFocus = "Capital preservation"
    maxParagraphs = 2
  } else if (state.primary === "disciplined" || state.primary === "focused") {
    mode = "calm_analytical"
    responseMode = "analytical"
    companionState = "analytical"
    headline = "Focused analytical mode"
    toneGuide =
      "Precise, efficient coaching — respect their process. Tight synthesis, strong verdict."
    coachingFocus = "Execution refinement"
    maxParagraphs = 3
  } else if (
    context.recentTrades.slice(0, 4).filter((t: { result: string }) => t.result === "LOSS")
      .length >= 2
  ) {
    mode = "confidence_restoration"
    responseMode = "calm_reflection"
    companionState = "reflective"
    headline = "Confidence restoration"
    toneGuide =
      "Rebuild confidence from process, not P&L. One win from discipline, not outcome chasing."
    coachingFocus = "Process-based confidence"
    maxParagraphs = 2
  } else {
    mode = "calm_analytical"
    responseMode = "coach"
    companionState = "calm"
    headline = "Companion coach"
    toneGuide =
      "Warm, intelligent companion — conversation first, light stats unless asked."
    coachingFocus = "General coaching"
    maxParagraphs = 2
  }

  return {
    mode,
    responseMode,
    headline,
    toneGuide: `${toneGuide} (${TRADER_MODE_LABELS[responseMode]} surface).`,
    coachingFocus,
    maxParagraphs,
  }
}
