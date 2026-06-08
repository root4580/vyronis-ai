"use client"

import { useRef } from "react"
import { ImagePlus, Loader2, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { PaperCloseAiField } from "@/lib/paper-trades/chart-close-autofill"
import type { PaperTradeRecord, PaperTradeResult } from "@/lib/paper-trades/types"
import { cn } from "@/lib/utils"

const ALLOWED_FILE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"]

export type PaperTradeCloseDraft = {
  closePrice: string
  closeResult: Exclude<PaperTradeResult, "PENDING"> | ""
  closePnl: string
  afterChartUrl: string | null
  chartPhase: "idle" | "uploading" | "analyzing" | "success" | "error"
  chartMessage: string | null
  confidenceLabel: string | null
  aiFilledFields: Set<PaperCloseAiField>
}

export function createEmptyCloseDraft(): PaperTradeCloseDraft {
  return {
    closePrice: "",
    closeResult: "",
    closePnl: "",
    afterChartUrl: null,
    chartPhase: "idle",
    chartMessage: null,
    confidenceLabel: null,
    aiFilledFields: new Set(),
  }
}

function AiFilledBadge({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-violet-300/90">
      <Sparkles className="size-2.5" />
      AI filled
    </span>
  )
}

type PaperTradeClosePanelProps = {
  trade: PaperTradeRecord
  draft: PaperTradeCloseDraft
  isClosing: boolean
  onDraftChange: (draft: PaperTradeCloseDraft) => void
  onAfterChartFile: (file: File) => void
  onClose: () => void
}

export function PaperTradeClosePanel({
  trade,
  draft,
  isClosing,
  onDraftChange,
  onAfterChartFile,
  onClose,
}: PaperTradeClosePanelProps) {
  const afterInputRef = useRef<HTMLInputElement>(null)
  const chartBusy = draft.chartPhase === "uploading" || draft.chartPhase === "analyzing"
  const isAiFilled = (field: PaperCloseAiField) => draft.aiFilledFields.has(field)

  const patch = (partial: Partial<PaperTradeCloseDraft>) => {
    onDraftChange({ ...draft, ...partial })
  }

  const clearAi = (field: PaperCloseAiField) => {
    const next = new Set(draft.aiFilledFields)
    next.delete(field)
    patch({ aiFilledFields: next })
  }

  return (
    <div className="space-y-3 border-t border-white/[0.06] pt-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">
        Close trade
      </p>

      <div className="grid grid-cols-2 gap-2">
        <ChartSlot
          label="Before (entry)"
          imageUrl={trade.chart_image_url}
          emptyHint="No entry chart saved"
        />
        <ChartSlot
          label="After (exit)"
          imageUrl={draft.afterChartUrl}
          emptyHint="Upload exit chart"
          interactive
          busy={chartBusy}
          onPick={() => afterInputRef.current?.click()}
          onClear={
            draft.afterChartUrl
              ? () =>
                  patch({
                    afterChartUrl: null,
                    chartPhase: "idle",
                    chartMessage: null,
                    confidenceLabel: null,
                    aiFilledFields: new Set(),
                  })
              : undefined
          }
        />
      </div>

      <input
        ref={afterInputRef}
        type="file"
        accept={ALLOWED_FILE_TYPES.join(",")}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onAfterChartFile(file)
          event.target.value = ""
        }}
      />

      {draft.chartMessage ? (
        <p
          className={cn(
            "text-[11px]",
            draft.chartPhase === "error" ? "text-loss/90" : "text-text-muted",
          )}
        >
          {draft.chartMessage}
        </p>
      ) : null}
      {draft.confidenceLabel ? (
        <p className="text-[11px] text-text-muted">{draft.confidenceLabel}</p>
      ) : null}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        <div className="space-y-1 sm:col-span-1">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-[10px] text-text-muted">Close price</Label>
            <AiFilledBadge visible={isAiFilled("closePrice")} />
          </div>
          <Input
            type="number"
            step="any"
            value={draft.closePrice}
            onChange={(e) => {
              patch({ closePrice: e.target.value })
              clearAi("closePrice")
            }}
            className="add-trade-input h-9 tabular-nums"
          />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-[10px] text-text-muted">Result</Label>
            <AiFilledBadge visible={isAiFilled("result")} />
          </div>
          <Select
            value={draft.closeResult || undefined}
            onValueChange={(value) => {
              patch({ closeResult: value as Exclude<PaperTradeResult, "PENDING"> })
              clearAi("result")
            }}
          >
            <SelectTrigger className="add-trade-input h-9">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="WIN">Win</SelectItem>
              <SelectItem value="LOSS">Loss</SelectItem>
              <SelectItem value="BREAKEVEN">Breakeven</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-[10px] text-text-muted">P&L (R)</Label>
            <AiFilledBadge visible={isAiFilled("pnl")} />
          </div>
          <Input
            type="number"
            step="0.1"
            value={draft.closePnl}
            onChange={(e) => {
              patch({ closePnl: e.target.value })
              clearAi("pnl")
            }}
            className="add-trade-input h-9 tabular-nums"
          />
        </div>
        <div className="flex items-end">
          <Button
            type="button"
            size="sm"
            className="h-9 w-full"
            disabled={isClosing || !draft.closePrice.trim() || !draft.closeResult}
            onClick={onClose}
          >
            {isClosing ? <Loader2 className="size-4 animate-spin" /> : "Close paper trade"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function ChartSlot({
  label,
  imageUrl,
  emptyHint,
  interactive,
  busy,
  onPick,
  onClear,
}: {
  label: string
  imageUrl: string | null
  emptyHint: string
  interactive?: boolean
  busy?: boolean
  onPick?: () => void
  onClear?: () => void
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-text-muted">{label}</Label>
      {imageUrl ? (
        <div className="relative overflow-hidden rounded-[var(--radius-sm)] border border-white/[0.08]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={label} className="h-20 w-full object-cover object-top" />
          {onClear ? (
            <button
              type="button"
              className="absolute right-1 top-1 rounded-md bg-black/50 p-1 text-white/90"
              onClick={onClear}
            >
              <X className="size-3" />
            </button>
          ) : null}
        </div>
      ) : interactive ? (
        <button
          type="button"
          disabled={busy}
          onClick={onPick}
          className={cn(
            "flex h-20 w-full flex-col items-center justify-center gap-1 rounded-[var(--radius-sm)] border border-dashed border-white/[0.12] bg-white/[0.02] text-center transition-colors hover:border-violet-400/30",
            busy && "pointer-events-none opacity-70",
          )}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin text-violet-300" />
          ) : (
            <ImagePlus className="size-4 text-muted-foreground/70" />
          )}
          <span className="px-2 text-[9px] text-muted-foreground/80">{emptyHint}</span>
        </button>
      ) : (
        <div className="flex h-20 items-center justify-center rounded-[var(--radius-sm)] border border-white/[0.06] bg-white/[0.02] px-2 text-center text-[9px] text-text-muted">
          {emptyHint}
        </div>
      )}
    </div>
  )
}
