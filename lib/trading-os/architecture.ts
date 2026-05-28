export type TradingOsLayerId =
  | "monitoring"
  | "intervention"
  | "evolution"
  | "replay"
  | "strategy"
  | "companion"
  | "voice"
  | "timeline"
  | "orchestration"

export type TradingOsEngineDescriptor = {
  id: string
  layer: TradingOsLayerId
  description: string
  module: string
  status: "active" | "partial" | "planned"
}

export const TRADING_OS_ENGINES: TradingOsEngineDescriptor[] = [
  {
    id: "live-session-monitor",
    layer: "monitoring",
    description: "Session, volatility, overtrading, emotional drift alerts",
    module: "lib/trading-os/live-session-monitor.ts",
    status: "active",
  },
  {
    id: "intervention-layer",
    layer: "intervention",
    description: "Stand down, size reduction, reflection gates",
    module: "lib/trading-os/intervention-layer.ts",
    status: "active",
  },
  {
    id: "trader-evolution",
    layer: "evolution",
    description: "Discipline, emotion, execution, setup trends",
    module: "lib/trading-os/trader-evolution.ts",
    status: "active",
  },
  {
    id: "replay-simulator",
    layer: "replay",
    description: "Counterfactual what-if scenarios on closed trades",
    module: "lib/trading-os/replay-simulator.ts",
    status: "active",
  },
  {
    id: "strategy-intelligence",
    layer: "strategy",
    description: "Setup edge, weak environments, adaptive guidance",
    module: "lib/trading-os/strategy-intelligence.ts",
    status: "active",
  },
  {
    id: "live-trade-companion",
    layer: "companion",
    description: "In-trade execution and panic monitoring",
    module: "lib/trading-os/live-trade-companion.ts",
    status: "partial",
  },
  {
    id: "voice-foundation",
    layer: "voice",
    description: "Voice session contracts and capability registry",
    module: "lib/trading-os/voice-foundation.ts",
    status: "planned",
  },
  {
    id: "intelligence-timeline",
    layer: "timeline",
    description: "Chronological memory stream",
    module: "lib/trading-os/intelligence-timeline.ts",
    status: "active",
  },
  {
    id: "trading-os-orchestrator",
    layer: "orchestration",
    description: "Unified Autonomous Trading OS snapshot",
    module: "lib/trading-os/orchestrator.ts",
    status: "active",
  },
]
