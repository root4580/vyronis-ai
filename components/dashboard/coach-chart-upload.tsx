"use client"

import { useCallback, useRef, useState } from "react"
import { Loader2, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChartUploadThumbnailStrip } from "@/components/ui/chart-upload-thumbnail-strip"
import { useCoachChartUpload } from "@/hooks/use-coach-chart-upload"
import { cn } from "@/lib/utils"

type CoachChartUploadProps = {
  chartUrl?: string | null
  disabled?: boolean
  allowReplace?: boolean
  onUploaded: (url: string, replace?: boolean) => void | Promise<void>
  onRemove?: () => void | Promise<void>
}

export function CoachChartUpload({
  chartUrl,
  disabled = false,
  allowReplace = true,
  onUploaded,
  onRemove,
}: CoachChartUploadProps) {
  const { uploadChart, isUploading, uploadProgress, error, setError } = useCoachChartUpload()
  const [isDragging, setIsDragging] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const replaceInputRef = useRef<HTMLInputElement | null>(null)

  const handleFile = useCallback(
    async (file: File, replace = false) => {
      if (disabled || isSubmitting) return
      setError(null)
      setIsSubmitting(true)
      try {
        const url = await uploadChart(file)
        await onUploaded(url, replace)
      } catch {
        // error state handled in hook
      } finally {
        setIsSubmitting(false)
      }
    },
    [disabled, isSubmitting, onUploaded, setError, uploadChart],
  )

  const busy = isUploading || isSubmitting

  if (chartUrl) {
    return (
      <div className="space-y-2">
        <ChartUploadThumbnailStrip
          items={[{ id: "chart", url: chartUrl, label: "Chart", alt: "Trade chart" }]}
          countLabel="1 chart uploaded"
          onAdd={allowReplace ? () => replaceInputRef.current?.click() : undefined}
          addLabel="+ Replace"
          onRemove={allowReplace && onRemove ? () => void onRemove() : undefined}
          disabled={disabled || busy}
          canAdd={allowReplace}
        />
        {busy && (
          <div className="flex items-center gap-2 text-[11px] text-cyan-glow">
            <Loader2 className="size-4 animate-spin" />
            Running Chart Vision analysis...
          </div>
        )}
        <input
          ref={replaceInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          className="hidden"
          disabled={disabled || busy}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void handleFile(file, true)
            event.target.value = ""
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <label
        className={cn(
          "add-trade-dropzone flex h-24 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all duration-300 sm:h-36",
          disabled || busy
            ? "cursor-not-allowed opacity-60"
            : isDragging
              ? "scale-[1.01] border-cyan-glow bg-cyan-glow/[0.1] shadow-[0_0_24px_rgb(from var(--color-accent) r g b / 0.15)]"
              : "border-white/[0.08] bg-white/[0.02] hover:border-cyan-glow/30 hover:bg-cyan-glow/[0.04]",
        )}
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled && !busy) setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          if (disabled || busy) return
          const file = event.dataTransfer.files?.[0]
          if (file) void handleFile(file, false)
        }}
      >
        <input
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          className="hidden"
          disabled={disabled || busy}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void handleFile(file, false)
            event.target.value = ""
          }}
        />
        {busy ? (
          <div className="flex w-full max-w-xs flex-col items-center gap-2 px-6">
            <Loader2 className="size-8 animate-spin text-cyan-glow" />
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
              <div
                className="h-full bg-gradient-to-r from-cyan-glow to-profit transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <span className="text-[11px] text-cyan-glow">
              {isUploading ? `${uploadProgress}% uploading` : "Running Chart Vision..."}
            </span>
          </div>
        ) : (
          <>
            <Upload className={cn("size-6", isDragging ? "text-cyan-glow" : "text-muted-foreground/60")} />
            <p className="mt-2 text-[12px] font-medium text-foreground/85">
              Upload chart screenshot first
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground/70">
              {isDragging ? "Drop screenshot here" : "Drag & drop or click to upload"}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground/50">PNG, JPG, JPEG, WebP up to 10MB</p>
          </>
        )}
      </label>

      {error && (
        <p className="flex items-start gap-1.5 text-[11px] text-loss/90">
          <X className="mt-0.5 size-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}
