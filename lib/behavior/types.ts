import type { SetupClassification } from "@/lib/trade-coach/setup-score-engine"

export type LeakStatus = "insufficient_data" | "low_confidence" | "active"

export type LeakDimension =
  | "session"
  | "emotion"
  | "confirmation"
  | "risk"
  | "discipline"
  | "setup"
  | "pattern"
  | "timing"

export type BehaviorTrade = {
  id: string
  direction: string
  result: string
  pnl: number
  emotion: string
  emotion_after?: string | null
  session: string | null
  pair: string
  setup: string
  setup_classification: SetupClassification | null
  risk_percent: number | null
  rule_followed: boolean | null
  confirmation_signal: string | null
  mistake_tags?: string | null
  trade_date: string | null
  created_at: string
  timestamp: number
  dayKey: string
  hourOfDay: number
}

export type LeakEvidence = {
  sampleCount: number
  frequencyPercent: number
  segmentLossRate: number
  baselineLossRate: number
  lossRateDelta: number
  estimatedMoneyLost: number
  lookbackTradeCount: number
}

export type PrimaryLeakInsight = {
  id: string
  status: LeakStatus
  confidence: number
  headline: string
  correctiveAction: string
  dimensions: LeakDimension[]
  evidence: LeakEvidence | null
  minTradesRequired: number
  tradesRemaining: number
}

export type LeakEngineInput = {
  trades: Array<{
    id: string
    pair: string
    direction: string
    result: string
    pnl: number
    emotion: string
    emotion_after?: string | null
    session?: string | null
    setup?: string
    setup_classification?: string | null
    risk_percent?: number | null
    rule_followed?: boolean | null
    confirmation_signal?: string | null
    mistake_tags?: string | null
    trade_date?: string | null
    created_at: string
  }>
  maxRiskPerTrade?: number
  lookbackDays?: number
}

export type LeakCandidateEvaluation = {
  id: string
  dimensions: LeakDimension[]
  segment: BehaviorTrade[]
  complement: BehaviorTrade[]
  evidence: LeakEvidence
  confidence: number
  headline: string
  correctiveAction: string
}

export const LEAK_ENGINE_DEFAULTS = {
  lookbackDays: 90,
  minTradesActive: 8,
  minTradesLowConfidence: 5,
  minSegmentCount: 5,
  minConfidenceActive: 55,
  minConfidenceLow: 38,
} as const
