import {
  formatRiskReward,
  scoreScannerSetup,
  type ScannerSetupFactors,
} from "@/lib/scanner/scoring"
import type {
  ScannerLiveSignal,
  ScannerRuleStatus,
  ScannerSignalStatus,
  ScannerStrategyRule,
  ScannerWatchlistPair,
} from "@/lib/scanner/signal-types"

export type {
  ScannerLiveSignal,
  ScannerRuleStatus,
  ScannerStrategyRule,
  ScannerSignalStatus,
  ScannerWatchlistPair,
} from "@/lib/scanner/signal-types"

type RawScannerSignal = {
  id: string
  pair: string
  direction: "BUY" | "SELL"
  setup: string
  session: string
  detectedAt: string
  status: ScannerSignalStatus
  entry: number
  stopLoss: number
  takeProfit: number
  notes: string
  factors: ScannerSetupFactors
}

function buildSignal(raw: RawScannerSignal): ScannerLiveSignal {
  const scoring = scoreScannerSetup(raw.factors)
  return {
    id: raw.id,
    pair: raw.pair,
    direction: raw.direction,
    grade: scoring.grade,
    score: scoring.score,
    confidence: scoring.confidence,
    scoring,
    setup: raw.setup,
    session: raw.session,
    detectedAt: raw.detectedAt,
    status: raw.status,
    entry: raw.entry,
    stopLoss: raw.stopLoss,
    takeProfit: raw.takeProfit,
    riskRewardRatio: raw.factors.riskRewardRatio,
    riskReward: formatRiskReward(raw.factors.riskRewardRatio),
    dailyBias: raw.factors.dailyBias,
    h4Bias: raw.factors.h4Bias,
    weeklyBias: raw.factors.dailyBias,
    zoneType: raw.factors.zoneType,
    liquiditySweepStatus: raw.factors.liquiditySweep,
    chochBosStatus: raw.factors.chochBos,
    confirmationType: raw.factors.confirmationType,
    notes: raw.notes,
  }
}

export const MOCK_STRATEGY_RULES: ScannerStrategyRule[] = [
  {
    id: "weekly-bias",
    label: "Weekly bias aligned",
    detail: "Trade direction must match weekly structure",
    status: "pass",
  },
  {
    id: "daily-bias",
    label: "Daily bias confirmed",
    detail: "Daily candle close supports direction",
    status: "pass",
  },
  {
    id: "h4-aoi",
    label: "H4 AOI tagged",
    detail: "FVG, Order Block, Supply, or Demand — price reacting inside zone",
    status: "pass",
  },
  {
    id: "confirmation",
    label: "M15 confirmation",
    detail: "BOS / CHoCH or liquidity sweep on entry TF",
    status: "warn",
  },
  {
    id: "risk-reward",
    label: "Minimum 1:2 R:R",
    detail: "Stop to target geometry before entry",
    status: "pass",
  },
  {
    id: "emotion-gate",
    label: "Emotion gate ≥ 7",
    detail: "No revenge or FOMO state before execution",
    status: "warn",
  },
]

export const MOCK_WATCHLIST: ScannerWatchlistPair[] = [
  {
    id: "eurusd",
    pair: "EUR/USD",
    weeklyBias: "Bearish",
    dailyBias: "Bearish",
    h4Bias: "Bearish",
    session: "London",
    scanState: "Building",
    grade: "Skip",
    zoneType: "FVG",
    score: 0,
    direction: "SELL",
  },
  {
    id: "gbpcad",
    pair: "GBP/CAD",
    weeklyBias: "Bullish",
    dailyBias: "Bullish",
    h4Bias: "Bullish",
    session: "London",
    scanState: "Waiting Confirmation",
    grade: "Skip",
    zoneType: "Demand",
    score: 0,
    direction: "BUY",
  },
  {
    id: "gbpnzd",
    pair: "GBP/NZD",
    weeklyBias: "Neutral",
    dailyBias: "Neutral",
    h4Bias: "Neutral",
    session: "Off",
    scanState: "Idle",
    grade: "Skip",
    zoneType: "None",
    score: 0,
    direction: null,
  },
  {
    id: "chfjpy",
    pair: "CHF/JPY",
    weeklyBias: "Bullish",
    dailyBias: "Bullish",
    h4Bias: "Bullish",
    session: "New York",
    scanState: "Alerted",
    grade: "A+ Sniper",
    zoneType: "Order Block",
    score: 96,
    direction: "BUY",
  },
]

const RAW_SIGNALS: RawScannerSignal[] = [
  {
    id: "sig-eurusd",
    pair: "EUR/USD",
    direction: "SELL",
    setup: "London liquidity sweep → H4 supply rejection",
    session: "London",
    detectedAt: "08:42 ET",
    status: "active",
    entry: 1.1462,
    stopLoss: 1.1484,
    takeProfit: 1.1416,
    notes:
      "Price swept Asia highs into H4 supply. M15 bearish engulfing closed — A+ geometry.",
    factors: {
      direction: "SELL",
      dailyBias: "Bearish",
      h4Bias: "Bearish",
      validZone: true,
      zoneType: "FVG",
      liquiditySweep: "Confirmed",
      chochBos: "CHoCH",
      bosBonus: true,
      engulfingConfirmation: true,
      confirmationType: "Bearish engulfing (M15)",
      sessionAlignment: true,
      session: "London",
      riskRewardRatio: 2.1,
    },
  },
  {
    id: "sig-gbpcad",
    pair: "GBP/CAD",
    direction: "BUY",
    setup: "NY pullback into H4 demand — CHoCH pending engulfing",
    session: "London–NY",
    detectedAt: "09:18 ET",
    status: "watching",
    entry: 1.8245,
    stopLoss: 1.8218,
    takeProfit: 1.8299,
    notes:
      "Watching for bullish engulfing at demand. Skip if CAD news spikes spread.",
    factors: {
      direction: "BUY",
      dailyBias: "Bullish",
      h4Bias: "Bullish",
      validZone: true,
      zoneType: "FVG",
      liquiditySweep: "Pending",
      chochBos: "CHoCH",
      engulfingConfirmation: false,
      confirmationType: "None yet",
      sessionAlignment: true,
      session: "London–NY",
      riskRewardRatio: 2.0,
    },
  },
  {
    id: "sig-gbpnzd",
    pair: "GBP/NZD",
    direction: "SELL",
    setup: "Range mid — no HTF edge, weak session",
    session: "Asia",
    detectedAt: "06:05 ET",
    status: "expired",
    entry: 2.1782,
    stopLoss: 2.1815,
    takeProfit: 2.1732,
    notes: "Skip — no daily/H4 alignment and R:R below rule. Re-scan after London open.",
    factors: {
      direction: "SELL",
      dailyBias: "Neutral",
      h4Bias: "Neutral",
      validZone: false,
      zoneType: "No zone",
      liquiditySweep: "None",
      chochBos: "None",
      engulfingConfirmation: false,
      confirmationType: "None",
      sessionAlignment: false,
      session: "Asia",
      riskRewardRatio: 1.5,
    },
  },
]

export const MOCK_LIVE_SIGNALS: ScannerLiveSignal[] = RAW_SIGNALS.map(buildSignal)

export const DEFAULT_SELECTED_SIGNAL_ID = MOCK_LIVE_SIGNALS[0]?.id ?? ""
