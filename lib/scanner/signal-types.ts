import type {
  ScannerBias,
  ScannerChochBosStatus,
  ScannerGrade,
  ScannerLiquiditySweepStatus,
  ScannerScoreResult,
} from "@/lib/scanner/scoring"

export type ScannerRuleStatus = "pass" | "warn" | "fail"

export type ScannerStrategyRule = {
  id: string
  label: string
  detail: string
  status: ScannerRuleStatus
}

export type ScannerWatchlistPair = {
  id: string
  pair: string
  weeklyBias: ScannerBias
  dailyBias: ScannerBias
  session: string
  aoiReady: boolean
}

export type ScannerSignalStatus = "active" | "watching" | "expired"

export type ScannerLiveSignal = {
  id: string
  pair: string
  direction: "BUY" | "SELL"
  grade: ScannerGrade
  score: number
  confidence: number
  scoring: ScannerScoreResult
  setup: string
  session: string
  detectedAt: string
  status: ScannerSignalStatus
  entry: number
  stopLoss: number
  takeProfit: number
  riskReward: string
  riskRewardRatio: number
  dailyBias: ScannerBias
  h4Bias: ScannerBias
  zoneType: string
  liquiditySweepStatus: ScannerLiquiditySweepStatus
  chochBosStatus: ScannerChochBosStatus
  confirmationType: string
  sweepLabel?: string
  chochLabel?: string
  notes: string
}
