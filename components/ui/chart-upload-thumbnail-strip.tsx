"use client"

import { useState } from "react"
import { Plus, X } from "lucide-react"
import { ScreenshotViewerModal } from "@/components/dashboard/screenshot-viewer-modal"
import { cn } from "@/lib/utils"

export type ChartThumbnailItem = {
  id: string
  url: string
  label?: string
  alt?: string
}

type ChartUploadThumbnailStripProps = {
  items: ChartThumbnailItem[]
  countLabel: string
  onAdd?: () => void
  addLabel?: string
  onRemove?: (id: string) => void
  onPreview?: (item: ChartThumbnailItem) => void
  disabled?: boolean
  canAdd?: boolean
  className?: string
}

export function ChartUploadThumbnailStrip({
  items,
  countLabel,
  onAdd,
  addLabel = "+ Add Charts",
  onRemove,
  onPreview,
  disabled = false,
  canAdd = true,
  className,
}: ChartUploadThumbnailStripProps) {
  const [preview, setPreview] = useState<ChartThumbnailItem | null>(null)

  function openPreview(item: ChartThumbnailItem) {
    if (onPreview) {
      onPreview(item)
      return
    }
    setPreview(item)
  }

  return (
    <>
      <div className={cn("chart-upload-compact-zone space-y-1.5", className)}>
        <p className="text-[11px] font-medium text-foreground/85">{countLabel}</p>
        <div className="chart-upload-thumb-row -mx-0.5 flex items-center gap-2 overflow-x-auto pb-0.5">
          {items.map((item) => (
            <div key={item.id} className="chart-upload-thumb-wrap relative shrink-0">
              <button
                type="button"
                disabled={disabled}
                onClick={() => openPreview(item)}
                className="chart-upload-thumb overflow-hidden border border-white/[0.1] bg-black/25"
                aria-label={item.alt ?? item.label ?? "Preview chart"}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={item.alt ?? item.label ?? "Chart"}
                  className="size-full object-cover"
                />
                {item.label ? (
                  <span className="chart-upload-thumb-label">{item.label}</span>
                ) : null}
              </button>
              {onRemove ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onRemove(item.id)}
                  className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full border border-white/10 bg-black/90 text-muted-foreground hover:text-foreground"
                  aria-label={`Remove ${item.label ?? "chart"}`}
                >
                  <X className="size-3" />
                </button>
              ) : null}
            </div>
          ))}
          {canAdd && onAdd ? (
            <button
              type="button"
              disabled={disabled}
              onClick={onAdd}
              className="chart-upload-thumb chart-upload-add-btn shrink-0 border border-dashed border-white/[0.14] bg-white/[0.03] text-muted-foreground/80 hover:border-cyan-glow/35 hover:text-cyan-glow"
            >
              <Plus className="size-4" />
              <span className="mt-0.5 max-w-[72px] text-center text-[9px] font-medium leading-tight">
                {addLabel.replace(/^\+ /, "")}
              </span>
            </button>
          ) : null}
        </div>
      </div>

      <ScreenshotViewerModal
        open={Boolean(preview)}
        imageUrl={preview?.url ?? null}
        title={preview?.label ?? "Chart preview"}
        onClose={() => setPreview(null)}
      />
    </>
  )
}
