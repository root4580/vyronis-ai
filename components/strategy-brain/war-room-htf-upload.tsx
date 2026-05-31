"use client"

import { useRef, useState } from "react"
import { Camera, Loader2, Sparkles, X } from "lucide-react"
import { ScreenshotViewerModal } from "@/components/dashboard/screenshot-viewer-modal"
import { Button } from "@/components/ui/button"
import { fetchWarRoomVisionAutofill } from "@/lib/strategy-brain/api-client"
import type { WarRoomVisionAutofill } from "@/lib/strategy-brain/war-room-vision-types"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

/** W, D, H4, H1, M15 — same stack as chart coach */
export const WAR_ROOM_MAX_CHARTS = 5

type WarRoomHtfUploadProps = {
  urls: string[]
  onUrlsChange: (urls: string[]) => void
  pairHint?: string
  pairLabel?: string
  disabled?: boolean
  className?: string
  onAutofill?: (result: WarRoomVisionAutofill) => void
  onBiasSuggest?: (bias: {
    weekly_bias: import("@/lib/strategy-brain/types").BiasDirection
    daily_bias: import("@/lib/strategy-brain/types").BiasDirection
    h4_bias: import("@/lib/strategy-brain/types").BiasDirection
  }) => void
}

export async function uploadWarRoomChart(file: File): Promise<string> {
  const formData = new FormData()
  formData.append("file", file)
  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
    credentials: "same-origin",
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || "Upload failed")
  }
  const { url } = (await res.json()) as { url: string }
  return url
}

