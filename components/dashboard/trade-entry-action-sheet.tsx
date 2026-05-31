"use client"

import { ClipboardCheck, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

type TradeEntryActionSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPlanSetup: () => void
  onLogResult: () => void
}

export function TradeEntryActionSheet({
  open,
  onOpenChange,
  onPlanSetup,
  onLogResult,
}: TradeEntryActionSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="glass-card border-white/[0.08] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <SheetHeader className="text-left">
          <SheetTitle className="text-[15px]">Add to journal</SheetTitle>
          <SheetDescription className="text-[12px]">
            Plan before entry or log a result after the trade closes.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 grid gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-12 justify-start border-cyan-glow/25 bg-cyan-glow/[0.06] text-left text-foreground hover:bg-cyan-glow/[0.1]"
            onClick={() => {
              onOpenChange(false)
              onPlanSetup()
            }}
          >
            <ClipboardCheck className="mr-3 size-4 shrink-0 text-cyan-glow" />
            <span>
              <span className="block text-[13px] font-semibold">Plan Setup</span>
              <span className="block text-[11px] font-normal text-muted-foreground/75">
                Score your setup before you enter
              </span>
            </span>
          </Button>

          <Button
            type="button"
            className="h-12 justify-start bg-cyan-glow/90 text-left text-black hover:bg-cyan-glow"
            onClick={() => {
              onOpenChange(false)
              onLogResult()
            }}
          >
            <Zap className="mr-3 size-4 shrink-0" />
            <span>
              <span className="block text-[13px] font-semibold">Log Result</span>
              <span className="block text-[11px] font-normal text-black/70">
                Fast post-trade journal entry
              </span>
            </span>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
