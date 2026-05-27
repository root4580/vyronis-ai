import { parseMistakeTags } from "@/lib/trade-form-config"
import { getSignedPnL } from "@/lib/trade-utils"

export type MistakeTagTrade = {
  direction: string
  result: string
  pnl: number
  emotion: string
  emotion_after?: string | null
  risk_percent: number | null
  rule_followed: boolean | null
  confirmation_signal: string | null
  mistake_tags?: string | null
}

export type DisplayMistakeTag = {
  id: string
  label: string
  dangerous: boolean
  source: "tag" | "inferred"
}

const DANGEROUS_LABELS = new Set([
  "FOMO",
  "Revenge Trade",
  "Overrisk",
  "No Confirmation",
  "Counter Trend",
  "Early Entry",
  "Overtrading",
  "Moved Stop",
])

const TAG_LABEL_MAP: Record<string, string> = {
  "Revenge trade": "Revenge Trade",
  Oversized: "Overrisk",
  "No confirmation": "No Confirmation",
  "Chased price": "Early Entry",
  "Late entry": "Early Entry",
  "Moved stop": "Moved Stop",
}

const BEARISH_SIGNALS = new Set([
  "Head and Shoulders",
  "Double Top",
  "Triple Top",
  "Bearish Engulfing",
  "Evening Star",
  "Shooting Star",
  "Bear Flag",
  "Descending Triangle",
  "Resistance Rejection",
])

const BULLISH_SIGNALS = new Set([
  "Inverse Head and Shoulders",
  "Double Bottom",
  "Triple Bottom",
  "Bullish Engulfing",
  "Morning Star",
  "Hammer",
  "Bull Flag",
  "Ascending Triangle",
  "Support Rejection",
])

export function normalizeMistakeLabel(raw: string): string {
  return TAG_LABEL_MAP[raw] ?? raw
}

export function isDangerousMistakeLabel(label: string): boolean {
  return DANGEROUS_LABELS.has(label) || DANGEROUS_LABELS.has(normalizeMistakeLabel(label))
}

function isCounterTrend(trade: MistakeTagTrade): boolean {
  const signal = trade.confirmation_signal
  if (!signal) return false

  const bearish =
    BEARISH_SIGNALS.has(signal) ||
    signal.toLowerCase().includes("bearish") ||
    signal.toLowerCase().includes("resistance")
  const bullish =
    BULLISH_SIGNALS.has(signal) ||
    signal.toLowerCase().includes("bullish") ||
    signal.toLowerCase().includes("support") ||
    signal.toLowerCase().includes("hammer")

  if (trade.direction === "BUY" && bearish && !bullish) return true
  if (trade.direction === "SELL" && bullish && !bearish) return true
  return false
}

function pushTag(tags: DisplayMistakeTag[], id: string, label: string, source: "tag" | "inferred") {
  const normalized = normalizeMistakeLabel(label)
  if (tags.some((t) => t.label === normalized)) return
  tags.push({
    id,
    label: normalized,
    dangerous: isDangerousMistakeLabel(normalized),
    source,
  })
}

export function getTradeDisplayMistakeTags(trade: MistakeTagTrade): DisplayMistakeTag[] {
  const tags: DisplayMistakeTag[] = []

  for (const raw of parseMistakeTags(trade.mistake_tags)) {
    pushTag(tags, `tag-${raw}`, raw, "tag")
  }

  if (trade.emotion === "FOMO" || trade.emotion_after === "FOMO") {
    pushTag(tags, "inferred-fomo", "FOMO", "inferred")
  }
  if (trade.emotion === "Revenge") {
    pushTag(tags, "inferred-revenge", "Revenge Trade", "inferred")
  }
  if ((trade.risk_percent ?? 1) > 1) {
    pushTag(tags, "inferred-overrisk", "Overrisk", "inferred")
  }
  if (!trade.confirmation_signal) {
    pushTag(tags, "inferred-no-confirm", "No Confirmation", "inferred")
  }
  if (isCounterTrend(trade)) {
    pushTag(tags, "inferred-counter", "Counter Trend", "inferred")
  }

  return tags.sort((a, b) => Number(b.dangerous) - Number(a.dangerous))
}

export function getMistakeBadgeClassName(dangerous: boolean, className = ""): string {
  if (dangerous) {
    return `mistake-badge mistake-badge-danger inline-flex items-center rounded-full border border-loss/35 bg-loss/[0.12] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-loss shadow-[0_0_14px_rgba(239,68,68,0.22)] ${className}`
  }
  return `mistake-badge inline-flex items-center rounded-full border border-amber-500/25 bg-amber-500/[0.08] px-2 py-0.5 text-[10px] font-medium text-amber-200/90 ${className}`
}

export function sumLossAmount(trades: MistakeTagTrade[], matches: (trade: MistakeTagTrade) => boolean): number {
  return trades
    .filter((t) => t.result === "LOSS" && matches(t))
    .reduce((sum, t) => sum + Math.abs(getSignedPnL(t.pnl, t.result)), 0)
}
