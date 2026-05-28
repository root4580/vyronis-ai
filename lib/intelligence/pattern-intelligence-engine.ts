import { parseMistakeTags } from "@/lib/trade-form-config"
import type { CommandCenterVisionAnalysis } from "@/lib/intelligence/command-center-vision-engine"
import type {
  FullTraderContext,
  MemoryInsightCategory,
} from "@/lib/intelligence/intelligence-types"
import type { RecentTradeMemory } from "@/lib/intelligence/conversational-types"

export type TraderPatternId =
  | "continuation_bias"
  | "reversal_chasing"
  | "fomo_entries"
  | "late_confirmations"
  | "overtrading"
  | "emotional_tilt"
  | "strongest_setup"

export type DetectedTraderPattern = {
  id: TraderPatternId
  label: string
  severity: "info" | "warning" | "positive"
  message: string
  count?: number
}

const IMPULSIVE = new Set(["fomo", "revenge", "euphoric", "anxious", "tilted"])

function tradeTags(trade: RecentTradeMemory): string[] {
  return parseMistakeTags((trade as { mistake_tags?: string }).mistake_tags ?? "")
}

export function detectTraderPatterns(context: FullTraderContext): DetectedTraderPattern[] {
  const patterns: DetectedTraderPattern[] = []
  const trades = context.recentTrades.slice(0, 40)
  const losses = trades.filter((t) => t.result === "LOSS")
  const wins = trades.filter((t) => t.result === "WIN")

  const fomoCount = trades.filter(
    (t) =>
      IMPULSIVE.has(String(t.emotion).toLowerCase()) ||
      tradeTags(t).some((tag) => /fomo|chase|impulsive/i.test(tag)),
  ).length
  if (fomoCount >= 2) {
    patterns.push({
      id: "fomo_entries",
      label: "FOMO entries",
      severity: "warning",
      message: `FOMO/chase tagged on ${fomoCount} recent trades.`,
      count: fomoCount,
    })
  }

  const lateCount = trades.filter((t) =>
    tradeTags(t).some((tag) => /late|chase|early/i.test(tag)),
  ).length
  if (lateCount >= 2) {
    patterns.push({
      id: "late_confirmations",
      label: "Late confirmations",
      severity: "warning",
      message: `Late or chased entries showed up ${lateCount} times recently.`,
      count: lateCount,
    })
  }

  const reversalChase = losses.filter((t) =>
    tradeTags(t).some((tag) => /revenge|counter|against/i.test(tag)),
  ).length
  if (reversalChase >= 2) {
    patterns.push({
      id: "reversal_chasing",
      label: "Reversal chasing",
      severity: "warning",
      message: "Counter-trend or revenge-style losses are repeating.",
      count: reversalChase,
    })
  }

  const continuationLosses = losses.filter((t) => {
    const emo = String(t.emotion).toLowerCase()
    return IMPULSIVE.has(emo) && tradeTags(t).some((tag) => /chase|fomo/i.test(tag))
  }).length
  if (continuationLosses >= 2) {
    patterns.push({
      id: "continuation_bias",
      label: "Continuation bias",
      severity: "warning",
      message: "Impulsive continuation losses — chasing moves after HTF already extended.",
      count: continuationLosses,
    })
  }

  if (context.emotionalState.impulsiveCount >= 2 || context.emotionalState.trend === "volatile") {
    patterns.push({
      id: "emotional_tilt",
      label: "Emotional tilt",
      severity: "warning",
      message: context.emotionalState.note || "Emotional volatility elevated in recent trades.",
    })
  }

  if (context.memory.snapshot.todayTradeCount >= context.settings.max_trades_per_day) {
    patterns.push({
      id: "overtrading",
      label: "Overtrading",
      severity: "warning",
      message: "At or past your daily trade limit today.",
    })
  } else if (
    context.memory.snapshot.todayTradeCount >=
    Math.max(1, context.settings.max_trades_per_day - 1)
  ) {
    patterns.push({
      id: "overtrading",
      label: "Overtrading risk",
      severity: "info",
      message: "Near daily trade cap — quality over quantity.",
    })
  }

  const setupMap = new Map<string, { w: number; l: number }>()
  for (const t of trades) {
    const key = String((t as { setup?: string }).setup || "unknown").trim()
    if (!key || key === "unknown") continue
    const row = setupMap.get(key) ?? { w: 0, l: 0 }
    if (t.result === "WIN") row.w += 1
    else row.l += 1
    setupMap.set(key, row)
  }
  let bestSetup: { name: string; wr: number } | null = null
  for (const [name, stats] of setupMap) {
    const total = stats.w + stats.l
    if (total < 3) continue
    const wr = stats.w / total
    if (!bestSetup || wr > bestSetup.wr) bestSetup = { name, wr }
  }
  if (bestSetup && bestSetup.wr >= 0.6) {
    patterns.push({
      id: "strongest_setup",
      label: "Strongest setup",
      severity: "positive",
      message: `${bestSetup.name} is your best-performing setup type lately (~${Math.round(bestSetup.wr * 100)}% win).`,
    })
  }

  if (wins.length >= 3 && losses.length === 0) {
    patterns.push({
      id: "strongest_setup",
      label: "Hot streak",
      severity: "positive",
      message: "Recent win streak — stay disciplined, don't size up from euphoria.",
    })
  }

  return patterns.slice(0, 6)
}

export function pickPsychologicalWarning(
  context: FullTraderContext,
  patterns: DetectedTraderPattern[],
  mentionedPatternIds?: Set<string>,
): string | null {
  const warnings = patterns.filter((p) => p.severity === "warning")
  for (const p of warnings) {
    if (mentionedPatternIds?.has(p.id)) continue
    if (p.id === "emotional_tilt" || p.id === "fomo_entries" || p.id === "overtrading") {
      return p.message
    }
  }
  if (context.emotionalState.trend === "volatile") {
    return "Process over P&L — emotions are running hot."
  }
  return null
}

export function patternMemoryCandidates(input: {
  context: FullTraderContext
  chartVision?: CommandCenterVisionAnalysis | null
}): Array<{ category: MemoryInsightCategory; insight: string; patternId: TraderPatternId }> {
  const patterns = detectTraderPatterns(input.context)
  const out: Array<{
    category: MemoryInsightCategory
    insight: string
    patternId: TraderPatternId
  }> = []

  for (const p of patterns) {
    const category: MemoryInsightCategory =
      p.severity === "positive"
        ? "best_setup_condition"
        : p.severity === "warning"
          ? "dangerous_pattern"
          : "repeated_behavior"
    out.push({ category, insight: p.message, patternId: p.id })
  }

  const bundle = input.chartVision?.bundle
  if (bundle?.structureType === "continuation" && patterns.some((p) => p.id === "continuation_bias")) {
    out.push({
      category: "dangerous_pattern",
      insight: `MTF continuation read on ${bundle.inferredStack} while journal shows impulsive continuation losses.`,
      patternId: "continuation_bias",
    })
  }

  return out.slice(0, 3)
}
