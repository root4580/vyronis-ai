import type { VyronisJournalEvaluationRecord } from "@/lib/strategy/vyronis-journal-bridge"
import { getLocalDateKey } from "@/lib/user-settings"

export function formatRiskRewardLabel(riskReward: number | null | undefined): string {
  if (riskReward == null || !Number.isFinite(riskReward) || riskReward <= 0) {
    return "R:R —"
  }
  return `R:R 1:${riskReward.toFixed(1)}`
}

export function getShareKeyInsight(evaluation: VyronisJournalEvaluationRecord): string {
  if (evaluation.improvement?.trim()) return evaluation.improvement.trim()
  if (evaluation.reasons[0]?.trim()) return evaluation.reasons[0].trim()
  if (evaluation.warnings[0]?.trim()) return evaluation.warnings[0].trim()
  if (evaluation.passSummary?.trim()) return evaluation.passSummary.trim()
  return evaluation.failSummary.trim() || "Vyronis strategy scoring saved to your journal."
}

function sanitizeFilenameSegment(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9+.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32) || "trade"
}

export function buildShareCardFilename(pairLabel: string | undefined, grade: string): string {
  const pair = sanitizeFilenameSegment(pairLabel?.split(/\s+/)[0] ?? "trade")
  const gradePart = sanitizeFilenameSegment(grade)
  const date = getLocalDateKey(new Date())
  return `vyronis-${pair}-${gradePart}-${date}.png`
}
