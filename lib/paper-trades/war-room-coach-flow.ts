import {
  buildPlannedContextFromPaperDraft,
  buildWarRoomPaperDraft,
  type PaperCoachCompleteDetail,
  paperDraftHasCoachGrade,
  writePaperCoachPending,
} from "@/lib/paper-trades/draft-helpers"
import type { PaperTradeDraft } from "@/lib/paper-trades/types"
import { mapSetupGradeToBand } from "@/lib/coach-chapters/personality"
import type { PairPlanRecord } from "@/lib/strategy-brain/types"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"

export type OpenWarRoomPreTradeCoach = (options?: {
  plannedContext?: PreTradePlannedContext
  plannerCheckIn?: boolean
}) => Promise<void>

export function normalizePairSymbol(value: string | null | undefined): string {
  return (value ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase()
}

export function coachCompleteMatchesPair(
  detail: PaperCoachCompleteDetail,
  pair: string,
): boolean {
  return normalizePairSymbol(detail.symbol) === normalizePairSymbol(pair)
}

export { paperDraftHasCoachGrade }

export function isStrongCoachGrade(grade: string | null | undefined): boolean {
  const band = mapSetupGradeToBand(grade)
  return band === "A+" || band === "A"
}

export function buildWarRoomCoachDraft(plan: PairPlanRecord): PaperTradeDraft {
  return buildWarRoomPaperDraft(plan)
}

export async function openWarRoomCoachForPlan(
  openPreTradeCoach: OpenWarRoomPreTradeCoach,
  plan: PairPlanRecord,
): Promise<void> {
  const draft = buildWarRoomCoachDraft(plan)
  writePaperCoachPending(draft)
  await openPreTradeCoach({
    plannedContext: buildPlannedContextFromPaperDraft(draft),
    plannerCheckIn: true,
  })
}
