export type AdaptiveCognitionLayerId =
  | "identity"
  | "life"
  | "behavioral"
  | "performance"
  | "personal_os"
  | "strategic"
  | "companion"
  | "insights"
  | "ecosystem"
  | "orchestration"

export type AdaptiveCognitionEngineDescriptor = {
  id: string
  layer: AdaptiveCognitionLayerId
  description: string
  module: string
  status: "active" | "partial" | "planned"
}

export const ADAPTIVE_COGNITION_ENGINES: AdaptiveCognitionEngineDescriptor[] = [
  {
    id: "identity-layer",
    layer: "identity",
    description: "Who the trader is becoming — confidence, discipline, resilience",
    module: "lib/adaptive-cognition/identity-layer.ts",
    status: "active",
  },
  {
    id: "life-context",
    layer: "life",
    description: "Sleep, stress, focus correlated with performance",
    module: "lib/adaptive-cognition/life-context.ts",
    status: "partial",
  },
  {
    id: "behavioral-modeling",
    layer: "behavioral",
    description: "Burnout, revenge spirals, discipline streaks, instability prediction",
    module: "lib/adaptive-cognition/behavioral-modeling.ts",
    status: "active",
  },
  {
    id: "performance-intelligence",
    layer: "performance",
    description: "Luck vs skill vs discipline attribution",
    module: "lib/adaptive-cognition/performance-intelligence.ts",
    status: "active",
  },
  {
    id: "personal-os",
    layer: "personal_os",
    description: "Reflection, focus, recovery, journaling flows",
    module: "lib/adaptive-cognition/personal-os.ts",
    status: "active",
  },
  {
    id: "strategic-thinking",
    layer: "strategic",
    description: "Scaling, capital preservation, milestones",
    module: "lib/adaptive-cognition/strategic-thinking.ts",
    status: "active",
  },
  {
    id: "companion-evolution",
    layer: "companion",
    description: "Evolving tone, challenge level, irrational thinking checks",
    module: "lib/adaptive-cognition/companion-evolution.ts",
    status: "active",
  },
  {
    id: "insight-generation",
    layer: "insights",
    description: "Proactive pattern insights from longitudinal data",
    module: "lib/adaptive-cognition/insight-generation.ts",
    status: "active",
  },
  {
    id: "adaptive-orchestrator",
    layer: "orchestration",
    description: "Unified adaptive cognition snapshot",
    module: "lib/adaptive-cognition/orchestrator.ts",
    status: "active",
  },
]
