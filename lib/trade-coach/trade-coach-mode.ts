import type { TradeJournalMode } from "@/lib/trade-journal-mode"

export type TradeCoachMode = "pre_trade" | "post_trade"

const CLOSED_RESULTS = new Set(["WIN", "LOSS", "BREAKEVEN"])

/** Pre-trade planning vs closed journal trade review. */
export function resolveTradeCoachMode(input: {
  result?: string | null
  pnl?: number | string | null
  journalMode?: TradeJournalMode | null
}): TradeCoachMode {
  if (input.journalMode === "plan") return "pre_trade"
  if (input.result && CLOSED_RESULTS.has(String(input.result).toUpperCase())) {
    return "post_trade"
  }
  return "pre_trade"
}

export function isClosedTrade(input: {
  result?: string | null
  journalMode?: TradeJournalMode | null
}): boolean {
  return resolveTradeCoachMode(input) === "post_trade"
}

const PRE_TRADE_PHRASE_PATTERNS = [
  /reduce size/i,
  /wait for (another )?confirmation/i,
  /don'?t enter yet/i,
  /avoid taking this trade/i,
  /stand down/i,
  /do not (enter|take)/i,
  /before (you )?enter/i,
  /before clicking/i,
  /size down before/i,
  /wait for .* candle/i,
  /pause entry/i,
]

export function containsPreTradeLanguage(text: string): boolean {
  return PRE_TRADE_PHRASE_PATTERNS.some((pattern) => pattern.test(text))
}

export function sanitizePostTradeCopy(text: string): string {
  if (!containsPreTradeLanguage(text)) return text
  return text
    .replace(/reduce size[^.!?]*/gi, "review position sizing discipline on the next similar setup")
    .replace(/wait for (another )?confirmation[^.!?]*/gi, "note confirmation quality for the next entry")
    .replace(/don'?t enter yet[^.!?]*/gi, "execution is complete — focus on what happened")
    .replace(/avoid taking this trade[^.!?]*/gi, "review whether this setup should be repeated")
    .replace(/before (you )?enter[^.!?]*/gi, "on the next trade")
    .trim()
}
