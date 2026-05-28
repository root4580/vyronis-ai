import { buildTradeReplayIntelligence } from "@/lib/cognitive/trade-replay-intelligence"
import type { ReflectionTradeInput } from "@/lib/autonomous/reflection-engine"
import type {
  AiReplaySimulation,
  ReplayScenarioId,
  ReplayScenarioResult,
  TradingOsEngineInput,
} from "@/lib/trading-os/types"

const SCENARIO_QUESTIONS: Record<ReplayScenarioId, string> = {
  respect_sl: "What would happen if SL was respected?",
  wait_confirmation: "What if entry waited for confirmation?",
  reduce_size: "What if size was cut 50% on this setup?",
  no_revenge_entry: "What if this revenge entry never happened?",
  follow_plan: "What if execution matched the plan exactly?",
}

function buildScenario(
  id: ReplayScenarioId,
  trade: ReflectionTradeInput,
  replayLesson: string,
): ReplayScenarioResult {
  const result = trade.result
  const impulsive = /fomo|revenge|anxious|euphoric/i.test(String(trade.emotion || ""))

  switch (id) {
    case "respect_sl":
      return {
        scenarioId: id,
        question: SCENARIO_QUESTIONS[id],
        narrative:
          result === "LOSS" && !trade.rule_followed
            ? "Honoring SL likely caps loss at planned R — avoids tail-risk extension."
            : "SL discipline preserves process even when outcome is flat.",
        processImpact: "Protects equity curve volatility; improves discipline score.",
        estimatedOutcomeShift: result === "LOSS" ? "better" : "same",
        confidence: 72,
      }
    case "wait_confirmation":
      return {
        scenarioId: id,
        question: SCENARIO_QUESTIONS[id],
        narrative: impulsive
          ? "Waiting for LTF confirmation often filters impulse entries with weak structure."
          : "Extra confirmation may reduce frequency but raises setup quality.",
        processImpact: "Raises entry quality; fewer marginal trades.",
        estimatedOutcomeShift: impulsive ? "better" : "same",
        confidence: 65,
      }
    case "reduce_size":
      return {
        scenarioId: id,
        question: SCENARIO_QUESTIONS[id],
        narrative: "Half size on marginal states keeps you in the game while emotions stabilize.",
        processImpact: "Drawdown depth reduced; psychological pressure lower.",
        estimatedOutcomeShift: result === "LOSS" ? "better" : "same",
        confidence: 70,
      }
    case "no_revenge_entry":
      return {
        scenarioId: id,
        question: SCENARIO_QUESTIONS[id],
        narrative: impulsive
          ? "Skipping revenge entry breaks the loss spiral — highest leverage habit change."
          : "Entry was not tagged revenge; scenario still validates patience.",
        processImpact: "Removes correlated emotional losses.",
        estimatedOutcomeShift: impulsive && result === "LOSS" ? "better" : "same",
        confidence: impulsive ? 78 : 50,
      }
    case "follow_plan":
    default:
      return {
        scenarioId: "follow_plan",
        question: SCENARIO_QUESTIONS.follow_plan,
        narrative: replayLesson,
        processImpact: "Aligns outcome with process — core evolution metric.",
        estimatedOutcomeShift: result === "WIN" ? "same" : "better",
        confidence: 68,
      }
  }
}

export function buildAiReplaySimulation(input: {
  os: TradingOsEngineInput
  trade?: ReflectionTradeInput | null
}): AiReplaySimulation | null {
  const trade =
    input.trade ??
    (input.os.context.recentTrades[0]
      ? {
          id: input.os.context.recentTrades[0].id,
          pair: input.os.context.recentTrades[0].pair,
          direction: input.os.context.recentTrades[0].direction,
          result: input.os.context.recentTrades[0].result,
          pnl: input.os.context.recentTrades[0].pnl,
          emotion: input.os.context.recentTrades[0].emotion,
          session: input.os.context.recentTrades[0].session,
          rule_followed: input.os.context.recentTrades[0].rule_followed,
        }
      : null)

  if (!trade) return null

  const replay = buildTradeReplayIntelligence(trade)
  const marketContext =
    input.os.context.cognitive?.marketEnvironment.narrative ??
    input.os.context.autonomous?.session.narrative ??
    "Market context not tagged on this trade."

  const scenarios: ReplayScenarioResult[] = (
    ["respect_sl", "wait_confirmation", "reduce_size", "no_revenge_entry", "follow_plan"] as ReplayScenarioId[]
  ).map((id) => buildScenario(id, trade, replay.lesson))

  return {
    tradeId: trade.id ?? null,
    reconstruction: {
      marketContext,
      emotionalState: replay.emotionalDeviationMoments[0] ?? String(trade.emotion || "neutral"),
      executionTiming: replay.actualOutcome,
      planDeviation: replay.whatChanged,
    },
    scenarios,
    primaryLesson: replay.lesson,
  }
}

export function runReplayScenario(input: {
  trade: ReflectionTradeInput
  scenarioId: ReplayScenarioId
  context?: TradingOsEngineInput["context"]
}): ReplayScenarioResult {
  const replay = buildTradeReplayIntelligence(input.trade)
  return buildScenario(input.scenarioId, input.trade, replay.lesson)
}
