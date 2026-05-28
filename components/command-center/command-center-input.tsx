"use client"

import { FormEvent, useRef, useState } from "react"
import { ImagePlus, Loader2, SendHorizonal, X } from "lucide-react"
import { Button } from "@/components/ui/button"
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

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className={cn(
        "command-center-input flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-black/30 p-2",
        className,
      )}
    >
      {pendingImages.length > 0 ? (
        <div className="mx-1 mt-1 space-y-2">
          <div className="flex items-center justify-between gap-2 px-0.5">
            <p className="text-[10px] text-muted-foreground/70">
              {isBundle
                ? `${pendingImages.length} charts — timeframe bundle`
                : "1 chart selected"}
            </p>
            {isUploading ? (
              <span className="text-[10px] tabular-nums text-cyan-glow/80">
                Uploading… {uploadProgress}%
              </span>
            ) : null}
          </div>
          <div
            className={cn(
              "grid gap-2",
              pendingImages.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3",
            )}
          >
            {pendingImages.map((item, index) => (
              <div key={item.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.previewUrl}
                  alt={`Chart ${index + 1} preview`}
                  className="h-24 w-full rounded-lg border border-white/[0.1] object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(item.id)}
                  disabled={busy}
                  className="absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full border border-white/10 bg-black/85 text-muted-foreground hover:text-foreground"
                  aria-label={`Remove chart ${index + 1}`}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(event) => handleFilesSelect(event.target.files)}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={busy || pendingImages.length >= MAX_BUNDLE_IMAGES}
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
          className="max-h-24 min-h-[44px] flex-1 resize-none bg-transparent px-1 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
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
        >
          {isSending || isUploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <SendHorizonal className="size-4" />
          )}
        </Button>
      </div>

      {uploadError ? (
        <p className="px-1 text-[10px] text-amber-200/90">{uploadError}</p>
      ) : null}
    </form>
  )
}
