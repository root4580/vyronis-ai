import type { CouncilTranscriptEntry } from "@/lib/council/types"

export type CouncilDataScope = "this_week" | "last_trades" | "all_time"

/** How many journal trades to load into agent context for "last trades" questions. */
export const COUNCIL_JOURNAL_LAST_TRADES_LIMIT = 5

export const COUNCIL_JOURNAL_LAST_TRADE_CHARTS_LIMIT = 3

export function isCouncilThisWeekRequest(message: string): boolean {
  const trimmed = message.trim()
  if (!trimmed) return false
  return /\b(this week|the week|week so far|my week|weekly chapter|chapter this week|trades this week|how(?:'s| is) (?:my )?week|what(?:'s| is) my week|review this week|performance this week)\b/i.test(
    trimmed,
  )
}

export function isCouncilLastTradesRequest(message: string): boolean {
  const trimmed = message.trim()
  if (!trimmed || /\blast week\b/i.test(trimmed)) return false

  if (isCouncilThisWeekRequest(trimmed) && /\b(last|latest|recent)\s+trades?\b/i.test(trimmed)) {
    return false
  }

  return (
    /\b(last|latest|recent|my most recent)\s+(?:few\s+)?trades?\b/i.test(trimmed) ||
    /\b(last|latest)\s+trade\b/i.test(trimmed) ||
    /\bwhat(?:'s| were| was) my last\b/i.test(trimmed) ||
    /\bhow(?:'s| was) my last trade\b/i.test(trimmed) ||
    /\breview (?:my )?(?:last|recent)\b/i.test(trimmed) ||
    /\b(?:pull|show|get) (?:my )?(?:last|recent) trades?\b/i.test(trimmed) ||
    /\btrades? (?:i |I )?(?:just )?logged\b/i.test(trimmed) ||
    /\bfrom (?:the )?journal\b/i.test(trimmed) ||
    /\bjournal trades?\b/i.test(trimmed) ||
    /\bvyronis (?:log|journal)\b/i.test(trimmed)
  )
}

const BROADER_SCOPE_PATTERN =
  /\b(all[- ]?time|overall|lifetime|last week|previous week|last month|historical|every trade|all trades|entire journal)\b/i

function isScopeFollowUp(message: string): boolean {
  const trimmed = message.trim()
  if (!trimmed || BROADER_SCOPE_PATTERN.test(trimmed)) return false
  return trimmed.length < 120
}

function lastUserScopeHint(
  transcript: CouncilTranscriptEntry[],
): CouncilDataScope | null {
  for (let index = transcript.length - 1; index >= 0; index -= 1) {
    const entry = transcript[index]!
    if (entry.agent !== "user") continue
    if (isCouncilThisWeekRequest(entry.content)) return "this_week"
    if (isCouncilLastTradesRequest(entry.content)) return "last_trades"
    return null
  }
  return null
}

export function resolveCouncilDataScope(
  message: string,
  transcript: CouncilTranscriptEntry[],
): CouncilDataScope {
  if (isCouncilThisWeekRequest(message)) return "this_week"
  if (isCouncilLastTradesRequest(message)) return "last_trades"

  if (isScopeFollowUp(message)) {
    const prior = lastUserScopeHint(transcript)
    if (prior) return prior
  }

  return "all_time"
}

export function buildCouncilDataScopeInstruction(
  scope: CouncilDataScope,
  chapterLabel: string,
): string {
  if (scope === "this_week") {
    return [
      "DATA SCOPE — THIS WEEK ONLY:",
      `Use only the current weekly chapter (${chapterLabel}), trades logged this week, and this week's discipline score.`,
      "Do not cite last week, older chapters, all-time journal history, or lifetime P&L unless the trader explicitly asks for a broader period.",
      "If there are zero trades this week, say so clearly instead of pulling older trades.",
    ].join("\n")
  }

  if (scope === "last_trades") {
    return [
      "DATA SCOPE — LAST TRADES FROM VYRONIS JOURNAL:",
      `Use the trader's ${COUNCIL_JOURNAL_LAST_TRADES_LIMIT} most recent trades logged in Vyronis (HQ Log / journal), newest first.`,
      "Quote the full 6-letter pair, direction, result, P&L, emotion, and notes from those journal entries only.",
      "Do not invent trades or pull from older history beyond what is in the journal block.",
      "If no trades are logged on this account, say the journal is empty and point them to Log on HQ.",
    ].join("\n")
  }

  return ""
}
