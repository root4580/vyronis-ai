import { parseMistakeTags } from "@/lib/trade-form-config"
import { scoreHtfAlignment } from "@/lib/learning/trade-memory-engine"

export type SetupFingerprint = {
  pair: string
  structureType: string
  confirmationQuality: "strong" | "moderate" | "weak" | "unknown"
  emotionalState: string
  session: string | null
  result: string
  mistakes: string[]
  direction: string
  htfScore: number
  tradeDate: string | null
  tradeId: string
}

export type FingerprintMatch = {
  tradeId: string
  pair: string
  result: string
  similarity: number
  narrative: string
  fingerprint: SetupFingerprint
}

export type FingerprintComparison = {
  wins: FingerprintMatch[]
  losses: FingerprintMatch[]
  insight: string | null
  current: SetupFingerprint
}

export type FingerprintTradeInput = {
  id: string
  pair: string
  direction: string
  result: string
  pnl?: number
  emotion?: string | null
  setup?: string | null
  session?: string | null
  confirmation_signal?: string | null
  mistake_tags?: string | null
  rule_followed?: boolean | null
  trade_date?: string | null
  higher_timeframe?: string | null
}

function normalizePair(pair: string): string {
  return pair.toUpperCase().replace(/\s/g, "")
}

function scoreConfirmation(signal: string | null | undefined): SetupFingerprint["confirmationQuality"] {
  const s = (signal || "").trim()
  if (!s) return "unknown"
  if (
    /break.?retest|structure shift|engulfing|morning star|hammer|support rejection|resistance rejection/i.test(
      s,
    )
  ) {
    return "strong"
  }
  if (/continuation|breakout|flag|triangle/i.test(s)) return "moderate"
  return "weak"
}

export function buildSetupFingerprint(trade: FingerprintTradeInput): SetupFingerprint {
  const mistakes = [
    ...parseMistakeTags(trade.mistake_tags),
    ...(trade.rule_followed === false ? ["Ignored rules"] : []),
  ]

  return {
    tradeId: String(trade.id),
    pair: trade.pair,
    structureType: (trade.setup || "Unclassified").trim() || "Unclassified",
    confirmationQuality: scoreConfirmation(trade.confirmation_signal),
    emotionalState: (trade.emotion || "Unknown").trim(),
    session: trade.session ?? null,
    result: trade.result,
    mistakes: [...new Set(mistakes.map((m) => m.trim()).filter(Boolean))],
    direction: trade.direction,
    htfScore: scoreHtfAlignment(trade as Parameters<typeof scoreHtfAlignment>[0]),
    tradeDate: trade.trade_date ?? null,
  }
}

function fingerprintSimilarity(a: SetupFingerprint, b: SetupFingerprint): number {
  let score = 0
  let max = 0

  max += 28
  if (normalizePair(a.pair) === normalizePair(b.pair)) score += 28

  max += 22
  if (a.structureType.toLowerCase() === b.structureType.toLowerCase()) score += 22
  else if (
    a.structureType.toLowerCase().includes(b.structureType.toLowerCase()) ||
    b.structureType.toLowerCase().includes(a.structureType.toLowerCase())
  ) {
    score += 12
  }

  max += 18
  if (a.confirmationQuality === b.confirmationQuality && a.confirmationQuality !== "unknown") {
    score += 18
  } else if (a.confirmationQuality !== "unknown" && b.confirmationQuality !== "unknown") {
    score += 8
  }

  max += 14
  if (a.emotionalState.toLowerCase() === b.emotionalState.toLowerCase()) score += 14

  max += 10
  if (a.session && b.session && a.session === b.session) score += 10

  max += 8
  const sharedMistakes = a.mistakes.filter((m) => b.mistakes.includes(m))
  if (sharedMistakes.length > 0) score += Math.min(8, sharedMistakes.length * 4)

  return Math.round((score / max) * 100)
}

function matchNarrative(current: SetupFingerprint, match: SetupFingerprint, similarity: number): string {
  const sameResult = current.result === match.result
  const pair = match.pair.toUpperCase()
  if (!sameResult && match.result === "LOSS" && similarity >= 55) {
    const mistakeHint =
      match.mistakes.length > 0
        ? ` Shared mistakes: ${match.mistakes.slice(0, 2).join(", ")}.`
        : ""
    return `${pair} ${match.structureType} loss (${match.tradeDate ?? "prior"}) — ${similarity}% setup overlap.${mistakeHint}`
  }
  if (sameResult && match.result === "WIN" && similarity >= 50) {
    return `${pair} win with similar ${match.structureType} + ${match.confirmationQuality} confirmation (${similarity}% match).`
  }
  return `${pair} · ${match.result} · ${similarity}% fingerprint overlap`
}

export function compareSetupFingerprints(
  current: SetupFingerprint,
  history: SetupFingerprint[],
  options?: { minSimilarity?: number; limit?: number },
): FingerprintComparison {
  const minSimilarity = options?.minSimilarity ?? 42
  const limit = options?.limit ?? 5

  const scored = history
    .filter((h) => h.tradeId !== current.tradeId)
    .map((h) => {
      const similarity = fingerprintSimilarity(current, h)
      return {
        tradeId: h.tradeId,
        pair: h.pair,
        result: h.result,
        similarity,
        narrative: matchNarrative(current, h, similarity),
        fingerprint: h,
      }
    })
    .filter((m) => m.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)

  const wins = scored.filter((m) => m.result === "WIN").slice(0, limit)
  const losses = scored.filter((m) => m.result === "LOSS" || m.result === "BE").slice(0, limit)

  let insight: string | null = null
  const impulsive = /fomo|revenge|anxious|tilted|impulsive/i.test(current.emotionalState)
  if (losses.length >= 2 && impulsive) {
    insight = `This ${current.pair} setup resembles ${losses.length} prior losses with similar structure/emotion — pause before repeating pace.`
  } else if (losses.length >= 2 && current.confirmationQuality === "weak") {
    insight = `Weak confirmation on a structure that already produced ${losses.length} similar ${current.pair} losses in your journal.`
  } else if (wins.length >= 2 && current.confirmationQuality !== "weak") {
    insight = `This aligns with ${wins.length} winning fingerprints — stay with your confirmation rules, not impulse.`
  } else if (losses[0]) {
    insight = losses[0].narrative
  }

  return { wins, losses, insight, current }
}

export function fingerprintFromMemoryMetadata(
  tradeId: string,
  metadata: Record<string, unknown> | undefined,
): SetupFingerprint | null {
  const fp = metadata?.setup_fingerprint
  if (!fp || typeof fp !== "object") return null
  const o = fp as Record<string, unknown>
  if (!o.pair || !o.tradeId) return null
  return o as unknown as SetupFingerprint
}
