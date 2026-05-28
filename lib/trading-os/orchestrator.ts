import { monitorLiveSession } from "@/lib/trading-os/live-session-monitor"
import { evaluateAutonomousIntervention } from "@/lib/trading-os/intervention-layer"
import { buildTraderEvolution } from "@/lib/trading-os/trader-evolution"
import { buildAiReplaySimulation } from "@/lib/trading-os/replay-simulator"
import { buildStrategyIntelligence } from "@/lib/trading-os/strategy-intelligence"
import { buildLiveTradeCompanion } from "@/lib/trading-os/live-trade-companion"
import { buildVoiceCompanionFoundation } from "@/lib/trading-os/voice-foundation"
import { buildIntelligenceTimeline } from "@/lib/trading-os/intelligence-timeline"
import type { FullTraderContext } from "@/lib/intelligence/intelligence-types"
import type { TradingOsEngineInput, TradingOsSnapshot } from "@/lib/trading-os/types"

export function enrichTraderContextWithTradingOs(
  context: FullTraderContext,
  options?: Omit<TradingOsEngineInput, "context">,
): FullTraderContext {
  return {
    ...context,
    tradingOs: buildTradingOsSnapshot({
      context,
      lastKnownSession:
        options?.lastKnownSession ?? context.tradingOs?.liveSession.activeSession ?? null,
      focusTradeId: options?.focusTradeId,
    }),
  }
}

export function buildTradingOsSnapshot(input: TradingOsEngineInput): TradingOsSnapshot {
  const liveSession = monitorLiveSession(input)
  const intervention = evaluateAutonomousIntervention({ os: input, liveSession })
  const evolution = buildTraderEvolution(input)
  const replay = buildAiReplaySimulation({ os: input })
  const strategy = buildStrategyIntelligence(input)
  const liveCompanion = buildLiveTradeCompanion(input)
  const timeline = buildIntelligenceTimeline(input)
  const voice = buildVoiceCompanionFoundation()

  const proactiveHeadline = intervention.active
    ? intervention.headline
    : liveSession.alerts[0]?.message ??
      evolution.weeklyReport.slice(0, 120) ??
      "Vyronis OS monitoring — trade your playbook."

  return {
    computedAt: new Date().toISOString(),
    liveSession,
    intervention,
    evolution,
    replay,
    strategy,
    liveCompanion,
    timeline,
    voice,
    capabilities: {
      liveMonitoring: "active",
      interventions: "active",
      evolutionDashboard: "active",
      replaySimulator: "active",
      strategyIntelligence: "active",
      liveTradeCompanion: "partial",
      voiceCompanion: "planned",
      intelligenceTimeline: "active",
    },
    proactiveHeadline,
  }
}
