import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveAiProvider } from "@/lib/ai/providers"
import type { CompanionIntent } from "@/lib/intelligence/companion-intent-engine"
import { isTradingIntent } from "@/lib/intelligence/companion-intent-engine"
import type { CommandCenterVisionAnalysis } from "@/lib/intelligence/command-center-vision-engine"
import { patternMemoryCandidates } from "@/lib/intelligence/pattern-intelligence-engine"
import type {
  CommandCenterMemoryInsight,
  FullTraderContext,
  MemoryInsightCategory,
  TradeDecisionResult,
} from "@/lib/intelligence/intelligence-types"

const MEMORY_CATEGORIES: MemoryInsightCategory[] = [
  "repeated_behavior",
  "improving_discipline",
  "dangerous_pattern",
  "best_setup_condition",
  "emotional_trigger",
]

export function shouldCompressMemory(intent: CompanionIntent): boolean {
  return intent !== "casual_conversation"
}

function heuristicMemoryInsight(input: {
  context: FullTraderContext
  intent: CompanionIntent
  userMessage: string
  decision?: TradeDecisionResult
  chartVision?: CommandCenterVisionAnalysis | null
}): { category: MemoryInsightCategory; insight: string } | null {
  const { context, intent, decision, chartVision } = input

  if (chartVision?.bundle) {
    const bundle = chartVision.bundle
    if (bundle.conflicts.length > 0) {
      return {
        category: "dangerous_pattern",
        insight: `MTF bundle (${bundle.inferredStack}): ${bundle.conflicts[0]}`,
      }
    }
    return {
      category: "best_setup_condition",
      insight: `MTF bundle read: ${bundle.inferredStack} — ${bundle.comparisonSummary.slice(0, 120)}`,
    }
  }

  if (chartVision?.vision) {
    const trend = chartVision.vision.metrics.trendDirection
    if (chartVision.vision.warnings.length > 0) {
      return {
        category: "dangerous_pattern",
        insight: `Chart review: ${trend} trend with flags — ${chartVision.vision.warnings[0]}`,
      }
    }
    return {
      category: "best_setup_condition",
      insight: `Chart review: ${trend} trend, score ${chartVision.vision.visionScore}/100 — ${chartVision.vision.detectedSetup}`,
    }
  }

  if (chartVision && !chartVision.available) {
    return null
  }

  if (intent === "emotional_check_in" && context.emotionalState.dominantEmotion) {
    return {
      category: "emotional_trigger",
      insight: `Emotional check-in flagged ${context.emotionalState.dominantEmotion} — ${context.emotionalState.note}`,
    }
  }

  if (decision?.recommendation === "SKIP") {
    return {
      category: "dangerous_pattern",
      insight: `Setup review leaned SKIP (${decision.confidence}% confidence): ${decision.evidence[0] || "multiple risk flags"}`,
    }
  }

  if (context.memory.primaryLeak.status === "active" && isTradingIntent(intent)) {
    return {
      category: "repeated_behavior",
      insight: `Active leak: ${context.memory.primaryLeak.headline}`,
    }
  }

  const positivePattern = context.memory.topPatterns.find((p) => p.severity === "positive")
  if (positivePattern && intent === "analytics_pattern") {
    return {
      category: "best_setup_condition",
      insight: positivePattern.message,
    }
  }

  const topMistake = context.mistakeHeatmap[0]
  if (topMistake && topMistake.count >= 3 && intent === "post_trade_review") {
    return {
      category: "repeated_behavior",
      insight: `Recurring mistake: ${topMistake.label} (${topMistake.count} times, ${topMistake.lossRate}% loss rate)`,
    }
  }

  if (context.weeklyReview?.disciplineTrend.direction === "up") {
    return {
      category: "improving_discipline",
      insight: `Discipline trending up this week (${context.weeklyReview.weekLabel}).`,
    }
  }

  return null
}

