import type { JournalImportResult } from "@/lib/journal/csv-import"

async function parseJson<T>(response: Response): Promise<T> {
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error || "Journal import failed")
  }
  return payload as T
}

async function uploadScreenshots(files: File[]): Promise<string[]> {
  const urls: string[] = []
  for (const file of files) {
    const form = new FormData()
    form.set("file", file)
    const response = await fetch("/api/upload", {
      method: "POST",
      credentials: "same-origin",
      body: form,
    })
    const payload = await response.json()
    if (!response.ok) {
      throw new Error(payload.error || "Screenshot upload failed")
    }
    urls.push(payload.url as string)
  }
  return urls
}

async function postJournalImport(options: {
  csvFile: File | null
  screenshotFiles: File[]
  dryRun: boolean
  replaceExisting?: boolean
  useTodayForMissingDates?: boolean
}): Promise<JournalImportResult> {
  const screenshotUrls = options.screenshotFiles.length
    ? await uploadScreenshots(options.screenshotFiles)
    : []

  const formData = new FormData()
  formData.set("dryRun", options.dryRun ? "true" : "false")
  formData.set("replaceExisting", options.replaceExisting ? "true" : "false")
  formData.set(
    "useTodayForMissingDates",
    options.useTodayForMissingDates ? "true" : "false",
  )
  if (options.csvFile) formData.set("file", options.csvFile)
  if (screenshotUrls.length) formData.set("screenshotUrls", JSON.stringify(screenshotUrls))

  const response = await fetch("/api/journal/import/csv", {
    method: "POST",
    credentials: "same-origin",
    body: formData,
  })

  return parseJson(response)
}

export async function previewJournalImport(options: {
  csvFile: File | null
  screenshotFiles: File[]
  replaceExisting?: boolean
  useTodayForMissingDates?: boolean
}): Promise<JournalImportResult> {
  return postJournalImport({ ...options, dryRun: true })
}

export async function deleteJournalCsvImports(options?: {
  tradeDate?: string
}): Promise<{ deletedCount: number }> {
  const params = options?.tradeDate
    ? `?date=${encodeURIComponent(options.tradeDate)}`
    : ""
  const response = await fetch(`/api/journal/import/csv${params}`, {
    method: "DELETE",
    credentials: "same-origin",
  })
  return parseJson(response)
}

export async function confirmJournalImport(options: {
  csvFile: File | null
  screenshotFiles: File[]
  replaceExisting?: boolean
  useTodayForMissingDates?: boolean
}): Promise<JournalImportResult> {
  return postJournalImport({ ...options, dryRun: false })
}

export async function fetchMt5ScreenshotAutofill(input: {
  imageUrl: string
  pairHint?: string
  directionHint?: string
}): Promise<import("@/lib/journal/mt5-screenshot-vision-types").Mt5ScreenshotAutofill> {
  const response = await fetch("/api/journal/mt5-screenshot-autofill", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(input),
  })
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error || "MT5 autofill failed")
  }
  return payload.autofill
}
