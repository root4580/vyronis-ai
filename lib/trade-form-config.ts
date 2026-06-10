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
  reflection_chart_url: string
  entry_price: string
  stop_loss: string
  take_profit: string
  lots: string
  hold_minutes: string
  mistake_tags: string[]
  trade_notes: string
  thinking_before: string
  thinking_during: string
  thinking_after: string
  biggest_mistake: string
  lesson_learned: string
  what_worked: string
  what_didnt_work: string
  higher_timeframe: string
  entry_timeframe: string
  confirmation_timeframe: string
  confirmation_signal: string
  /** Vyronis Core Model — HTF bias */
  weekly_bias: string
  daily_bias: string
  h4_bias: string
  /** Vyronis Core Model — AOI & confirmation */
  aoi_type: string
  confirmation_type: string
  entry_quality: string
}

export const VYRONIS_BIAS_OPTIONS = [
  { value: "bullish", label: "Bullish" },
  { value: "bearish", label: "Bearish" },
  { value: "neutral", label: "Neutral" },
] as const

export const VYRONIS_AOI_OPTIONS = [
  { value: "supply", label: "Supply" },
  { value: "demand", label: "Demand" },
  { value: "support", label: "Support" },
  { value: "resistance", label: "Resistance" },
  { value: "liquidity_sweep", label: "Liquidity sweep" },
  { value: "ema_zone", label: "EMA zone" },
  { value: "breakout_retest", label: "Breakout retest" },
] as const

export const VYRONIS_CONFIRMATION_OPTIONS = [
  { value: "choch", label: "CHoCH" },
  { value: "bos", label: "BOS" },
  { value: "engulfing", label: "Engulfing" },
  { value: "pin_bar", label: "Pin bar" },
  { value: "break_retest", label: "Break & retest" },
  { value: "ema_retest", label: "EMA retest" },
  { value: "none", label: "No confirmation" },
] as const

export const VYRONIS_ENTRY_QUALITY_OPTIONS = [
  { value: "perfect", label: "Perfect" },
  { value: "early", label: "Early" },
  { value: "late", label: "Late" },
  { value: "impulsive", label: "Impulsive" },
] as const

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
  { value: "Calm", label: "Calm", emoji: "😌", dotClass: "bg-emerald-400" },
  { value: "Confident", label: "Confident", emoji: "💪", dotClass: "bg-cyan-glow" },
  { value: "Fearful", label: "Fearful", emoji: "😨", dotClass: "bg-violet-400" },
  { value: "Revenge", label: "Revenge", emoji: "😤", dotClass: "bg-orange-400" },
  { value: "Impulsive", label: "Impulsive", emoji: "⚡", dotClass: "bg-yellow-400" },
  { value: "Overconfident", label: "Overconfident", emoji: "🔥", dotClass: "bg-rose-400" },
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
export const REFLECTION_FIELD_MAX_LENGTH = 280

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
    risk_percent: "",
    rule_followed: true,
    trade_date: new Date().toISOString().split("T")[0],
    session: "",
    screenshot_url: "",
    reflection_chart_url: "",
    entry_price: "",
    stop_loss: "",
    take_profit: "",
    lots: "",
    hold_minutes: "",
    mistake_tags: [],
    trade_notes: "",
    thinking_before: "",
    thinking_during: "",
    thinking_after: "",
    biggest_mistake: "",
    lesson_learned: "",
    what_worked: "",
    what_didnt_work: "",
    higher_timeframe: "",
    entry_timeframe: "",
    confirmation_timeframe: "",
    confirmation_signal: "",
    weekly_bias: "",
    daily_bias: "",
    h4_bias: "",
    aoi_type: "",
    confirmation_type: "",
    entry_quality: "perfect",
    ...overrides,
  }
}

export function parseMistakeTags(value: string | null | undefined): string[] {
  if (!value) return []
  return value.split(",").map((t) => t.trim()).filter(Boolean)
}
