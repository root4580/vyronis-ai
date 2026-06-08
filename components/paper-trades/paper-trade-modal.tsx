"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Brain, ImagePlus, Loader2, Sparkles, X } from "lucide-react"
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
import {
  analyzePaperChartAutofill,
  createPaperTradeRequest,
} from "@/lib/paper-trades/api-client"
import {
  buildPlannedContextFromPaperDraft,
  writePaperCoachPending,
} from "@/lib/paper-trades/draft-helpers"
import type {
  PaperTradeAiField,
  PaperTradeDraft,
  PaperTradeInput,
  PaperTradeRecord,
} from "@/lib/paper-trades/types"
import { useOptionalAIContext } from "@/providers/ai-context-provider"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export type { PaperTradeDraft }

const ALLOWED_FILE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
const MAX_FILE_SIZE = 10 * 1024 * 1024

type ChartPhase = "idle" | "uploading" | "analyzing" | "success" | "error"

type PaperTradeModalProps = {
  open: boolean
  draft: PaperTradeDraft | null
  onClose: () => void
  onCreated?: (trade: PaperTradeRecord) => void
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

function FieldLabel({
  children,
  aiFilled,
}: {
  children: React.ReactNode
  aiFilled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground/80">
        {children}
      </Label>
      <AiFilledBadge visible={!!aiFilled} />
    </div>
  )
}

export function PaperTradeModal({ open, draft, onClose, onCreated }: PaperTradeModalProps) {
  const { toast } = useToast()
  const aiContext = useOptionalAIContext()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [symbol, setSymbol] = useState("")
  const [direction, setDirection] = useState("BUY")
  const [entry, setEntry] = useState("")
  const [sl, setSl] = useState("")
  const [tp, setTp] = useState("")
  const [notes, setNotes] = useState("")
  const [chartImageUrl, setChartImageUrl] = useState<string | null>(null)
  const [aiConfidence, setAiConfidence] = useState<string | null>(null)
  const [confidenceLabel, setConfidenceLabel] = useState<string | null>(null)
  const [setupGrade, setSetupGrade] = useState<string | null>(null)
  const [coachFeedback, setCoachFeedback] = useState<string | null>(null)
  const [coachSessionId, setCoachSessionId] = useState<string | null>(null)
  const [aiFilledFields, setAiFilledFields] = useState<Set<PaperTradeAiField>>(new Set())
  const [chartPhase, setChartPhase] = useState<ChartPhase>("idle")
  const [chartMessage, setChartMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isOpeningCoach, setIsOpeningCoach] = useState(false)

  const resetFromDraft = useCallback((next: PaperTradeDraft) => {
    setSymbol(next.symbol ?? "")
    setDirection(next.direction ?? "BUY")
    setEntry(next.entry != null ? String(next.entry) : "")
    setSl(next.sl != null ? String(next.sl) : "")
    setTp(next.tp != null ? String(next.tp) : "")
    setNotes(next.notes ?? "")
    setChartImageUrl(next.chart_image_url ?? null)
    setAiConfidence(next.ai_confidence ?? null)
    setConfidenceLabel(null)
    setSetupGrade(next.setup_grade ?? null)
    setCoachFeedback(next.coach_feedback ?? null)
    setCoachSessionId(next.coach_session_id ?? null)
    setAiFilledFields(new Set(next.ai_filled_fields ?? []))
    setChartPhase(next.chart_image_url ? "success" : "idle")
    setChartMessage(
      next.chart_image_url ? "✅ Chart analysed — fields filled!" : null,
    )
  }, [])

  useEffect(() => {
    if (!open || !draft) return
    resetFromDraft(draft)
  }, [open, draft, resetFromDraft])

  const isAiFilled = useCallback(
    (field: PaperTradeAiField) => aiFilledFields.has(field),
    [aiFilledFields],
  )

  const clearAiField = useCallback((field: PaperTradeAiField) => {
    setAiFilledFields((current) => {
      if (!current.has(field)) return current
      const next = new Set(current)
      next.delete(field)
      return next
    })
  }, [])

  const buildCurrentDraft = useCallback((): PaperTradeDraft => {
    return {
      symbol,
      direction,
      entry: entry ? parseFloat(entry) : null,
      sl: sl ? parseFloat(sl) : null,
      tp: tp ? parseFloat(tp) : null,
      notes,
      source: draft?.source ?? "practice",
      source_ref: draft?.source_ref ?? coachSessionId,
      setup_grade: setupGrade,
      chart_image_url: chartImageUrl,
      ai_confidence: aiConfidence,
      coach_session_id: coachSessionId,
      coach_feedback: coachFeedback,
      ai_filled_fields: [...aiFilledFields],
    }
  }, [
    symbol,
    direction,
    entry,
    sl,
    tp,
    notes,
    draft,
    coachSessionId,
    setupGrade,
    chartImageUrl,
    aiConfidence,
    coachFeedback,
    aiFilledFields,
  ])

  async function handleChartFile(file: File) {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      setChartPhase("error")
      setChartMessage("❌ Couldn't read chart. Fill manually.")
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setChartPhase("error")
      setChartMessage("❌ File too large (max 10MB).")
      return
    }

    setChartPhase("uploading")
    setChartMessage("📤 Uploading chart...")

    try {
      const formData = new FormData()
      formData.append("file", file)

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      })

      if (!uploadResponse.ok) {
        const payload = await uploadResponse.json().catch(() => ({}))
        throw new Error(typeof payload.error === "string" ? payload.error : "Upload failed")
      }

      const { url } = (await uploadResponse.json()) as { url: string }
      setChartImageUrl(url)
      setChartPhase("analyzing")
      setChartMessage("🔍 Reading your chart...")

      const result = await analyzePaperChartAutofill({
        imageUrl: url,
        symbolHint: symbol || draft?.symbol,
        directionHint: direction === "SELL" ? "SELL" : "BUY",
      })

      setAiConfidence(result.confidenceTier)
      setConfidenceLabel(result.confidenceLabel)

      if (result.applied) {
        setSymbol(result.applied.symbol)
        setDirection(result.applied.direction)
        if (result.applied.entry != null) setEntry(String(result.applied.entry))
        if (result.applied.sl != null) setSl(String(result.applied.sl))
        if (result.applied.tp != null) setTp(String(result.applied.tp))
        if (result.applied.notes) {
          setNotes((current) => (current.trim() ? current : result.applied!.notes))
        }
        setAiFilledFields(new Set(result.aiFilledFields))
        setChartPhase("success")
        setChartMessage("✅ Chart analysed — fields filled!")
      } else {
        setChartPhase("error")
        setChartMessage("❌ Couldn't read chart. Fill manually.")
      }
    } catch (error) {
      setChartPhase("error")
      setChartMessage("❌ Couldn't read chart. Fill manually.")
      toast({
        title: "Chart analysis failed",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      })
    }
  }

  async function handleAnalyseWithCoach() {
    if (!aiContext?.openPreTradeCoach) {
      toast({
        title: "Coach unavailable",
        description: "Open HQ to run Coach from here.",
        variant: "destructive",
      })
      return
    }

    setIsOpeningCoach(true)
    try {
      const pendingDraft = buildCurrentDraft()
      writePaperCoachPending(pendingDraft)
      onClose()
      await aiContext.openPreTradeCoach({
        plannedContext: buildPlannedContextFromPaperDraft(pendingDraft),
        plannerCheckIn: true,
      })
    } catch (error) {
      toast({
        title: "Could not open Coach",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      })
    } finally {
      setIsOpeningCoach(false)
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      const payload: PaperTradeInput = {
        symbol,
        direction,
        entry: entry ? parseFloat(entry) : null,
        sl: sl ? parseFloat(sl) : null,
        tp: tp ? parseFloat(tp) : null,
        notes,
        source: draft?.source ?? "practice",
        source_ref: draft?.source_ref ?? coachSessionId,
        setup_grade: setupGrade,
        chart_image_url: chartImageUrl,
        ai_confidence: aiConfidence,
        coach_session_id: coachSessionId,
        coach_feedback: coachFeedback,
      }
      const trade = await createPaperTradeRequest(payload)
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

  if (!open || !draft) return null

  const chartBusy = chartPhase === "uploading" || chartPhase === "analyzing"
  const coachGradeLabel = setupGrade?.trim() || "Not run yet"

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="add-trade-backdrop absolute inset-0" onClick={onClose} aria-hidden />
      <div className="add-trade-modal glass-card relative mx-0 max-h-[92vh] w-full max-w-lg overflow-y-auto sm:mx-4">
        <div className="border-b border-white/[0.06] px-4 py-4 md:px-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-300/90">
                Paper · Practice only
              </p>
              <h2 className="text-[16px] font-semibold text-foreground">Paper Trade This</h2>
              <p className="mt-1 text-[11px] text-muted-foreground/75">
                Does not affect live stats
              </p>
            </div>
            <button type="button" onClick={onClose} className="rounded-[10px] p-2 hover:bg-white/[0.04]">
              <X className="size-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 px-4 py-4 md:px-6">
          <div className="space-y-2">
            <FieldLabel>📸 Before (entry chart)</FieldLabel>
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_FILE_TYPES.join(",")}
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void handleChartFile(file)
                event.target.value = ""
              }}
            />
            {chartImageUrl ? (
              <div className="relative overflow-hidden rounded-[var(--radius-md)] border border-white/[0.08]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={chartImageUrl}
                  alt="Chart screenshot"
                  className="max-h-36 w-full object-cover object-top"
                />
                <button
                  type="button"
                  className="absolute right-2 top-2 rounded-md bg-black/50 p-1.5 text-white/90"
                  onClick={() => {
                    setChartImageUrl(null)
                    setChartPhase("idle")
                    setChartMessage(null)
                    setAiConfidence(null)
                    setConfidenceLabel(null)
                    setAiFilledFields(new Set())
                  }}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={chartBusy}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault()
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  const file = event.dataTransfer.files?.[0]
                  if (file) void handleChartFile(file)
                }}
                className={cn(
                  "flex w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-white/[0.12] bg-white/[0.02] px-4 py-8 text-center transition-colors hover:border-violet-400/30 hover:bg-violet-500/[0.04]",
                  chartBusy && "pointer-events-none opacity-70",
                )}
              >
                {chartBusy ? (
                  <Loader2 className="size-6 animate-spin text-violet-300" />
                ) : (
                  <ImagePlus className="size-6 text-muted-foreground/70" />
                )}
                <span className="text-[12px] text-muted-foreground/80">
                  Drop image or click to upload
                </span>
              </button>
            )}
            {chartMessage ? (
              <p
                className={cn(
                  "text-[11px]",
                  chartPhase === "error" ? "text-loss/90" : "text-muted-foreground/80",
                )}
              >
                {chartMessage}
              </p>
            ) : null}
            {confidenceLabel ? (
              <p className="text-[11px] text-muted-foreground/75">{confidenceLabel}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <FieldLabel aiFilled={isAiFilled("symbol")}>Symbol</FieldLabel>
              <Input
                value={symbol}
                onChange={(e) => {
                  setSymbol(e.target.value.toUpperCase())
                  clearAiField("symbol")
                }}
                required
                className="add-trade-input h-10"
              />
            </div>
            <div className="space-y-2">
              <FieldLabel aiFilled={isAiFilled("direction")}>Direction</FieldLabel>
              <Select
                value={direction}
                onValueChange={(value) => {
                  setDirection(value)
                  clearAiField("direction")
                }}
              >
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
              <FieldLabel aiFilled={isAiFilled("entry")}>Entry</FieldLabel>
              <Input
                type="number"
                step="any"
                value={entry}
                onChange={(e) => {
                  setEntry(e.target.value)
                  clearAiField("entry")
                }}
                className="add-trade-input h-10 tabular-nums"
              />
            </div>
            <div className="space-y-2">
              <FieldLabel aiFilled={isAiFilled("sl")}>Stop loss</FieldLabel>
              <Input
                type="number"
                step="any"
                value={sl}
                onChange={(e) => {
                  setSl(e.target.value)
                  clearAiField("sl")
                }}
                className="add-trade-input h-10 tabular-nums"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <FieldLabel aiFilled={isAiFilled("tp")}>Take profit</FieldLabel>
              <Input
                type="number"
                step="any"
                value={tp}
                onChange={(e) => {
                  setTp(e.target.value)
                  clearAiField("tp")
                }}
                className="add-trade-input h-10 tabular-nums"
              />
            </div>
          </div>

          <div className="rounded-[var(--radius-md)] border border-white/[0.08] bg-white/[0.02] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
              Coach grade
            </p>
            <p className="mt-1 text-[13px] font-medium text-foreground">
              {setupGrade ? `${setupGrade} ✅` : coachGradeLabel}
            </p>
            {coachFeedback ? (
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/75">{coachFeedback}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <FieldLabel aiFilled={isAiFilled("notes")}>Notes</FieldLabel>
            <Textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value)
                clearAiField("notes")
              }}
              className="add-trade-input min-h-[72px]"
              placeholder="AI observation + your thesis…"
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              disabled={isOpeningCoach || isSubmitting}
              className="h-11 w-full flex-1 border-cyan-glow/25 bg-cyan-glow/[0.06] text-[12px] text-cyan-glow hover:bg-cyan-glow/[0.1]"
              onClick={() => void handleAnalyseWithCoach()}
            >
              {isOpeningCoach ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <Brain className="mr-2 size-4" />
                  Analyse with Coach first
                </>
              )}
            </Button>
            <Button type="submit" disabled={isSubmitting || chartBusy} className="btn-primary h-11 w-full flex-1">
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : "📝 Open paper trade"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
