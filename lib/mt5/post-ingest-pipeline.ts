import type { SupabaseClient } from "@supabase/supabase-js"
import { analyzeTradeIntelligence } from "@/lib/intelligence/trade-intelligence-server"
import {
  createPipelineReport,
  finalizePipelineReport,
  logPipelineStage,
  type Mt5PipelineReport,
} from "@/lib/mt5/pipeline-log"

export async function runMt5PostIngestPipeline(
  supabase: SupabaseClient,
  userId: string,
  tradeId: string,
  report: Mt5PipelineReport,
): Promise<Mt5PipelineReport> {
  const started = Date.now()

  try {
    const result = await analyzeTradeIntelligence(supabase, userId, tradeId, {
      persistSetupScore: true,
      syncMemory: true,
    })

    const bundle = result.bundle
    logPipelineStage(report, "intelligence_sync", "ok", {
      ms: Date.now() - started,
      detail: result.memorySync?.synced
        ? "trade_memory synced"
        : result.memorySync?.skipped
          ? "memory tables skipped"
          : "memory sync attempted",
    })

    logPipelineStage(report, "setup_score", "ok", {
      detail: `score=${bundle.setupScore.score} class=${bundle.setupScore.classification}${result.setupScorePersisted ? " persisted" : ""}`,
    })

    logPipelineStage(report, "ai_insight", "ok", {
      detail: `verdict=${bundle.analysis.verdict} summary=${bundle.analysis.summary.slice(0, 80)}…`,
    })

    logPipelineStage(report, "discipline_metrics", "ok", {
      detail: `discipline=${bundle.disciplineScore} source=${bundle.disciplineSource}`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Intelligence pipeline failed"
    logPipelineStage(report, "intelligence_sync", "error", {
      ms: Date.now() - started,
      error: message,
    })
    logPipelineStage(report, "setup_score", "skipped", { detail: "blocked by intelligence_sync failure" })
    logPipelineStage(report, "ai_insight", "skipped", { detail: "blocked by intelligence_sync failure" })
    logPipelineStage(report, "discipline_metrics", "skipped", {
      detail: "blocked by intelligence_sync failure",
    })
  }

  return finalizePipelineReport(report)
}
