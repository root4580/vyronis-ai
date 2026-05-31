"use client"

import { useRef, useState } from "react"
import { Lightbulb, ScanLine, Target, TrendingDown, TrendingUp, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import { parsePlanPointerLine } from "@/lib/trade-planner/plan-chart-vision-types"
import { cn } from "@/lib/utils"

const ALLOWED_FILE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
const MAX_FILE_SIZE = 10 * 1024 * 1024

type PlanChartUploadPanelProps = {
  screenshotUrl: string | null
  pointers: string[]
  isUploading: boolean
  isAnalyzing: boolean
  onUpload: (file: File) => void
  onRemove: () => void
  disabled?: boolean
  className?: string
}

function validateChartFile(file: File): string | null {
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return "Invalid file type. Allowed: jpg, jpeg, png, webp"
  }
  if (file.size > MAX_FILE_SIZE) {
    return "File too large. Maximum size is 10MB"
  }
  return null
}

function PointerBadge({ category }: { category: ReturnType<typeof parsePlanPointerLine>["category"] }) {
  switch (category) {
    case "sl":
      return (
        <Badge variant="outline" className="border-loss/30 bg-loss/[0.08] text-[9px] text-loss">
          SL
        </Badge>
      )
    case "tp":
      return (
        <Badge variant="outline" className="border-profit/30 bg-profit/[0.08] text-[9px] text-profit">
          TP
        </Badge>
      )
    case "structure":
      return (
        <Badge variant="outline" className="border-cyan-glow/30 bg-cyan-glow/[0.08] text-[9px] text-cyan-glow">
          Structure
        </Badge>
      )
    case "rr":
      return (
        <Badge variant="outline" className="border-amber-500/30 bg-amber-500/[0.08] text-[9px] text-amber-200">
          R:R
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-[9px] text-muted-foreground">
          Tip
        </Badge>
      )
  }
}

function PointerIcon({ category }: { category: ReturnType<typeof parsePlanPointerLine>["category"] }) {
  switch (category) {
    case "sl":
      return <TrendingDown className="mt-0.5 size-3 shrink-0 text-loss/80" />
    case "tp":
      return <Target className="mt-0.5 size-3 shrink-0 text-profit/80" />
    case "structure":
      return <ScanLine className="mt-0.5 size-3 shrink-0 text-cyan-glow/80" />
    case "rr":
      return <TrendingUp className="mt-0.5 size-3 shrink-0 text-amber-300/80" />
    default:
      return <Lightbulb className="mt-0.5 size-3 shrink-0 text-cyan-glow/70" />
  }
}

export function PlanChartUploadPanel({
  screenshotUrl,
  pointers,
  isUploading,
  isAnalyzing,
  onUpload,
  onRemove,
  disabled = false,
  className,
}: PlanChartUploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const busy = disabled || isUploading || isAnalyzing

  function handleFile(file: File | null | undefined) {
    if (!file || busy) return
    const error = validateChartFile(file)
    if (error) {
      setLocalError(error)
      return
    }
    setLocalError(null)
    onUpload(file)
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
          Chart screenshot
        </p>
        <p className="text-[10px] text-muted-foreground/55">MT5 · TradingView · mobile</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_FILE_TYPES.join(",")}
        className="hidden"
        onChange={(event) => {
          handleFile(event.target.files?.[0])
          event.target.value = ""
        }}
      />

      {screenshotUrl ? (
        <DashboardInsetPanel className="overflow-hidden p-0">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={screenshotUrl}
              alt="Trade plan chart"
              className="max-h-40 w-full object-cover object-top"
            />
            <button
              type="button"
              disabled={busy}
              onClick={onRemove}
              className="absolute right-2 top-2 rounded-full border border-white/10 bg-black/80 p-1.5 text-muted-foreground hover:text-foreground"
              aria-label="Remove chart"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <p className="text-[11px] text-muted-foreground/75">
              {isAnalyzing ? "Reading entry, SL, and TP…" : "Levels autofilled from chart"}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              className="h-8 border-white/[0.08] bg-white/[0.03] text-[11px]"
              onClick={() => inputRef.current?.click()}
            >
              Replace
            </Button>
          </div>
        </DashboardInsetPanel>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault()
            if (!busy) setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            handleFile(event.dataTransfer.files?.[0])
          }}
          className={cn(
            "flex w-full flex-col items-center justify-center rounded-xl border border-dashed px-4 py-6 text-center transition-colors",
            dragging
              ? "border-cyan-glow/40 bg-cyan-glow/[0.08]"
              : "border-white/[0.1] bg-black/20 hover:border-cyan-glow/25 hover:bg-cyan-glow/[0.04]",
            busy && "cursor-not-allowed opacity-60",
          )}
        >
          {isUploading || isAnalyzing ? (
            <>
              <span className="mb-2 size-5 animate-spin rounded-full border-2 border-cyan-glow/30 border-t-cyan-glow" />
              <p className="text-[12px] font-medium text-foreground/90">
                {isUploading ? "Uploading chart…" : "Analyzing levels…"}
              </p>
            </>
          ) : (
            <>
              <Upload className="mb-2 size-5 text-cyan-glow/80" />
              <p className="text-[12px] font-medium text-foreground/90">
                Drop chart or tap to upload
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground/70">
                Autofills entry, stop loss, and take profit
              </p>
            </>
          )}
        </button>
      )}

      {localError ? (
        <p className="text-[11px] text-loss">{localError}</p>
      ) : null}

      {pointers.length > 0 ? (
        <DashboardInsetPanel className="border-cyan-glow/20 bg-cyan-glow/[0.04] px-3 py-2.5">
          <div className="mb-2 flex items-center gap-2">
            <Lightbulb className="size-3.5 text-cyan-glow" />
            <p className="text-[11px] font-medium text-foreground/90">Plan pointers</p>
          </div>
          <ul className="space-y-2">
            {pointers.map((pointer) => {
              const parsed = parsePlanPointerLine(pointer)
              return (
                <li
                  key={pointer}
                  className="flex items-start gap-2 rounded-lg border border-white/[0.04] bg-black/15 px-2.5 py-2"
                >
                  <PointerIcon category={parsed.category} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <PointerBadge category={parsed.category} />
                    <p className="text-[11px] leading-relaxed text-muted-foreground/90">{parsed.message}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </DashboardInsetPanel>
      ) : null}
    </div>
  )
}
