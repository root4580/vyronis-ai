/** Phase 9 — Execution Intelligence Layer contracts */

export const PHASE_9_EXECUTION_PIPELINE = {
  mt5Bridge: { status: "partial" as const, path: "mt5/experts/" },
  tradingViewWebhook: { status: "partial" as const, path: "lib/tradingview/" },
  livePositionSync: { status: "planned" as const },
  slTpTelemetry: { status: "planned" as const },
  spreadSlippageFeed: { status: "planned" as const },
  panicDetection: { status: "partial" as const, path: "lib/trading-os/live-trade-companion.ts" },
  revengeScalingDetection: { status: "partial" as const, path: "lib/trading-os/intervention-layer.ts" },
} as const
