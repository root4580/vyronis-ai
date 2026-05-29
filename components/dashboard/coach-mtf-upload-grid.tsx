"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { Loader2, Plus, RefreshCw, Trash2, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScreenshotViewerModal } from "@/components/dashboard/screenshot-viewer-modal"
import { MTF_SLOTS, type CoachMtfTimeframe } from "@/lib/coach/mtf-constants"
import { countMtfScreenshots, getMtfScreenshotsFromSession } from "@/lib/trade-coach/mtf-session"
import type { TradeCoachSessionWithMessages } from "@/lib/trade-coach/types"
import { useCoachMtfUpload } from "@/hooks/use-coach-mtf-upload"
import { cn } from "@/lib/utils"

type CoachMtfUploadGridProps = {
  session: TradeCoachSessionWithMessages
  disabled?: boolean
  onSessionUpdate: (session: TradeCoachSessionWithMessages) => void
  onRunAnalysis: () => Promise<void>
  isAnalyzing?: boolean
}

function MtfSlotDesktop({
  label,
  timeframe,
  url,
  disabled,
  isUploading,
  uploadProgress,
  onUpload,
  onRemove,
  onPreview,
}: {
  label: string
  timeframe: CoachMtfTimeframe
  url?: string | null
  disabled?: boolean
  isUploading: boolean
  uploadProgress: number
  onUpload: (file: File) => void
  onRemove: () => void
  onPreview: (url: string, title: string) => void
}) {
  const [isDragging, setIsDragging] = useState(false)
  const inputId = `mtf-upload-${timeframe}`

  if (url) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-black/20">
        <button
          type="button"
          className="block w-full"
          onClick={() => onPreview(url, label)}
        >
          <img src={url} alt={label} className="h-24 w-full object-cover sm:h-24" />
        </button>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
          <p className="text-[10px] font-medium text-foreground/90">{label}</p>
        </div>
        {!disabled && (
          <div className="absolute right-1.5 top-1.5 flex gap-1">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-7 border-white/[0.08] bg-background/80"
              disabled={isUploading}
              onClick={() => document.getElementById(inputId)?.click()}
            >
              <RefreshCw className="size-3" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-7 border-loss/25 bg-background/80"
              onClick={onRemove}
            >
              <Trash2 className="size-3 text-loss" />
            </Button>
          </div>
        )}
        <input
          id={inputId}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          className="hidden"
          disabled={disabled || isUploading}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onUpload(file)
            event.target.value = ""
          }}
        />
      </div>
    )
  }

  return (
    <label
      htmlFor={inputId}
      className={cn(
        "add-trade-dropzone flex h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-2 transition-all",
        disabled || isUploading
          ? "cursor-not-allowed opacity-60"
          : isDragging
            ? "border-cyan-glow bg-cyan-glow/[0.08]"
            : "border-white/[0.08] bg-white/[0.02] hover:border-cyan-glow/30",
      )}
      onDragOver={(event) => {
        event.preventDefault()
        if (!disabled && !isUploading) setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setIsDragging(false)
        if (disabled || isUploading) return
        const file = event.dataTransfer.files?.[0]
        if (file) onUpload(file)
      }}
    >
      <input
        id={inputId}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
        disabled={disabled || isUploading}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onUpload(file)
          event.target.value = ""
        }}
      />
      {isUploading ? (
        <div className="flex w-full flex-col items-center gap-1 px-2">
          <Loader2 className="size-5 animate-spin text-cyan-glow" />
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.05]">
            <div
              className="h-full bg-cyan-glow transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      ) : (
        <>
          <Upload className="size-4 text-muted-foreground/60" />
          <p className="mt-1 text-center text-[10px] font-medium leading-tight text-foreground/85">
            {label}
          </p>
        </>
      )}
    </label>
  )
}

