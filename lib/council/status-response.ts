import { formatAccountMoney } from "@/lib/accounts/profit-target"
import type { CouncilAgentContext, CouncilAgentId } from "@/lib/council/types"

export function isCouncilJournalTodayQuestion(message: string): boolean {
  const trimmed = message.trim()
  if (!trimmed) return false
  return (
    /\b(?:thread|trades?|journal).{0,24}today\b/i.test(trimmed) ||
    /\btoday'?s.{0,24}(?:thread|trades?|journal|log)\b/i.test(trimmed) ||
    /\blook (?:into|at).{0,20}(?:thread|trades?|journal)\b/i.test(trimmed) ||
    /\bwhat did i trade today\b/i.test(trimmed)
  )
}

export function buildZaraJournalTodayFallback(context: CouncilAgentContext): string {
  const line = context.visual.stats.todayJournalLine
  const zaraLead = context.zara.split(".")[0]?.trim()
  if (line && !/no trades logged/i.test(line)) {
    return `${line}${zaraLead ? ` ${zaraLead}.` : ""}`
  }
  return line || "No trades logged in Vyronis journal today on this account — tap Log on HQ after your next close."
}

export function buildCouncilJournalTodayUserPrompt(input: {
  question: string
  recentTranscript: string
  traderFirstName: string
}): string {
  return [
    input.recentTranscript ? `Today's conversation so far:\n${input.recentTranscript}` : "",
    `${input.traderFirstName} asked about today's journal thread: ${input.question}`,
    "Answer from your live trade review snapshot and today's journal line. Quote pair, result, and P&L when available.",
    "Maximum 2 short sentences. Do not redirect to Luna or another agent.",
  ]
    .filter(Boolean)
    .join("\n\n")
}

export function buildJarvisJournalTodayIntro(traderFirstName: string): string {
  return `${traderFirstName}, pulling today's journal thread from Vyronis Log.`
}

export function isCouncilStatusQuestion(message: string): boolean {
  const trimmed = message.trim()
  if (!trimmed || trimmed.length > 180) return false

  if (/\b(setup|watchlist|confirm|entry valid|m15|h4 bias|apex)\b/i.test(trimmed)) {
    return false
  }

  return (
    /\b(how do we look|how are we looking|how we looking|where do we stand|overall status|status check)\b/i.test(
      trimmed,
    ) ||
    /\b(how(?:'s| is) it going|how am i doing|how are we doing)\b/i.test(trimmed) ||
    /\b(trades taken|trade count|how many trades|slots left|weekly trades)\b/i.test(trimmed) ||
    /\b(stats|numbers|score|discipline score|drawdown|balance)\b/i.test(trimmed) ||
    /\b(emotion|emotional|mindset|mental state|how am i feeling)\b/i.test(trimmed) ||
    (/\bhow are we\b/i.test(trimmed) &&
      !/\b(?:setup|watchlist|risk|confirm|on risk|on setup)\b/i.test(trimmed))
  )
}

function extractEmotionSnippet(novaContext: string): string | null {
  const match = novaContext.match(/Emotional history[^.]*\./i)
  return match?.[0] ?? null
}

export function buildNovaStatusFallback(context: CouncilAgentContext): string {
  const stats = context.visual.stats
  const emotion = extractEmotionSnippet(context.nova)
  const discipline =
    stats.disciplineScore != null
      ? `Discipline ${Math.round(stats.disciplineScore)}/100.`
      : "Discipline score still building."

  return [
    `${stats.chapterLabel}: ${stats.tradesThisWeek} of ${stats.maxTradesPerWeek} trades taken — ${stats.tradesRemaining} slot${stats.tradesRemaining === 1 ? "" : "s"} left.`,
    discipline,
    emotion ?? "No emotion data logged yet this chapter.",
    stats.dataNote ? stats.dataNote : null,
  ]
    .filter(Boolean)
    .join(" ")
}

export function buildRexStatusFallback(context: CouncilAgentContext): string {
  const stats = context.visual.stats
  const money = (value: number) => formatAccountMoney(value, stats.currency)

  return [
    `Balance ${money(stats.balance)} on ${stats.accountName} (started ${money(stats.startingBalance)}).`,
    `Drawdown ${stats.drawdownPct.toFixed(1)}%. Daily loss ${stats.dailyLossPct.toFixed(1)}% used today.`,
    stats.todayJournalLine,
  ].join(" ")
}

export function buildCouncilStatusUserPrompt(input: {
  question: string
  agentId: Extract<CouncilAgentId, "nova" | "rex">
  recentTranscript: string
  traderFirstName: string
}): string {
  const lane =
    input.agentId === "nova"
      ? "Answer with trades taken this week, slots remaining, discipline score, and emotional steadiness. Quote exact numbers from your live snapshot — do not stay vague."
      : "Answer with balance, drawdown, daily loss used, and weekly trade limits. Quote exact numbers from your live snapshot."

  return [
    input.recentTranscript ? `Today's conversation so far:\n${input.recentTranscript}` : "",
    `${input.traderFirstName} asked for a status check: ${input.question}`,
    lane,
    "Maximum 2 short sentences. No markdown. Lead with the numbers.",
  ]
    .filter(Boolean)
    .join("\n\n")
}

export function buildJarvisStatusIntro(traderFirstName: string): string {
  return `${traderFirstName}, pulling your live stats, emotions, and risk picture now.`
}