export function WarRoomHtfUpload({
  urls,
  onUrlsChange,
  pairHint,
  pairLabel,
  disabled = false,
  className,
  onAutofill,
  onBiasSuggest,
}: WarRoomHtfUploadProps) {
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [preview, setPreview] = useState<WarRoomVisionAutofill | null>(null)
  const [chartPreview, setChartPreview] = useState<{ url: string; title: string } | null>(null)

  async function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList)
    const remaining = WAR_ROOM_MAX_CHARTS - urls.length
    if (remaining <= 0) {
      toast({
        title: `Maximum ${WAR_ROOM_MAX_CHARTS} charts (W → M15)`,
        variant: "destructive",
      })
      return
    }
    const batch = files.slice(0, remaining)
    if (files.length > remaining) {
      toast({
        title: `Added first ${remaining} image${remaining === 1 ? "" : "s"}`,
        description: `Order: Weekly → Daily → H4 → H1 → M15 (${remaining} slots left).`,
      })
    }

    setUploading(true)
    const nextUrls = [...urls]
    try {
      for (const file of batch) {
        const url = await uploadWarRoomChart(file)
        nextUrls.push(url)
      }
      onUrlsChange(nextUrls.slice(0, WAR_ROOM_MAX_CHARTS))
      setPreview(null)
      toast({
        title: batch.length === 1 ? "Chart added" : `${batch.length} charts added`,
        description: "In upload order: W → D → H4 → H1 → M15.",
      })
    } catch (e) {
      if (nextUrls.length > urls.length) {
        onUrlsChange(nextUrls.slice(0, WAR_ROOM_MAX_CHARTS))
      }
      toast({
        title: "Upload failed",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }

  async function runAnalyze() {
    if (urls.length === 0) return
    setAnalyzing(true)
    setPreview(null)
    try {
      const result = await fetchWarRoomVisionAutofill({
        imageUrls: urls,
        pairHint: pairHint || pairLabel,
      })
      setPreview(result)
      if (!result.available) {
        toast({
          title: "Limited autofill",
          description: result.comparisonSummary,
        })
      }
    } catch (e) {
      toast({
        title: "Analysis failed",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      })
    } finally {
      setAnalyzing(false)
    }
  }

  function applyPreview() {
    if (!preview) return
    onAutofill?.(preview)
    if (onBiasSuggest) {
      onBiasSuggest({
        weekly_bias: preview.weekly_bias,
        daily_bias: preview.daily_bias,
        h4_bias: preview.h4_bias,
      })
    }
    toast({
      title: "Autofill applied",
      description: "Review prices and thesis, then save your weekly plan.",
    })
    setPreview(null)
  }

  return (
    <div className={className}>
      <p className="text-[9px] font-medium uppercase tracking-[0.1em] text-muted-foreground/60">
        Timeframe charts{pairLabel ? ` — ${pairLabel}` : ""}
        <span className="ml-1 font-normal normal-case text-muted-foreground/50">
          (upload W, D, H4, H1, M15 — then analyze)
        </span>
      </p>
      {urls.length > 0 ? (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {urls.map((url, index) => (
            <div key={url} className="relative shrink-0">
              <button
                type="button"
                className="block cursor-zoom-in"
                onClick={() =>
                  setChartPreview({
                    url,
                    title: pairLabel ? `${pairLabel} chart ${index + 1}` : `Chart ${index + 1}`,
                  })
                }
              >
                <img
                  src={url}
                  alt={`Chart ${index + 1}`}
                  className="h-16 w-24 rounded-md border border-white/[0.08] object-cover"
                />
              </button>
              <span className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 text-[8px] text-foreground/80">
                {index + 1}
              </span>
              {!disabled ? (
                <button
                  type="button"
                  aria-label="Remove chart"
                  className="absolute -right-1 -top-1 rounded-full border border-white/10 bg-black/80 p-0.5 text-muted-foreground hover:text-loss"
                  onClick={() => {
                    onUrlsChange(urls.filter((u) => u !== url))
                    setPreview(null)
                  }}
                >
                  <X className="size-3" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-[10px] text-muted-foreground/55">
          Select up to 5 images at once — order should be Weekly, Daily, H4, H1, M15.
        </p>
      )}
      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const list = e.target.files
          if (list?.length) void handleFiles(list)
          e.target.value = ""
        }}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-[10px]"
          disabled={disabled || uploading || urls.length >= WAR_ROOM_MAX_CHARTS}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="mr-1 size-3 animate-spin" />
          ) : (
            <Camera className="mr-1 size-3" />
          )}
          Add charts ({urls.length}/{WAR_ROOM_MAX_CHARTS}) — multi-select OK
        </Button>
        {onAutofill ? (
          <Button
            type="button"
            size="sm"
            className="h-8 border-cyan-glow/30 bg-cyan-glow/10 text-[10px] text-cyan-glow hover:bg-cyan-glow/15"
            disabled={disabled || analyzing || urls.length === 0}
            onClick={() => void runAnalyze()}
          >
            {analyzing ? (
              <Loader2 className="mr-1 size-3 animate-spin" />
            ) : (
              <Sparkles className="mr-1 size-3" />
            )}
            Analyze &amp; autofill
          </Button>
        ) : null}
      </div>

      {preview ? (
        <div
          className={cn(
            "mt-3 space-y-2 rounded-lg border p-2.5 text-[11px]",
            preview.available
              ? "border-cyan-glow/25 bg-cyan-glow/[0.06]"
              : "border-warning/25 bg-warning/[0.06]",
          )}
        >
          <p className="font-medium text-foreground/90">
            {preview.pair} · {preview.inferredStack}
            {preview.setupGrade ? ` · Grade ${preview.setupGrade}` : ""}
          </p>
          <p className="leading-relaxed text-muted-foreground/85">{preview.comparisonSummary}</p>
          <div className="grid grid-cols-3 gap-1.5 tabular-nums text-[10px]">
            <span>AOI: {preview.aoi_low ?? "—"} – {preview.aoi_high ?? "—"}</span>
            <span>Inv: {preview.invalidation ?? "—"}</span>
            <span>Bias: {preview.directional_bias}</span>
          </div>
          <p className="text-[10px] text-muted-foreground/70">
            HTF: W {preview.weekly_bias} · D {preview.daily_bias} · H4 {preview.h4_bias}
          </p>
          <Button
            type="button"
            size="sm"
            className="h-8 w-full bg-cyan-glow/90 text-[10px] text-background"
            onClick={applyPreview}
          >
            Apply to this pair{onBiasSuggest ? " + HTF bias" : ""}
          </Button>
        </div>
      ) : null}

      <ScreenshotViewerModal
        open={Boolean(chartPreview)}
        imageUrl={chartPreview?.url ?? null}
        title={chartPreview?.title ?? "Chart"}
        onClose={() => setChartPreview(null)}
      />
    </div>
  )
}