async function extractLlmMemoryInsight(input: {
  context: FullTraderContext
  intent: CompanionIntent
  userMessage: string
  assistantReply: string
  decision?: TradeDecisionResult
}): Promise<{ category: MemoryInsightCategory; insight: string } | null> {
  const provider = resolveAiProvider()
  if (!provider?.completeText) return null

  try {
    const raw = await provider.completeText({
      systemPrompt:
        "You compress trading coach conversations into one durable memory insight. Return JSON only.",
      userPrompt: [
        `Intent: ${input.intent}`,
        `User: ${input.userMessage}`,
        `Assistant: ${input.assistantReply.slice(0, 400)}`,
        `Primary leak: ${input.context.memory.primaryLeak.headline}`,
        `Decision: ${input.decision?.recommendation || "none"}`,
        `Categories: ${MEMORY_CATEGORIES.join(", ")}`,
        'Return {"category":"...", "insight":"one concise sentence"}',
      ].join("\n"),
      jsonMode: true,
      maxTokens: 120,
      temperature: 0.2,
    })

    const parsed = JSON.parse(raw) as { category?: string; insight?: string }
    if (!parsed.insight?.trim()) return null
    const category = MEMORY_CATEGORIES.includes(parsed.category as MemoryInsightCategory)
      ? (parsed.category as MemoryInsightCategory)
      : "repeated_behavior"

    return { category, insight: parsed.insight.trim().slice(0, 280) }
  } catch {
    return null
  }
}

export async function storeMemoryInsight(
  supabase: SupabaseClient,
  input: {
    userId: string
    threadId: string
    sourceMessageId?: string
    category: MemoryInsightCategory
    insight: string
    metadata?: Record<string, unknown>
  },
): Promise<CommandCenterMemoryInsight | null> {
  const { data, error } = await supabase
    .from("command_center_memory_insights")
    .insert({
      user_id: input.userId,
      thread_id: input.threadId,
      source_message_id: input.sourceMessageId ?? null,
      category: input.category,
      insight: input.insight,
      metadata: input.metadata ?? {},
    })
    .select("id, category, insight, metadata, created_at")
    .single()

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return null
    throw new Error(error.message)
  }

  return {
    id: String(data.id),
    category: data.category as MemoryInsightCategory,
    insight: String(data.insight),
    created_at: String(data.created_at),
    metadata: (data.metadata || {}) as Record<string, unknown>,
  }
}

export async function compressInteractionMemory(
  supabase: SupabaseClient,
  input: {
    userId: string
    threadId: string
    context: FullTraderContext
    intent: CompanionIntent
    userMessage: string
    assistantReply: string
    sourceMessageId?: string
    decision?: TradeDecisionResult
    chartVision?: CommandCenterVisionAnalysis | null
  },
): Promise<CommandCenterMemoryInsight | null> {
  if (!shouldCompressMemory(input.intent) && !input.chartVision?.vision) return null

  const duplicate = input.context.compressedMemories.find(
    (m) => m.insight.toLowerCase() === input.assistantReply.slice(0, 80).toLowerCase(),
  )
  if (duplicate) return null

  const llmInsight = await extractLlmMemoryInsight(input)
  const patternCandidates = patternMemoryCandidates({
    context: input.context,
    chartVision: input.chartVision,
  })
  const patternPick = patternCandidates[0]

  const insight =
    llmInsight ||
    heuristicMemoryInsight({
      context: input.context,
      intent: input.intent,
      userMessage: input.userMessage,
      decision: input.decision,
      chartVision: input.chartVision,
    }) ||
    (patternPick
      ? { category: patternPick.category, insight: patternPick.insight }
      : null)

  if (!insight) return null

  return storeMemoryInsight(supabase, {
    userId: input.userId,
    threadId: input.threadId,
    sourceMessageId: input.sourceMessageId,
    category: insight.category,
    insight: insight.insight,
    metadata: {
      intent: input.intent,
      decision: input.decision?.recommendation,
      visionScore: input.chartVision?.vision?.visionScore,
      trend: input.chartVision?.vision?.metrics.trendDirection,
      patternId: patternPick?.patternId,
      weightedScore: input.decision?.weightedConfidence?.score,
    },
  })
}
