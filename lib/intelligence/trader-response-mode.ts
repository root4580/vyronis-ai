import type { CompanionIntent } from "@/lib/intelligence/companion-intent-engine"
import type { CommandCenterVisionAnalysis } from "@/lib/intelligence/command-center-vision-engine"
import type { CompanionConversationalState } from "@/lib/intelligence/conversational-types"
import type {
  FullTraderContext,
  TradeDecisionResult,
} from "@/lib/intelligence/intelligence-types"
import { detectTraderPatterns } from "@/lib/intelligence/pattern-intelligence-engine"

export type TraderResponseMode =
  | "analytical"
  | "coach"
  | "strict_risk"
  | "calm_reflection"

export type TraderModeResolution = {
  mode: TraderResponseMode
  companionState: CompanionConversationalState
  toneGuide: string
  maxParagraphs: number
}

export function resolveTraderResponseMode(input: {
  context: FullTraderContext
  decision?: TradeDecisionResult | null
  chartVision?: CommandCenterVisionAnalysis | null
  intent?: CompanionIntent | string
}): TraderModeResolution {
  const { context, decision, chartVision } = input
  const intent = input.intent as CompanionIntent | undefined

  if (intent === "casual_conversation") {
    return {
      mode: "coach",
      companionState: "calm",
      toneGuide:
        "Warm trading companion — conversation first. One short question. No stats unless asked.",
      maxParagraphs: 2,
    }
  }

  if (intent === "emotional_check_in") {
    return {
      mode: "calm_reflection",
      companionState: "reflective",
      toneGuide:
        "Calm psychologist — validate first, slow down, no trade pushing. Short and human.",
      maxParagraphs: 2,
    }
  }

  if (intent === "post_trade_review") {
    return {
      mode: "calm_reflection",
      companionState: "reflective",
      toneGuide: "Reflective debrief — plan vs execution, one lesson, no shame.",
      maxParagraphs: 2,
    }
  }

  const adaptive = context.adaptiveCognition
  const cognitive = context.cognitive

  if (adaptive && intent !== "market_check" && intent !== "analytics_pattern") {
    const challenge = adaptive.companion.challengeLevel
    const companionState =
      challenge === "direct"
        ? "protective"
        : challenge === "socratic"
          ? "reflective"
          : cognitive?.coaching.mode === "calm_analytical"
            ? "analytical"
            : "calm"

    const mode =
      challenge === "direct"
        ? "strict_risk"
        : challenge === "socratic"
          ? "calm_reflection"
          : cognitive?.coaching.responseMode ?? "coach"

    return {
      mode,
      companionState,
      toneGuide: `${adaptive.companion.communicationStyle} ${adaptive.companion.memoryTone}`,
      maxParagraphs: challenge === "direct" ? 2 : 3,
    }
  }

  if (cognitive) {
    const companionState = cognitive.coaching.mode === "strict_funded_guardian" ||
      cognitive.coaching.mode === "anti_revenge"
      ? "protective"
      : cognitive.coaching.mode === "emotional_reset" ||
          cognitive.coaching.mode === "confidence_restoration"
        ? "reflective"
        : cognitive.coaching.mode === "calm_analytical"
          ? "analytical"
          : "calm"

    return {
      mode: cognitive.coaching.responseMode,
      companionState,
      toneGuide: cognitive.coaching.toneGuide,
      maxParagraphs: cognitive.coaching.maxParagraphs,
    }
  }
  const patterns = detectTraderPatterns(context)
  const hasCriticalRisk =
    decision?.recommendation === "SKIP" ||
    patterns.some((p) => p.id === "overtrading" || p.id === "emotional_tilt")
  const recentLossStreak =
    context.recentTrades.slice(0, 4).filter((t) => t.result === "LOSS").length >= 3
  const volatile = context.emotionalState.trend === "volatile"
  const nearDrawdown =
    context.risk.todayLossPercent >= context.settings.daily_drawdown_limit * 0.75
  const setupScore =
    chartVision?.bundle?.mtfAnalysis?.visionScore ??
    chartVision?.vision?.visionScore ??
    decision?.confidence ??
    55

  if (volatile || recentLossStreak || input.intent === "post_trade_review") {
    return {
      mode: "calm_reflection",
      companionState: "reflective",
      toneGuide:
        "Calm reflection — validate feelings, one lesson, no pushing trades. Short sentences.",
      maxParagraphs: 2,
    }
  }

  if (hasCriticalRisk || nearDrawdown || context.memory.snapshot.todayTradeCount >= context.settings.max_trades_per_day) {
    return {
      mode: "strict_risk",
      companionState: "protective",
      toneGuide:
        "Strict risk manager — direct, protective, prioritize capital preservation. No hype.",
      maxParagraphs: 2,
    }
  }

  if (chartVision || input.intent === "pre_trade_coaching" || setupScore >= 60) {
    return {
      mode: "analytical",
      companionState: "analytical",
      toneGuide:
        "Analytical coach — synthesize HTF/LTF in plain English, one journal comparison, then verdict. No per-timeframe laundry list.",
      maxParagraphs: 3,
    }
  }

  return {
    mode: "coach",
    companionState: "calm",
    toneGuide:
      "Trading companion — conversation first, one natural question, light on stats unless asked.",
    maxParagraphs: 2,
  }
}

export const TRADER_MODE_LABELS: Record<TraderResponseMode, string> = {
  analytical: "Analytical",
  coach: "Coach",
  strict_risk: "Risk manager",
  calm_reflection: "Reflection",
}
