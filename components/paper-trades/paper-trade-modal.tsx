"use client"

import { useEffect, useState } from "react"
import { Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createPaperTradeRequest } from "@/lib/paper-trades/api-client"
import type { PaperTradeDraft, PaperTradeInput, PaperTradeRecord } from "@/lib/paper-trades/types"
import { useToast } from "@/hooks/use-toast"

export type { PaperTradeDraft }

type PaperTradeModalProps = {
  open: boolean
  draft: PaperTradeDraft | null
  onClose: () => void
  onCreated?: (trade: PaperTradeRecord) => void
}

export function PaperTradeModal({ open, draft, onClose, onCreated }: PaperTradeModalProps) {
  const { toast } = useToast()
  const [symbol, setSymbol] = useState("")
  const [direction, setDirection] = useState("BUY")
  const [entry, setEntry] = useState("")
  const [sl, setSl] = useState("")
  const [tp, setTp] = useState("")
  const [notes, setNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open || !draft) return
    setSymbol(draft.symbol ?? "")
    setDirection(draft.direction ?? "BUY")
    setEntry(draft.entry != null ? String(draft.entry) : "")
    setSl(draft.sl != null ? String(draft.sl) : "")
    setTp(draft.tp != null ? String(draft.tp) : "")
    setNotes(draft.notes ?? "")
  }, [open, draft])

  if (!open || !draft) return null

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      const trade = await createPaperTradeRequest({
        symbol,
        direction,
        entry: entry ? parseFloat(entry) : null,
        sl: sl ? parseFloat(sl) : null,
        tp: tp ? parseFloat(tp) : null,
        notes,
        source: draft!.source ?? "practice",
        source_ref: draft!.source_ref ?? null,
        setup_grade: draft!.setup_grade ?? null,
      })
      toast({
        title: "Paper trade opened",
        description: `${trade.symbol} ${trade.direction} — tracked in Practice Room only.`,
      })
      onCreated?.(trade)
      onClose()
    } catch (error) {
      toast({
        title: "Could not open paper trade",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="add-trade-backdrop absolute inset-0" onClick={onClose} aria-hidden />
      <div className="add-trade-modal glass-card relative mx-0 w-full max-w-lg overflow-hidden sm:mx-4">
        <div className="border-b border-white/[0.06] px-4 py-4 md:px-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-300/90">
                Paper · Practice only
              </p>
              <h2 className="text-[16px] font-semibold text-foreground">Paper Trade This</h2>
              <p className="mt-1 text-[11px] text-muted-foreground/75">
                Does not affect live P&L, stats, or trading rules.
              </p>
            </div>
            <button type="button" onClick={onClose} className="rounded-[10px] p-2 hover:bg-white/[0.04]">
              <X className="size-5 text-muted-foreground" />
            </button>
          </div>
        </div>
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 px-4 py-4 md:px-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground/80">Symbol</Label>
              <Input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} required className="add-trade-input h-10" />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground/80">Direction</Label>
              <Select value={direction} onValueChange={setDirection}>
                <SelectTrigger className="add-trade-input h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BUY">BUY</SelectItem>
                  <SelectItem value="SELL">SELL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground/80">Entry</Label>
              <Input type="number" step="any" value={entry} onChange={(e) => setEntry(e.target.value)} className="add-trade-input h-10 tabular-nums" />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground/80">Stop loss</Label>
              <Input type="number" step="any" value={sl} onChange={(e) => setSl(e.target.value)} className="add-trade-input h-10 tabular-nums" />
            </div>
            <div className="space-y-2 col-span-2">
              <Label className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground/80">Take profit</Label>
              <Input type="number" step="any" value={tp} onChange={(e) => setTp(e.target.value)} className="add-trade-input h-10 tabular-nums" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground/80">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="add-trade-input min-h-[72px]" placeholder="Setup thesis, coach grade, invalidation…" />
          </div>
          <Button type="submit" disabled={isSubmitting} className="btn-primary h-11 w-full">
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : "📝 Open paper trade"}
          </Button>
        </form>
      </div>
    </div>
  )
}