function MtfMobileStripSlot({
  slot,
  url,
  disabled,
  isUploading,
  onUpload,
  onRemove,
  onPreview,
}: {
  slot: (typeof MTF_SLOTS)[number]
  url?: string | null
  disabled?: boolean
  isUploading: boolean
  onUpload: (file: File) => void
  onRemove: () => void
  onPreview: (url: string, title: string) => void
}) {
  const inputId = `mtf-upload-mobile-${slot.id}`

  if (url) {
    return (
      <div className="chart-upload-thumb-wrap relative shrink-0">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onPreview(url, slot.label)}
          className="chart-upload-thumb overflow-hidden border border-white/[0.1] bg-black/25"
        >
          <img src={url} alt={slot.label} className="size-full object-cover" />
          <span className="chart-upload-thumb-label">{slot.shortLabel}</span>
        </button>
        {!disabled && (
          <button
            type="button"
            onClick={onRemove}
            className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full border border-white/10 bg-black/90"
            aria-label={`Remove ${slot.shortLabel}`}
          >
            <Trash2 className="size-3 text-loss" />
          </button>
        )}
        <input
          id={inputId}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          className="hidden"
          disabled={disabled || isUploading}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onUpload(file)
            event.target.value = ""
          }}
        />
      </div>
    )
  }

  return (
    <label
      htmlFor={inputId}
      className={cn(
        "chart-upload-thumb chart-upload-add-btn shrink-0 cursor-pointer border border-dashed border-white/[0.14] bg-white/[0.03]",
        (disabled || isUploading) && "cursor-not-allowed opacity-60",
      )}
    >
      <input
        id={inputId}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
        disabled={disabled || isUploading}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onUpload(file)
          event.target.value = ""
        }}
      />
      {isUploading ? (
        <Loader2 className="size-4 animate-spin text-cyan-glow" />
      ) : (
        <>
          <Plus className="size-4 text-muted-foreground/70" />
          <span className="mt-0.5 text-[9px] font-medium text-muted-foreground/75">{slot.shortLabel}</span>
        </>
      )}
    </label>
  )
}

