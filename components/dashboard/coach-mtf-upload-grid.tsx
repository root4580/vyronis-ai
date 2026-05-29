"use client"

import { useCallback, useState } from "react"
import { Loader2, RefreshCw, Trash2, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
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

function MtfSlot({
  label,
  timeframe,
  url,
  disabled,
  isUploading,
  uploadProgress,
  onUpload,
  onRemove,
}: {
  label: string
  timeframe: CoachMtfTimeframe
  url?: string | null
  disabled?: boolean
  isUploading: boolean
  uploadProgress: number
  onUpload: (file: File) => void
  onRemove: () => void
}) {
  const [isDragging, setIsDragging] = useState(false)
  const inputId = `mtf-upload-${timeframe}`

  if (url) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-black/20">
        <img src={url} alt={label} className="coach-mtf-slot-preview h-20 w-full object-cover sm:h-24" />
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
        "add-trade-dropzone flex h-20 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-2 transition-all sm:h-24",
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
        <div className="flex w-full flex-col items-center gap-1">
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
          <p className="text-[9px] text-muted-foreground/55">Drop or click</p>
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground/75">
          {uploadedCount}/5 charts uploaded
        </p>
        {uploadedCount < 5 && (
          <p className="text-[10px] text-amber-400/85">Missing charts reduce score confidence</p>
        )}
      </div>

      <div className="coach-mtf-upload-grid">
        {MTF_SLOTS.map((slot) => (
          <MtfSlot
            key={slot.id}
            label={slot.label}
            timeframe={slot.id}
            url={screenshots[slot.id]}
            disabled={disabled}
            isUploading={uploadingTimeframe === slot.id}
            uploadProgress={uploadProgress}
            onUpload={(file) => void handleUpload(slot.id, file)}
            onRemove={() => void handleRemove(slot.id)}
          />
        ))}
      </div>

      {error && (
        <p className="flex items-start gap-1.5 text-[11px] text-loss/90">
          <X className="mt-0.5 size-3 shrink-0" />
          {error}
        </p>
      )}

      <Button
        type="button"
        disabled={disabled || uploadedCount === 0 || isAnalyzing || Boolean(uploadingTimeframe)}
        onClick={() => void onRunAnalysis()}
        className="mobile-sticky-submit h-11 w-full bg-gradient-to-r from-cyan-glow to-profit text-background"
      >
        {isAnalyzing ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          `Run Multi-Timeframe Analysis (${uploadedCount}/5)`
        )}
      </Button>
    </div>
  )
}
