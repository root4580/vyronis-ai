"use client"

import { useCallback, useEffect, useState } from "react"
import { ImageIcon, X } from "lucide-react"
import { ChartAnnotatedImage } from "@/components/chart-annotations/chart-annotated-image"
import { ChartOverlayToggle } from "@/components/chart-annotations/chart-overlay-toggle"
import type { ChartAnnotation, ChartOverlayMode } from "@/lib/chart-annotations/types"
import { cn } from "@/lib/utils"

interface ScreenshotViewerModalProps {
  open: boolean
  imageUrl: string | null
  title?: string
  annotations?: ChartAnnotation[]
  defaultOverlayMode?: ChartOverlayMode
  onClose: () => void
}

const ANIMATION_MS = 240

function useViewerPresence(open: boolean) {
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(open)

  useEffect(() => {
    if (open) {
      setMounted(true)
      const frame = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(frame)
    }

    setVisible(false)
    const timer = window.setTimeout(() => setMounted(false), ANIMATION_MS)
    return () => window.clearTimeout(timer)
  }, [open])

  return { mounted, visible }
}

export function ScreenshotViewerModal({
  open,
  imageUrl,
  title = "Chart screenshot",
  annotations = [],
  defaultOverlayMode = "overlay",
  onClose,
}: ScreenshotViewerModalProps) {
  const { mounted, visible } = useViewerPresence(open)
  const [overlayMode, setOverlayMode] = useState<ChartOverlayMode>(defaultOverlayMode)

  useEffect(() => {
    if (open) setOverlayMode(defaultOverlayMode)
  }, [open, defaultOverlayMode, imageUrl])

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  useEffect(() => {
    if (!mounted) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose()
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [mounted, handleClose])

  if (!mounted) return null

  return (
    <div
      className={cn(
        "screenshot-viewer fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 md:p-8",
        visible ? "screenshot-viewer-open" : "screenshot-viewer-closing",
      )}
      role="dialog"
      aria-modal="true"
      aria-label={imageUrl ? `${title} screenshot` : "No screenshot uploaded"}
    >
      <button
        type="button"
        className="screenshot-viewer-overlay absolute inset-0 cursor-default"
        onClick={handleClose}
        aria-label="Close screenshot viewer"
      />

      <div
        className={cn(
          "screenshot-viewer-panel relative w-full overflow-hidden",
          imageUrl ? "max-w-6xl" : "max-w-md",
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative border-b border-white/[0.06] px-4 py-3 md:px-5">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-cyan-glow/[0.06] via-transparent to-profit/[0.06]" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-[10px] border border-cyan-glow/20 bg-cyan-glow/[0.08]">
                <ImageIcon className="size-4 text-cyan-glow" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-foreground">{title}</p>
                <p className="text-[11px] text-muted-foreground/70">
                  {imageUrl ? "Chart screenshot" : "No screenshot uploaded"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {imageUrl && annotations.length > 0 && (
                <ChartOverlayToggle mode={overlayMode} onChange={setOverlayMode} compact />
              )}
              <button
                type="button"
                onClick={handleClose}
                className="rounded-[10px] border border-white/[0.08] bg-white/[0.04] p-2 transition-all duration-200 hover:border-white/[0.14] hover:bg-white/[0.06] active:scale-95"
                aria-label="Close"
              >
                <X className="size-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>

        <div className="relative flex min-h-[200px] items-center justify-center bg-black/35 p-3 sm:min-h-[240px] sm:p-6">
          {imageUrl ? (
            <>
              <ChartAnnotatedImage
                src={imageUrl}
                alt={`${title} chart screenshot`}
                annotations={annotations}
                mode={overlayMode}
                className="max-h-[70vh] w-full sm:max-h-[75vh]"
                imageClassName="max-h-[70vh] rounded-xl border border-white/[0.08] object-contain shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:max-h-[75vh]"
              />
              <button
                type="button"
                onClick={handleClose}
                className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/75 px-3 py-1.5 text-[12px] font-semibold text-foreground shadow-lg backdrop-blur-sm transition-colors hover:bg-black/90 sm:right-5 sm:top-5"
                aria-label="Close chart view"
              >
                <X className="size-4" />
                Close
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center px-4 py-10 text-center sm:px-6 sm:py-12">
              <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] sm:size-16">
                <ImageIcon className="size-6 text-muted-foreground/30 sm:size-7" />
              </div>
              <p className="text-sm font-medium text-foreground/90">No screenshot uploaded</p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground/70">
                Attach a chart screenshot when logging or editing a trade.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
