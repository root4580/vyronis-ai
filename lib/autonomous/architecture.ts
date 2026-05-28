import type { IntelligenceLayerId } from "@/lib/autonomous/types"

export type IntelligenceEngineDescriptor = {
  id: string
  layer: IntelligenceLayerId
  description: string
  module: string
  status: "active" | "partial" | "planned"
}

/**
 * Vyronis Autonomous Intelligence — engine registry.
 * Split: vision, reasoning, memory, psychology, scoring, orchestration.
 */
export const INTELLIGENCE_ENGINES: IntelligenceEngineDescriptor[] = [
  {
    id: "command-center-bundle-vision",
    layer: "vision",
    description: "Multi-timeframe chart vision and structure typing",
    module: "lib/intelligence/command-center-bundle-vision-engine.ts",
    status: "active",
  },
  {
    id: "chart-vision-legacy",
    layer: "vision",
    description: "Single-chart vision analysis",
    module: "lib/intelligence/command-center-vision-engine.ts",
    status: "active",
  },
  {
    id: "companion-llm",
    layer: "reasoning",
    description: "Companion dialogue and chart review reasoning",
    module: "lib/intelligence/companion-llm-engine.ts",
    status: "active",
  },
  {
    id: "weighted-confidence",
    layer: "scoring",
    description: "TAKE/CAUTION/SKIP weighted confidence",
    module: "lib/intelligence/weighted-confidence-engine.ts",
    status: "active",
  },
  {
    id: "comparative-memory",
    layer: "memory",
    description: "Journal similarity and comparative recall",
    module: "lib/intelligence/comparative-memory-engine.ts",
    status: "active",
  },
  {
    id: "pattern-fingerprints",
    layer: "memory",
    description: "Win/loss/A+ fingerprint clusters",
    module: "lib/autonomous/pattern-fingerprint-engine.ts",
    status: "active",
  },
  {
    id: "memory-compression",
    layer: "memory",
    description: "Long-term insight compression",
    module: "lib/intelligence/memory-compression.ts",
    status: "active",
  },
  {
    id: "shadow-mode",
    layer: "psychology",
    description: "Passive emotional and discipline monitoring",
    module: "lib/autonomous/shadow-mode-engine.ts",
    status: "active",
  },
  {
    id: "trader-dna",
    layer: "psychology",
    description: "Evolving trader profile and weekly insights",
    module: "lib/autonomous/trader-dna-engine.ts",
    status: "active",
  },
  {
    id: "reflection",
    layer: "psychology",
    description: "Post-trade plan vs execution lessons",
    module: "lib/autonomous/reflection-engine.ts",
    status: "active",
  },
  {
    id: "session-intelligence",
    layer: "reasoning",
    description: "London/NY/Asia session context",
    module: "lib/autonomous/session-intelligence-engine.ts",
    status: "active",
  },
  {
    id: "autonomous-orchestrator",
    layer: "orchestration",
    description: "Composes autonomous snapshot for all surfaces",
    module: "lib/autonomous/orchestrator.ts",
    status: "active",
  },
  {
    id: "cognitive-orchestrator",
    layer: "orchestration",
    description: "Cognitive state, coaching modes, confidence graph, predictions",
    module: "lib/cognitive/orchestrator.ts",
    status: "active",
  },
  {
    id: "trading-os-orchestrator",
    layer: "orchestration",
    description: "Live monitoring, interventions, evolution, replay OS",
    module: "lib/trading-os/orchestrator.ts",
    status: "active",
  },
  {
    id: "adaptive-cognition-orchestrator",
    layer: "orchestration",
    description: "Identity, life context, behavioral modeling, personal OS",
    module: "lib/adaptive-cognition/orchestrator.ts",
    status: "active",
  },
  {
    id: "voice-mode",
    layer: "orchestration",
    description: "Voice coaching interface",
    module: "planned",
    status: "planned",
  },
  {
    id: "mt5-bridge",
    layer: "orchestration",
    description: "MT5 EA live sync and execution telemetry",
    module: "mt5/experts",
    status: "partial",
  },
  {
    id: "tradingview-live",
    layer: "vision",
    description: "TradingView live signal sync",
    module: "supabase/013-tradingview-signals.sql",
    status: "planned",
  },
]

export function enginesByLayer(layer: IntelligenceLayerId): IntelligenceEngineDescriptor[] {
  return INTELLIGENCE_ENGINES.filter((e) => e.layer === layer)
}
