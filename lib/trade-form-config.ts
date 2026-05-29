export type TradeFormState = {
  pair: string
  direction: string
  result: string
  pnl: string
  emotion: string
  emotion_after: string
  setup: string
  strategy_name: string
  risk_percent: string
  rule_followed: boolean
  trade_date: string
  session: string
  screenshot_url: string
  entry_price: string
  stop_loss: string
  take_profit: string
  mistake_tags: string[]
  trade_notes: string
  higher_timeframe: string
  entry_timeframe: string
  confirmation_timeframe: string
  confirmation_signal: string
}

export const TRADE_PAIRS = [
  "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "USDCAD", "AUDUSD", "NZDUSD",
  "EURGBP", "EURJPY", "EURCHF", "EURCAD", "EURAUD", "EURNZD",
  "GBPJPY", "GBPCHF", "GBPCAD", "GBPAUD", "GBPNZD",
  "AUDJPY", "AUDCHF", "AUDCAD", "AUDNZD",
  "NZDJPY", "NZDCHF", "NZDCAD",
  "CADJPY", "CADCHF", "CHFJPY",
  "XAUUSD", "XAGUSD", "NAS100", "US30", "SPX500",
]

export const TRADE_DIRECTIONS = ["BUY", "SELL"] as const

export const TRADE_RESULTS = [
  { value: "WIN", label: "WIN", tone: "profit" as const },
  { value: "LOSS", label: "LOSS", tone: "loss" as const },
  { value: "BREAKEVEN", label: "BE", tone: "neutral" as const },
]

export const PRIMARY_SESSIONS = ["London", "New York", "Asia"] as const

export const TRADING_SESSIONS = [
  "Asia",
  "London",
  "New York",
  "London + New York Overlap",
  "Pre-Market",
  "NY AM",
  "NY PM",
]

export const TRADE_STRATEGIES = [
  "ICT Concepts",
  "SMC Strategy",
  "Supply & Demand",
  "Price Action",
  "Scalping",
  "Swing Trading",
  "Breakout Strategy",
  "Mean Reversion",
]

export const EMOTION_OPTIONS = [
  { value: "Calm", emoji: "😌", label: "Calm" },
  { value: "Confident", emoji: "💪", label: "Confident" },
  { value: "Disciplined", emoji: "🎯", label: "Disciplined" },
  { value: "Anxious", emoji: "😰", label: "Anxious" },
  { value: "FOMO", emoji: "🚀", label: "FOMO" },
  { value: "Revenge", emoji: "😤", label: "Revenge" },
  { value: "Euphoric", emoji: "🤩", label: "Euphoric" },
  { value: "Fearful", emoji: "😨", label: "Fearful" },
]

export const MISTAKE_TAGS = [
  "Late entry",
  "Moved stop",
  "Oversized",
  "No plan",
  "Chased price",
  "Ignored rules",
  "Revenge trade",
  "Poor timing",
  "Wrong session",
  "No confirmation",
]

export const TRADE_SETUPS = [
  "A+ Setup",
  "B Setup",
  "C Setup",
  "Order Block",
  "Fair Value Gap",
  "Liquidity Sweep",
  "Break of Structure",
  "Continuation",
]

export const NOTES_MAX_LENGTH = 500

export function createInitialTradeForm(overrides?: Partial<TradeFormState>): TradeFormState {
  return {
    pair: "",
    direction: "BUY",
    result: "",
    pnl: "",
    emotion: "Calm",
    emotion_after: "",
    setup: "A+ Setup",
    strategy_name: "",
    risk_percent: "1",
    rule_followed: true,
    trade_date: new Date().toISOString().split("T")[0],
    session: "",
    screenshot_url: "",
    entry_price: "",
    stop_loss: "",
    take_profit: "",
    mistake_tags: [],
    trade_notes: "",
    higher_timeframe: "",
    entry_timeframe: "",
    confirmation_timeframe: "",
    confirmation_signal: "",
    ...overrides,
  }
}

export function parseMistakeTags(value: string | null | undefined): string[] {
  if (!value) return []
  return value.split(",").map((t) => t.trim()).filter(Boolean)
}
