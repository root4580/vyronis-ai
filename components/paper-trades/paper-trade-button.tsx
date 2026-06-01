"use client"

import { useEffect, useState } from "react"
import { FileEdit } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PaperTradeModal } from "@/components/paper-trades/paper-trade-modal"
import {
  PAPER_COACH_COMPLETE_EVENT,
  type PaperCoachCompleteDetail,
} from "@/lib/paper-trades/draft-helpers"
import type { PaperTradeDraft } from "@/lib/paper-trades/types"
import type { PaperTradeRecord } from "@/lib/paper-trades/types"
import { cn } from "@/lib/utils"

type PaperTradeButtonProps = {
  draft: PaperTradeDraft
  label?: string
  size?: "sm" | "default"
  className?: string
  onCreated?: (trade: PaperTradeRecord) => void
}

export function PaperTradeButton({
  draft: initialDraft,
  label = "Paper Trade",
  size = "sm",
  className,
  onCreated,
}: PaperTradeButtonProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<PaperTradeDraft>(initialDraft)

  useEffect(() => {
    setDraft(initialDraft)
  }, [initialDraft])

  useEffect(() => {
    function handleCoachComplete(event: Event) {
      const detail = (event as CustomEvent<PaperCoachCompleteDetail>).detail
      if (!detail?.symbol) return
      setDraft((current) => ({
        ...current,
        ...detail,
        symbol: detail.symbol || current.symbol,
        direction: detail.direction || current.direction,
      }))
      setOpen(true)
    }

    window.addEventListener(PAPER_COACH_COMPLETE_EVENT, handleCoachComplete)
    return () => window.removeEventListener(PAPER_COACH_COMPLETE_EVENT, handleCoachComplete)
  }, [])

  return (
    <>
      <Button
        type="button"
        size={size}
        variant="outline"
        className={cn(
          "border-violet-400/30 bg-violet-500/[0.08] text-[11px] text-violet-200 hover:bg-violet-500/[0.14]",
          className,
        )}
        onClick={() => setOpen(true)}
      >
        <FileEdit className="mr-1.5 size-3.5" />
        {label}
      </Button>
      <PaperTradeModal
        open={open}
        draft={draft}
        onClose={() => setOpen(false)}
        onCreated={onCreated}
      />
    </>
  )
}
