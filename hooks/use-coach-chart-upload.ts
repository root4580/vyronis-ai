"use client"

import { useCallback, useState } from "react"

const ALLOWED_FILE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_DIMENSION = 1920
const JPEG_QUALITY = 0.85

async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 400_000) {
    return file
  }

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

  if (!blob || blob.size >= file.size) {
    return file
  }

  const extension = outputType.split("/")[1] || "webp"
  const baseName = file.name.replace(/\.[^.]+$/, "")
  return new File([blob], `${baseName}.${extension}`, { type: outputType })
}

export function useCoachChartUpload() {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const validateFile = useCallback((file: File): string | null => {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return "Invalid file type. Allowed: jpg, jpeg, png, webp"
    }
    if (file.size > MAX_FILE_SIZE) {
      return "File too large. Maximum size is 10MB"
    }
    return null
  }, [])

  const uploadChart = useCallback(async (file: File): Promise<string> => {
    const validationError = validateFile(file)
    if (validationError) {
      throw new Error(validationError)
    }

    setIsUploading(true)
    setUploadProgress(0)
    setError(null)

    const progressInterval = window.setInterval(() => {
      setUploadProgress((prev) => (prev >= 90 ? 90 : prev + 10))
    }, 120)

    try {
      const compressed = await compressImage(file)
      const formData = new FormData()
      formData.append("file", compressed)

      const response = await fetch("/api/upload", {
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
      setIsUploading(false)
    }
  }, [validateFile])

  const uploadCharts = useCallback(
    async (files: File[]): Promise<string[]> => {
      if (files.length === 0) return []
      if (files.length === 1) return [await uploadChart(files[0])]

      setIsUploading(true)
      setUploadProgress(0)
      setError(null)
      const progressInterval = window.setInterval(() => {
        setUploadProgress((prev) => (prev >= 90 ? 90 : prev + 8))
      }, 120)

      try {
        const urls: string[] = []
        for (let index = 0; index < files.length; index += 1) {
          const validationError = validateFile(files[index])
          if (validationError) throw new Error(validationError)

          const compressed = await compressImage(files[index])
          const formData = new FormData()
          formData.append("file", compressed)

          const response = await fetch("/api/upload", {
            method: "POST",
            body: formData,
            credentials: "same-origin",
          })

          if (!response.ok) {
            const payload = await response.json()
            throw new Error(payload.error || "Upload failed")
          }

          const { url } = (await response.json()) as { url: string }
          urls.push(url)
          setUploadProgress(Math.round(((index + 1) / files.length) * 100))
        }
        return urls
      } catch (uploadError) {
        const message = uploadError instanceof Error ? uploadError.message : "Upload failed"
        setError(message)
        throw uploadError
      } finally {
        window.clearInterval(progressInterval)
        setIsUploading(false)
      }
    },
    [uploadChart, validateFile],
  )

  return {
    uploadChart,
    uploadCharts,
    isUploading,
    uploadProgress,
    error,
    setError,
  }
}
