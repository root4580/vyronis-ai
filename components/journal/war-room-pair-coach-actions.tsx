"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Brain, Loader2 } from "lucide-react"
import { SetupGradeBadge } from "@/components/command-center/setup-grade-badge"
import { PaperTradeButton } from "@/components/paper-trades/paper-trade-button"
import { Button } from "@/components/ui/button"
import {
  PAPER_COACH_COMPLETE_EVENT,
  buildWarRoomPaperDraft,
  type PaperCoachCompleteDetail,
} from "@/lib/paper-trades/draft-helpers"
import type { PaperTradeDraft } from "@/lib/paper-trades/types"
import type { PairPlanRecord } from "@/lib/strategy-brain/types"
import {
  coachCompleteMatchesPair,
  isStrongCoachGrade,
  openWarRoomCoachForPlan,
  paperDraftHasCoachGrade,
} from "@/lib/paper-trades/war-room-coach-flow"
import { useOptionalAIContext } from "@/providers/ai-context-provider"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import type { SetupGrade } from "@/lib/strategy-brain/types"

type WarRoomPairCoachActionsProps = {
  plan: PairPlanRecord
  className?: string
  onCoachEngaged?: () => void
}

function isSetupGrade(value: string | null | undefined): value is SetupGrade {
  if (!value?.trim()) return false
  const normalized = value.replace(/\s+/g, "").toUpperCase()
  return normalized === "A+" || ["A", "B", "C", "D"].includes(normalized)
}

export function WarRoomPairCoachActions({
  plan,
  className,
  onCoachEngaged,
}: WarRoomPairCoachActionsProps) {
  const { toast } = useToast()
  const aiContext = useOptionalAIContext()
  const [draft, setDraft] = useState<PaperTradeDraft>(() => buildWarRoomPaperDraft(plan))
  const [isOpeningCoach, setIsOpeningCoach] = useState(false)

  useEffect(() => {
    setDraft((current) => ({
      ...buildWarRoomPaperDraft(plan),
      coach_session_id: current.coach_session_id,
      setup_grade: current.setup_grade,
      coach_feedback: current.coach_feedback,
      chart_image_url: current.chart_image_url ?? buildWarRoomPaperDraft(plan).chart_image_url,
    }))
  }, [plan])

  useEffect(() => {
    function handleCoachComplete(event: Event) {
      const detail = (event as CustomEvent<PaperCoachCompleteDetail>).detail
      if (!detail || !coachCompleteMatchesPair(detail, plan.pair)) return
      setDraft((current) => ({
        ...current,
        ...detail,
        symbol: plan.pair,
        source: "war_room",
        source_ref: plan.id,
      }))
    }

    window.addEventListener(PAPER_COACH_COMPLETE_EVENT, handleCoachComplete)
    return () => window.removeEventListener(PAPER_COACH_COMPLETE_EVENT, handleCoachComplete)
  }, [plan.id, plan.pair])

  const coachGraded = paperDraftHasCoachGrade(draft)
  const strongGrade = isStrongCoachGrade(draft.setup_grade)

  const runCoach = useCallback(async () => {
    if (!aiContext?.openPreTradeCoach) {
      toast({
        title: "Coach unavailable",
        description: "Refresh War Room and try again.",
        variant: "destructive",
      })
      return
    }

    setIsOpeningCoach(true)
    try {
      await openWarRoomCoachForPlan(aiContext.openPreTradeCoach, plan)
      onCoachEngaged?.()
    } catch (error) {
      toast({
        title: "Could not open Coach",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      })
    } finally {
      setIsOpeningCoach(false)
    }
  }, [aiContext, onCoachEngaged, plan, toast])

  const coachGradeBadge = useMemo(() => {
    if (!isSetupGrade(draft.setup_grade)) return null
    return <SetupGradeBadge grade={draft.setup_grade} label="Coach" size="sm" />
  }, [draft.setup_grade])

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {coachGraded && coachGradeBadge ? (
        <div className="flex flex-wrap items-center gap-2">{coachGradeBadge}</div>
      ) : null}

      <div className="grid w-full grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
        <Button
          type="button"
          variant="outline"
          disabled={isOpeningCoach}
          className={cn(
            "min-h-10 w-full border-cyan-glow/25 bg-cyan-glow/[0.06] text-[12px] text-cyan-glow hover:bg-cyan-glow/[0.1] sm:min-h-0 sm:w-auto sm:text-[11px]",
            coachGraded && !strongGrade && "min-[420px]:col-span-2",
          )}
          onClick={() => void runCoach()}
        >
          {isOpeningCoach ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <Brain className="mr-1.5 size-3.5 shrink-0" />
              {coachGraded ? "Re-run Coach" : "Run Coach first"}
            </>
          )}
        </Button>

        {coachGraded ? (
          <PaperTradeButton
            className={cn(
              "min-h-10 w-full sm:min-h-0 sm:w-auto",
              strongGrade &&
                "border-violet-300/40 bg-violet-500/[0.14] text-[12px] font-semibold text-violet-100 hover:bg-violet-500/[0.2]",
            )}
            draft={draft}
            label={strongGrade ? "📝 Paper trade (A setup)" : "📝 Paper trade"}
          />
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled
            className="min-h-10 w-full border-white/[0.06] text-[12px] text-text-muted sm:min-h-0 sm:w-auto sm:text-[11px]"
            title="Complete Coach check-in to unlock paper trading"
          >
            Paper trade locked
          </Button>
        )}
      </div>
    </div>
  )
}
