export type Mt5PipelineStage =
  | "auth"
  | "normalize"
  | "supabase_save"
  | "journal_calendar"
  | "intelligence_sync"
  | "setup_score"
  | "ai_insight"
  | "discipline_metrics"

export type Mt5PipelineStageStatus = "ok" | "skipped" | "error"

export type Mt5PipelineStageRecord = {
  stage: Mt5PipelineStage
  status: Mt5PipelineStageStatus
  ms?: number
  detail?: string
  error?: string
}

export type Mt5PipelineReport = {
  ok: boolean
  failedAt?: Mt5PipelineStage
  stages: Mt5PipelineStageRecord[]
  trade_id?: string
  ticket?: string
  trade_date?: string
}

const LOG_PREFIX = "[MT5 Pipeline]"

export function createPipelineReport(input?: {
  trade_id?: string
  ticket?: string
  trade_date?: string
}): Mt5PipelineReport {
  return {
    ok: true,
    stages: [],
    trade_id: input?.trade_id,
    ticket: input?.ticket,
    trade_date: input?.trade_date,
  }
}

export function logPipelineStage(
  report: Mt5PipelineReport,
  stage: Mt5PipelineStage,
  status: Mt5PipelineStageStatus,
  options?: { ms?: number; detail?: string; error?: string },
): void {
  const record: Mt5PipelineStageRecord = {
    stage,
    status,
    ms: options?.ms,
    detail: options?.detail,
    error: options?.error,
  }
  report.stages.push(record)

  if (status === "error") {
    report.ok = false
    report.failedAt = stage
  }

  const line = `${LOG_PREFIX} ${stage} → ${status}${options?.detail ? ` (${options.detail})` : ""}${options?.error ? ` — ${options.error}` : ""}${options?.ms != null ? ` [${options.ms}ms]` : ""}`

  if (status === "error") {
    console.error(line)
  } else {
    console.log(line)
  }
}

export function finalizePipelineReport(report: Mt5PipelineReport): Mt5PipelineReport {
  if (!report.ok) {
    console.error(`${LOG_PREFIX} FAILED at ${report.failedAt}`, {
      trade_id: report.trade_id,
      ticket: report.ticket,
      stages: report.stages,
    })
  } else {
    console.log(`${LOG_PREFIX} OK`, {
      trade_id: report.trade_id,
      ticket: report.ticket,
      trade_date: report.trade_date,
      stages: report.stages.map((s) => `${s.stage}:${s.status}`).join(" → "),
    })
  }
  return report
}

export function formatPipelineReport(report: Mt5PipelineReport): string {
  return report.stages
    .map((s) => {
      const parts = [`${s.stage}: ${s.status}`]
      if (s.detail) parts.push(s.detail)
      if (s.error) parts.push(`ERR=${s.error}`)
      if (s.ms != null) parts.push(`${s.ms}ms`)
      return parts.join(" | ")
    })
    .join("\n")
}
