"use client"

import { useCallback, useState } from "react"
import type { CoachMtfTimeframe } from "@/lib/coach/mtf-constants"

const ALLOWED_FILE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_DIMENSION = 1920
const JPEG_QUALITY = 0.85

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

  const outputType = file.type === "image/png" ? "image/webp" : file.type
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
    async (timeframe: CoachMtfTimeframe, file: File): Promise<string> => {
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        throw new Error("Invalid file type. Allowed: jpg, jpeg, png, webp")
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

        if (!response.ok) {
          const payload = await response.json()
          throw new Error(payload.error || "Upload failed")
        }

        const { url } = (await response.json()) as { url: string }
        setUploadProgress(100)
        return url
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
