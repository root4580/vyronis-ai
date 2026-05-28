import type {
  IntelligenceTimeline,
  IntelligenceTimelineEvent,
  TradingOsEngineInput,
} from "@/lib/trading-os/types"

export function buildIntelligenceTimeline(input: TradingOsEngineInput): IntelligenceTimeline {
  const { context } = input
  const events: IntelligenceTimelineEvent[] = []

  for (const trade of context.recentTrades.slice(0, 12)) {
    events.push({
      id: `trade-${trade.id}`,
      type: "trade",
      title: `${trade.pair} ${trade.result}`,
      summary: `${trade.direction} · ${trade.pnl >= 0 ? "+" : ""}${trade.pnl} · ${trade.emotion || "no emotion"}`,
      severity: trade.result === "LOSS" && trade.rule_followed === false ? "warning" : null,
      occurredAt: trade.trade_date || trade.created_at,
      metadata: { tradeId: trade.id },
    })
  }

  for (const lesson of context.autonomous?.recentLessons ?? []) {
    events.push({
      id: `lesson-${lesson.slice(0, 24)}`,
      type: "lesson",
      title: "Lesson captured",
      summary: lesson,
      severity: null,
      occurredAt: new Date().toISOString(),
    })
  }

  for (const insight of context.compressedMemories.slice(0, 6)) {
    const type =
      insight.category === "dangerous_pattern"
        ? "mistake"
        : insight.category === "improving_discipline"
          ? "breakthrough"
          : insight.category === "emotional_trigger"
            ? "emotion"
            : "psychology_milestone"
    events.push({
      id: `memory-${insight.id}`,
      type,
      title: insight.category.replace(/_/g, " "),
      summary: insight.insight,
      severity: insight.category === "dangerous_pattern" ? "warning" : null,
      occurredAt: insight.created_at,
    })
  }

  if (context.cognitive?.confidenceGraph.fakeConfidence) {
    events.push({
      id: "confidence-gap",
      type: "confidence_shift",
      title: "Confidence gap detected",
      summary: context.cognitive.confidenceGraph.narrative,
      severity: "warning",
      occurredAt: context.cognitive.computedAt,
    })
  }

  if (context.cognitive?.state.primary === "disciplined" || context.cognitive?.state.primary === "focused") {
    events.push({
      id: "state-positive",
      type: "psychology_milestone",
      title: `State: ${context.cognitive.state.primary}`,
      summary: context.cognitive.state.narrative,
      severity: null,
      occurredAt: context.cognitive.computedAt,
    })
  }

  events.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))

  const narrative =
    events.length > 0
      ? `Timeline: ${events.length} recent signals — trades, emotions, and psychology woven for cross-memory reasoning.`
      : "Timeline empty — log trades and emotions to build your evolution stream."

  return {
    events: events.slice(0, 24),
    narrative,
  }
}
