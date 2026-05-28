import type { IntelligenceEcosystem } from "@/lib/adaptive-cognition/types"

export const ADAPTIVE_COGNITION_PHILOSOPHY =
  "The market is the mirror. The real system being optimized is the human."

export function buildIntelligenceEcosystem(): IntelligenceEcosystem {
  return {
    philosophy: ADAPTIVE_COGNITION_PHILOSOPHY,
    crossAccountReady: false,
    capabilities: [
      {
        id: "mobile",
        surface: "mobile",
        status: "planned",
        description: "Companion, alerts, life context, voice journaling on the go.",
      },
      {
        id: "desktop",
        surface: "desktop",
        status: "partial",
        description: "Web Command Center + evolution dashboard.",
      },
      {
        id: "voice",
        surface: "voice",
        status: "planned",
        description: "Real-time coaching and post-session review calls.",
      },
      {
        id: "wearable",
        surface: "wearable",
        status: "planned",
        description: "Stress and recovery nudges linked to intervention layer.",
      },
      {
        id: "replay",
        surface: "replay",
        status: "active",
        description: "AI replay simulator with counterfactual scenarios.",
      },
      {
        id: "live_market",
        surface: "live_market",
        status: "partial",
        description: "Session monitoring + TradingView signal sync.",
      },
      {
        id: "portfolio",
        surface: "portfolio",
        status: "planned",
        description: "Cross-account intelligence and portfolio cognition.",
      },
    ],
  }
}
