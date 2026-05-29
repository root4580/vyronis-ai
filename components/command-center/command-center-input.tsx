"use client"

import { FormEvent, useRef, useState } from "react"
import { ImagePlus, Loader2, SendHorizonal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  ChartUploadThumbnailStrip,
  type ChartThumbnailItem,
} from "@/components/ui/chart-upload-thumbnail-strip"
import { useCoachChartUpload } from "@/hooks/use-coach-chart-upload"
import { cn } from "@/lib/utils"

import type { CommandCenterChatSendInput } from "@/lib/command-center/types"

export type CommandCenterSendInput = Pick<
  CommandCenterChatSendInput,
  "content" | "imageUrl" | "imageUrls"
>

type PendingImage = {
  id: string
  file: File
  previewUrl: string
}

type CommandCenterInputProps = {
  onSend: (input: CommandCenterSendInput) => Promise<void>
  disabled?: boolean
  placeholder?: string
  className?: string
}

const ACCEPT = "image/png,image/jpeg,image/jpg,image/webp"
const MAX_BUNDLE_IMAGES = 6

export function CommandCenterInput({
  onSend,
  disabled,
  placeholder = "Ask about setups, patterns, or how you're feeling…",
  className,
}: CommandCenterInputProps) {
  const [value, setValue] = useState("")
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const [isSending, setIsSending] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { uploadChart, uploadCharts, isUploading, uploadProgress, error: uploadError } =
    useCoachChartUpload()

  function revokePreview(item: PendingImage) {
    if (item.previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(item.previewUrl)
    }
  }

  function clearImages() {
    setPendingImages((prev) => {
      prev.forEach(revokePreview)
      return []
    })
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function removeImage(id: string) {
    setPendingImages((prev) => {
      const target = prev.find((item) => item.id === id)
      if (target) revokePreview(target)
      return prev.filter((item) => item.id !== id)
    })
  }

  function handleFilesSelect(fileList: FileList | null) {
    if (!fileList?.length) return
    const remaining = MAX_BUNDLE_IMAGES - pendingImages.length
    if (remaining <= 0) return

    const incoming = Array.from(fileList).slice(0, remaining)
    const next: PendingImage[] = incoming.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }))
    setPendingImages((prev) => [...prev, ...next])
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = value.trim()
    if ((!trimmed && pendingImages.length === 0) || isSending || disabled || isUploading) return

    setIsSending(true)
    const filesToUpload = pendingImages.map((item) => item.file)
    try {
      let imageUrl: string | null = null
      let imageUrls: string[] | null = null

      if (filesToUpload.length === 1) {
        imageUrl = await uploadChart(filesToUpload[0])
      } else if (filesToUpload.length > 1) {
        imageUrls = await uploadCharts(filesToUpload)
        imageUrl = imageUrls[0] ?? null
      }

      setValue("")
      clearImages()

      await onSend({ content: trimmed, imageUrl, imageUrls })
    } finally {
      setIsSending(false)
    }
  }

  const canSend = Boolean(value.trim() || pendingImages.length > 0)
  const busy = disabled || isSending || isUploading
  const isBundle = pendingImages.length > 1

  const thumbnailItems: ChartThumbnailItem[] = pendingImages.map((item, index) => ({
    id: item.id,
    url: item.previewUrl,
    label: isBundle ? `${index + 1}` : undefined,
    alt: `Chart ${index + 1}`,
  }))

  const countLabel =
    pendingImages.length === 0
      ? ""
      : pendingImages.length === 1
        ? "1 chart uploaded"
        : `${pendingImages.length} charts uploaded`

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className={cn(
        "command-center-input box-border flex w-full max-w-full min-w-0 flex-col gap-1.5 rounded-xl border border-white/[0.08] bg-black/30 p-2",
        className,
      )}
    >
      {pendingImages.length > 0 ? (
        <div className="shrink-0">
          <ChartUploadThumbnailStrip
            items={thumbnailItems}
            countLabel={countLabel}
            onAdd={() => fileInputRef.current?.click()}
            addLabel="+ Add Charts"
            onRemove={removeImage}
            disabled={busy}
            canAdd={pendingImages.length < MAX_BUNDLE_IMAGES}
          />
          {isUploading ? (
            <p className="mt-1 px-0.5 text-[10px] tabular-nums text-cyan-glow/80">
              Uploading… {uploadProgress}%
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex w-full min-w-0 shrink-0 items-end gap-1.5 sm:gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(event) => handleFilesSelect(event.target.files)}
        />
        {pendingImages.length === 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
            className="size-9 shrink-0 rounded-lg text-muted-foreground hover:bg-white/[0.06] hover:text-cyan-glow"
            aria-label="Upload chart images"
          >
            {isUploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ImagePlus className="size-4" />
            )}
          </Button>
        ) : null}
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          rows={2}
          placeholder={
            pendingImages.length > 0
              ? isBundle
                ? "Optional note for this timeframe bundle…"
                : "Add a note about this chart (optional)…"
              : placeholder
          }
          disabled={busy}
          className="command-center-input-field min-h-[40px] min-w-0 max-h-20 flex-1 resize-none bg-transparent px-1 py-1.5 text-[16px] leading-snug text-foreground placeholder:text-muted-foreground/50 focus:outline-none sm:max-h-24 sm:min-h-[44px] sm:text-[13px]"
          onFocus={(event) => {
            requestAnimationFrame(() => {
              event.target.scrollIntoView({ block: "end", behavior: "smooth" })
            })
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              void handleSubmit(event)
            }
          }}
        />
        <Button
          type="submit"
          size="icon"
          disabled={busy || !canSend}
          className="size-9 shrink-0 rounded-lg bg-cyan-glow/90 text-background hover:bg-cyan-glow"
          aria-label="Send message"
        >
          {isSending || isUploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <SendHorizonal className="size-4" />
          )}
        </Button>
      </div>

      {uploadError ? (
        <p className="shrink-0 px-1 text-[10px] text-amber-200/90">{uploadError}</p>
      ) : null}
    </form>
  )
}
