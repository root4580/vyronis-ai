export type CompanionIntent =
  | "casual_conversation"
  | "market_check"
  | "pre_trade_coaching"
  | "post_trade_review"
  | "emotional_check_in"
  | "analytics_pattern"

const CASUAL_PATTERNS = [
  /^(hi|hey|hello|yo|sup|hiya|howdy|heya)[!.?\s]*$/i,
  /^good\s+(morning|afternoon|evening|night)[!.?\s]*$/i,
  /^what'?s\s+up[!.?\s]*$/i,
  /^how\s+are\s+you[!.?\s]*$/i,
  /^how'?s\s+it\s+going[!.?\s]*$/i,
  /^how\s+you\s+doing[!.?\s]*$/i,
  /^what'?s\s+going\s+on[!.?\s]*$/i,
  /^just\s+(saying\s+)?hi[!.?\s]*$/i,
  /^morning[!.?\s]*$/i,
  /^evening[!.?\s]*$/i,
]

const MARKET_CHECK_PATTERNS = [
  /how\s+(are\s+)?we\s+looking/i,
  /how'?s\s+(today|the\s+market|the\s+session|my\s+day)/i,
  /how\s+am\s+i\s+doing/i,
  /market\s+(today|look|check)/i,
  /check\s+(the\s+)?(market|session|today)/i,
  /what'?s\s+(the\s+)?(market|session)\s+(like|doing)/i,
  /session\s+(look|update|check)/i,
  /where\s+do\s+we\s+stand/i,
  /status\s+(update|check)/i,
  /^(today|this\s+session)\??$/i,
]

const PRE_TRADE_PATTERNS = [
  /pre.?trade/i,
  /planned\s+(trade|setup)/i,
  /open\s+(my\s+)?(setup|plan|coach)/i,
  /should\s+i\s+take/i,
  /review\s+(this\s+)?(setup|trade|plan)/i,
  /walk\s+through\s+(the\s+)?(setup|plan|trade)/i,
  /before\s+i\s+(enter|trade|click)/i,
  /\bcoach\b/i,
]

const POST_TRADE_PATTERNS = [
  /post.?trade/i,
  /debrief/i,
  /how\s+did\s+(that|my)\s+trade/i,
  /review\s+(my\s+)?(last|recent)\s+trade/i,
  /what\s+went\s+wrong/i,
  /after\s+(that|the)\s+trade/i,
]

const EMOTIONAL_PATTERNS = [
  /fomo|revenge|tilt|tilted/i,
  /feeling\s+(anxious|stressed|euphoric|angry|scared|nervous|frustrated)/i,
  /emotion|emotional/i,
  /i\s+feel/i,
  /can'?t\s+focus/i,
  /overtrading/i,
  /psychology|mindset/i,
]

const ANALYTICS_PATTERNS = [
  /pattern|patterns/i,
  /leak|behavior|behaviour|discipline/i,
  /mistake|mistakes/i,
  /stats|statistics|analytics/i,
  /win\s*rate|winrate/i,
  /history|historical/i,
  /similar|resembles|compare/i,
  /last\s+week|weekly/i,
  /journal\s+(review|data)/i,
]

export function detectCompanionIntent(text: string): CompanionIntent {
  const normalized = text.trim().toLowerCase()
  if (!normalized) return "casual_conversation"

  if (CASUAL_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "casual_conversation"
  }

  if (EMOTIONAL_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "emotional_check_in"
  }

  if (POST_TRADE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "post_trade_review"
  }

  if (MARKET_CHECK_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "market_check"
  }

  if (ANALYTICS_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "analytics_pattern"
  }

  if (PRE_TRADE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "pre_trade_coaching"
  }

  if (/plan|setup|trade|entry|signal|alert/.test(normalized)) {
    return "pre_trade_coaching"
  }

  if (/today|session|market|morning|afternoon/.test(normalized)) {
    return "market_check"
  }

  return "casual_conversation"
}

export function isTradingIntent(intent: CompanionIntent): boolean {
  return intent !== "casual_conversation"
}

export function firstNameFromDisplay(displayName?: string | null): string | null {
  const trimmed = displayName?.trim()
  if (!trimmed) return null
  return trimmed.split(/\s+/)[0] ?? null
}
