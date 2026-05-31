"use client"

import { useCallback, useState } from "react"
import type { CoachMtfTimeframe } from "@/lib/coach/mtf-constants"
import type { TradeCoachSessionWithMessages } from "@/lib/trade-coach/types"

const ALLOWED_FILE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"]
const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_DIMENSION = 1920
const JPEG_QUALITY = 0.85

export type CoachMtfUploadResult = {
  url: string
  session: TradeCoachSessionWithMessages
}

function isAllowedChartFile(file: File): boolean {
  if (ALLOWED_FILE_TYPES.includes(file.type)) return true
  const lower = file.name.toLowerCase()
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 400_000) return file

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")
  if (!context) {
    bitmap.close()
    return file
  }

  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const outputType = file.type === "image/png" ? "image/webp" : file.type || "image/jpeg"
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, outputType, JPEG_QUALITY)
  })

  if (!blob || blob.size >= file.size) return file
  const extension = outputType.split("/")[1] || "webp"
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.${extension}`, { type: outputType })
}

export function useCoachMtfUpload(sessionId: string) {
  const [uploadingTimeframe, setUploadingTimeframe] = useState<CoachMtfTimeframe | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const uploadMtfChart = useCallback(
    async (timeframe: CoachMtfTimeframe, file: File): Promise<CoachMtfUploadResult> => {
      if (!isAllowedChartFile(file)) {
        throw new Error("Use JPG, PNG, or WebP chart screenshots (HEIC/iPhone photos: export as JPG first).")
      }
      if (file.size > MAX_FILE_SIZE) {
        throw new Error("File too large. Maximum size is 10MB")
      }

      setUploadingTimeframe(timeframe)
      setUploadProgress(0)
      setError(null)

      const progressInterval = window.setInterval(() => {
        setUploadProgress((prev) => (prev >= 90 ? 90 : prev + 12))
      }, 120)

      try {
        const compressed = await compressImage(file)
        const formData = new FormData()
        formData.append("file", compressed)
        formData.append("timeframe", timeframe)

        const response = await fetch(`/api/coach/sessions/${sessionId}/mtf/upload`, {
          method: "POST",
          body: formData,
          credentials: "same-origin",
        })

        const payload = (await response.json()) as {
          url?: string
          session?: TradeCoachSessionWithMessages
          error?: string
        }

        if (!response.ok || !payload.url || !payload.session) {
          throw new Error(payload.error || "Upload failed")
        }

        setUploadProgress(100)
        return { url: payload.url, session: payload.session }
      } catch (uploadError) {
        const message = uploadError instanceof Error ? uploadError.message : "Upload failed"
        setError(message)
        throw uploadError
      } finally {
        window.clearInterval(progressInterval)
        setUploadingTimeframe(null)
      }
    },
    [sessionId],
  )

  return {
    uploadMtfChart,
    uploadingTimeframe,
    uploadProgress,
    error,
    setError,
  }
}