export function CoachMtfUploadGrid({
  session,
  disabled = false,
  onSessionUpdate,
  onRunAnalysis,
  isAnalyzing = false,
}: CoachMtfUploadGridProps) {
  const { uploadMtfChart, uploadingTimeframe, uploadProgress, error, setError } = useCoachMtfUpload(
    session.id,
  )
  const screenshots = getMtfScreenshotsFromSession(session)
  const uploadedCount = countMtfScreenshots(screenshots)
  const addInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null)
  const [addTarget, setAddTarget] = useState<CoachMtfTimeframe | null>(null)

  const firstEmptySlot = useMemo(
    () => MTF_SLOTS.find((slot) => !screenshots[slot.id])?.id ?? null,
    [screenshots],
  )

  const countLabel =
    uploadedCount === 1
      ? "1 chart uploaded"
      : `${uploadedCount} charts uploaded`

  const handleUpload = useCallback(
    async (timeframe: CoachMtfTimeframe, file: File) => {
      setError(null)
      try {
        await uploadMtfChart(timeframe, file)
        const refreshed = await fetch(`/api/coach/sessions/${session.id}`, {
          credentials: "same-origin",
        }).then((response) => response.json())
        onSessionUpdate(refreshed)
      } catch {
        // error handled in hook
      }
    },
    [onSessionUpdate, session.id, setError, uploadMtfChart],
  )

  const handleRemove = useCallback(
    async (timeframe: CoachMtfTimeframe) => {
      setError(null)
      try {
        const response = await fetch(`/api/coach/sessions/${session.id}/mtf`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ timeframe }),
        })
        const refreshed = await response.json()
        if (!response.ok) throw new Error(refreshed.error || "Remove failed")
        onSessionUpdate(refreshed)
      } catch (removeError) {
        setError(removeError instanceof Error ? removeError.message : "Could not remove chart")
      }
    },
    [onSessionUpdate, session.id, setError],
  )

  function triggerAddCharts() {
    if (!firstEmptySlot) return
    setAddTarget(firstEmptySlot)
    requestAnimationFrame(() => addInputRef.current?.click())
  }

  return (
    <div className="coach-mtf-upload-root flex flex-col gap-2">
      <div className="coach-mtf-upload-zone shrink-0">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-[11px] font-medium text-foreground/85">{countLabel}</p>
          {uploadedCount < 5 ? (
            <p className="text-[10px] text-amber-400/85">Up to 5 timeframes</p>
          ) : null}
        </div>

        {/* Mobile: compact horizontal strip */}
        <div className="coach-mtf-upload-strip">
          <div className="chart-upload-thumb-row -mx-0.5 flex items-center gap-2 overflow-x-auto pb-0.5">
            {MTF_SLOTS.map((slot) => {
              const url = screenshots[slot.id]
              if (url) {
                return (
                  <MtfMobileStripSlot
                    key={slot.id}
                    slot={slot}
                    url={url}
                    disabled={disabled}
                    isUploading={uploadingTimeframe === slot.id}
                    onUpload={(file) => void handleUpload(slot.id, file)}
                    onRemove={() => void handleRemove(slot.id)}
                    onPreview={(u, title) => setPreview({ url: u, title })}
                  />
                )
              }
              return null
            })}
            {firstEmptySlot ? (
              <button
                type="button"
                disabled={disabled || Boolean(uploadingTimeframe)}
                onClick={triggerAddCharts}
                className="chart-upload-thumb chart-upload-add-btn shrink-0 border border-dashed border-white/[0.14] bg-white/[0.03] text-muted-foreground/80 hover:border-cyan-glow/35 hover:text-cyan-glow"
              >
                {uploadingTimeframe && !screenshots[uploadingTimeframe] ? (
                  <Loader2 className="size-4 animate-spin text-cyan-glow" />
                ) : (
                  <>
                    <Plus className="size-4" />
                    <span className="mt-0.5 text-[9px] font-medium">Add Charts</span>
                  </>
                )}
              </button>
            ) : null}
          </div>
        </div>

        {/* Desktop: full grid */}
        <div className="coach-mtf-upload-grid">
          {MTF_SLOTS.map((slot) => (
            <MtfSlotDesktop
              key={slot.id}
              label={slot.label}
              timeframe={slot.id}
              url={screenshots[slot.id]}
              disabled={disabled}
              isUploading={uploadingTimeframe === slot.id}
              uploadProgress={uploadProgress}
              onUpload={(file) => void handleUpload(slot.id, file)}
              onRemove={() => void handleRemove(slot.id)}
              onPreview={(url, title) => setPreview({ url, title })}
            />
          ))}
        </div>

        <input
          ref={addInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          className="hidden"
          disabled={disabled || !addTarget}
          onChange={(event) => {
            const file = event.target.files?.[0]
            const target = addTarget ?? firstEmptySlot
            if (file && target) void handleUpload(target, file)
            event.target.value = ""
            setAddTarget(null)
          }}
        />
      </div>

      {error && (
        <p className="flex shrink-0 items-start gap-1.5 text-[11px] text-loss/90">
          <X className="mt-0.5 size-3 shrink-0" />
          {error}
        </p>
      )}

      <Button
        type="button"
        disabled={disabled || uploadedCount === 0 || isAnalyzing || Boolean(uploadingTimeframe)}
        onClick={() => void onRunAnalysis()}
        className="mobile-sticky-submit h-11 w-full shrink-0 bg-gradient-to-r from-cyan-glow to-profit text-background"
      >
        {isAnalyzing ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          `Run Multi-Timeframe Analysis (${uploadedCount}/5)`
        )}
      </Button>

      <ScreenshotViewerModal
        open={Boolean(preview)}
        imageUrl={preview?.url ?? null}
        title={preview?.title ?? "Chart"}
        onClose={() => setPreview(null)}
      />
    </div>
  )
}
