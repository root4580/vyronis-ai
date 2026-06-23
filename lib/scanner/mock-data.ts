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
  weeklyBias: "Bullish" | "Bearish" | "Neutral"
  dailyBias: "Bullish" | "Bearish" | "Neutral"
  session: string
  aoiReady: boolean
}

export type ScannerSignalGrade = "A+" | "A" | "B"

export type ScannerLiveSignal = {
  id: string
  pair: string
  direction: "BUY" | "SELL"
  grade: ScannerSignalGrade
  setup: string
  session: string
  detectedAt: string
  status: "active" | "watching" | "expired"
  entry: number
  stopLoss: number
  takeProfit: number
  riskReward: string
  confluences: string[]
  notes: string
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
    detail: "Price reacting inside marked area of interest",
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
    session: "London",
    aoiReady: true,
  },
  {
    id: "gbpusd",
    pair: "GBP/USD",
    weeklyBias: "Bullish",
    dailyBias: "Neutral",
    session: "NY",
    aoiReady: true,
  },
  {
    id: "xauusd",
    pair: "XAU/USD",
    weeklyBias: "Bullish",
    dailyBias: "Bullish",
    session: "London–NY",
    aoiReady: false,
  },
  {
    id: "usdjpy",
    pair: "USD/JPY",
    weeklyBias: "Neutral",
    dailyBias: "Bearish",
    session: "Asia",
    aoiReady: true,
  },
]

export const MOCK_LIVE_SIGNALS: ScannerLiveSignal[] = [
  {
    id: "sig-1",
    pair: "EUR/USD",
    direction: "SELL",
    grade: "A+",
    setup: "London liquidity sweep → H4 supply",
    session: "London",
    detectedAt: "08:42 ET",
    status: "active",
    entry: 1.1462,
    stopLoss: 1.1484,
    takeProfit: 1.1416,
    riskReward: "1:2.1",
    confluences: [
      "Weekly bearish structure",
      "Daily lower high",
      "H4 supply zone retest",
      "M15 bearish BOS",
    ],
    notes:
      "Price swept Asia highs into H4 supply. Wait for M15 close below internal low before entry.",
  },
  {
    id: "sig-2",
    pair: "GBP/USD",
    direction: "BUY",
    grade: "A",
    setup: "NY open discount → bullish OB",
    session: "NY",
    detectedAt: "09:15 ET",
    status: "watching",
    entry: 1.2748,
    stopLoss: 1.2726,
    takeProfit: 1.2792,
    riskReward: "1:2.0",
    confluences: ["Daily bullish bias", "H4 demand hold", "M15 bullish CHoCH"],
    notes: "Watching for pullback into 1.2745–1.2750 OB. Skip if NY CPI volatility spikes.",
  },
  {
    id: "sig-3",
    pair: "XAU/USD",
    direction: "BUY",
    grade: "B",
    setup: "Range low sweep (incomplete HTF)",
    session: "London",
    detectedAt: "07:58 ET",
    status: "expired",
    entry: 3342.5,
    stopLoss: 3334.0,
    takeProfit: 3359.5,
    riskReward: "1:2.0",
    confluences: ["H4 demand touch", "M15 liquidity grab"],
    notes: "Expired — price ran without retest. Re-scan on next H1 close.",
  },
]

export const DEFAULT_SELECTED_SIGNAL_ID = MOCK_LIVE_SIGNALS[0]?.id ?? ""
