import type { CoachMtfTimeframe } from "@/lib/coach/mtf-constants"
import type { ChartAnnotation, ReplayOverlayMoment } from "@/lib/chart-annotations/types"
import { MTF_SLOTS } from "@/lib/coach/mtf-constants"
import { getMtfScreenshotsFromSession } from "@/lib/trade-coach/mtf-session"
import type {
  PlannedVsActualComparison,
  PostTradeCoachResult,
  PreTradePlannedContext,
  TradeCoachFeedbackRecord,
  TradeCoachSessionWithMessages,
} from "@/lib/trade-coach/types"
import type { StrategyPlaybookMatchResult } from "@/lib/strategy/types"

export type ExecutionReplayPhase =
  | "pre_trade_plan"
  | "ai_analysis"
  | "entry_execution"
  | "emotion_drift"
  | "rule_violations"
  | "trade_close"
  | "ai_debrief"

export type ExecutionReplayTone = "success" | "warning" | "danger" | "info"

export type ExecutionReplayScreenshot = {
  label: string
  url: string
  timeframe?: CoachMtfTimeframe
  annotations?: ChartAnnotation[]
  replayMoment?: ReplayOverlayMoment
  overlayCommentary?: string[]
}

export type ExecutionReplayEvent = {
  id: ExecutionReplayPhase
  step: number
  title: string
  subtitle: string
  tone: ExecutionReplayTone
  aiCommentary: string
  details: string[]
  warnings: string[]
  screenshots: ExecutionReplayScreenshot[]
  metrics: Record<string, string>
}

export type ExecutionDriftItem = {
  id: string
  label: string
  severity: "warning" | "critical"
  description: string
}

export type ExecutionReplayAnalytics = {
  executionQuality: number
  disciplineQuality: number
  emotionalStability: number
  ruleAdherence: number
  aiConfidence: number | null
  outcomeMatchedPrediction: boolean | null
  summary: string
}

export type ExecutionReplayCandleSentiment =
  | "bullish"
  | "bearish"
  | "neutral"
  | "warning"
  | "danger"

export type ExecutionReplayCandleState = {
  id: string
  phase: ExecutionReplayPhase
  phaseStep: number
  globalStep: number
  label: string
  sentiment: ExecutionReplayCandleSentiment
  bodyPercent: number
  direction: "up" | "down" | "doji"
}

export type ExecutionReplayTimelineMarkerType =
  | "emotion"
  | "rule_violation"
  | "rr_collapse"
  | "entry"
  | "exit"
  | "ai"

export type ExecutionReplayTimelineMarker = {
  id: string
  globalStep: number
  type: ExecutionReplayTimelineMarkerType
  label: string
  shortLabel: string
  severity: "info" | "warning" | "critical"
}

export type ExecutionReplayEntryComparison = {
  plannedEntry: string
  actualEntry: string
  plannedStopLoss: string
  actualStopLoss: string
  plannedTakeProfit: string
  actualTakeProfit: string
  plannedRr: string | null
  actualRr: string | null
  entryAligned: boolean
  stopAligned: boolean
  targetAligned: boolean
  summary: string
}

export type ExecutionReplayChangeItem = {
  field: string
  planned: string
  actual: string
  aligned: boolean
  impact: "neutral" | "warning" | "critical"
  note: string
}

export type ExecutionReplaySessionRecap = {
  overallScore: number
  grade: "A" | "B" | "C" | "D" | "F"
  headline: string
  verdict: "process_win" | "process_loss" | "mixed" | "review"
  pillars: Array<{ label: string; score: number }>
}

export type ExecutionReplayRrCollapse = {
  plannedRr: number
  actualRr: number
  delta: number
  severity: "warning" | "critical"
  message: string
}

export type ExecutionReplayResult = {
  version: 1
  tradeId: string
  hasCoachSession: boolean
  events: ExecutionReplayEvent[]
  drifts: ExecutionDriftItem[]
  analytics: ExecutionReplayAnalytics
  comparisons: PlannedVsActualComparison[]
  candles: ExecutionReplayCandleState[]
  markers: ExecutionReplayTimelineMarker[]
  entryComparison: ExecutionReplayEntryComparison
  changes: ExecutionReplayChangeItem[]
  sessionRecap: ExecutionReplaySessionRecap
  rrCollapse: ExecutionReplayRrCollapse | null
}

export type ExecutionReplayTrade = {
  id: string
  pair: string
  direction: string
  result: string
  pnl: number
  emotion: string
  emotion_after?: string | null
  setup: string
  strategy_name: string | null
  risk_percent: number | null
  rule_followed: boolean | null
  session: string | null
  trade_date?: string | null
  created_at?: string
  confirmation_signal?: string | null
  trade_notes?: string | null
  mistake_tags?: string | null
  entry_price?: number | null
  stop_loss?: number | null
  take_profit?: number | null
  risk_reward?: number | null
  screenshot_url?: string | null
}

export type BuildExecutionReplayInput = {
  trade: ExecutionReplayTrade
  session: TradeCoachSessionWithMessages | null
  feedback: TradeCoachFeedbackRecord | null
  postTradeAnalysis: PostTradeCoachResult | null
  maxRiskPerTrade: number
}
