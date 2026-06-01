"use client"

import { useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { markRitualCoachEngaged } from "@/lib/daily-ritual"
import { buildEmptyPlannedContext } from "@/lib/trade-coach/planned-context"
import {
  buildPlannedContextFromPaperDraft,
  buildWarRoomPaperDraft,
  writePaperCoachPending,
} from "@/lib/paper-trades/draft-helpers"
import { checkCoachReadiness } from "@/lib/strategy-brain/coach-readiness-gate"
import { buildPlannedContextFromPairPlan } from "@/lib/strategy-brain/weekly-watchlist"
import type { OpenWarRoomPreTradeCoach } from "@/lib/paper-trades/war-room-coach-flow"
import { useToast } from "@/hooks/use-toast"

type WarRoomCoachDeepLinkProps = {
  userId?: string | null
  openPreTradeCoachRef: React.RefObject<OpenWarRoomPreTradeCoach | null>
}

export function WarRoomCoachDeepLink({ userId, openPreTradeCoachRef }: WarRoomCoachDeepLinkProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const handledKeyRef = useRef<string>("")

  useEffect(() => {
    const coachPair = searchParams.get("coachPair")?.trim()
    const openCoach = searchParams.get("openCoach") === "1"
    if ((!coachPair && !openCoach) || !userId) return

    const key = `${coachPair ?? ""}:${openCoach ? "1" : "0"}`
    if (handledKeyRef.current === key) return
    handledKeyRef.current = key

    void (async () => {
      const openPreTradeCoach = openPreTradeCoachRef.current
      if (!openPreTradeCoach) return

      const gate = await checkCoachReadiness(coachPair)
      if (!gate.allowed) {
        toast({
          title: gate.headline,
          description: gate.message,
          variant: "destructive",
        })
        router.replace("/war-room")
        return
      }
      if (gate.severity === "warning") {
        toast({ title: gate.headline, description: gate.message })
      }

      try {
        if (gate.pairPlan) {
          const draft = buildWarRoomPaperDraft(gate.pairPlan)
          writePaperCoachPending(draft)
          await openPreTradeCoach({
            plannedContext: buildPlannedContextFromPairPlan(gate.pairPlan),
            plannerCheckIn: true,
          })
        } else if (coachPair) {
          const draft = {
            symbol: coachPair,
            direction: "BUY" as const,
            source: "war_room" as const,
          }
          writePaperCoachPending(draft)
          await openPreTradeCoach({
            plannedContext: { ...buildEmptyPlannedContext(), pair: coachPair },
            plannerCheckIn: true,
          })
        } else {
          const pair = "EURUSD"
          const draft = { symbol: pair, direction: "BUY" as const, source: "war_room" as const }
          writePaperCoachPending(draft)
          await openPreTradeCoach({
            plannedContext: buildPlannedContextFromPaperDraft(draft),
            plannerCheckIn: true,
          })
        }
        markRitualCoachEngaged(userId)
      } catch (error) {
        toast({
          title: "Could not open Coach",
          description: error instanceof Error ? error.message : undefined,
          variant: "destructive",
        })
      } finally {
        router.replace("/war-room")
      }
    })()
  }, [userId, openPreTradeCoachRef, router, searchParams, toast])

  return null
}
