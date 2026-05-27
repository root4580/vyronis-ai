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
}): Promise<JournalImportResult> {
  const screenshotUrls = options.screenshotFiles.length
    ? await uploadScreenshots(options.screenshotFiles)
    : []

  const formData = new FormData()
  formData.set("dryRun", options.dryRun ? "true" : "false")
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
}): Promise<JournalImportResult> {
  return postJournalImport({ ...options, dryRun: true })
}

export async function confirmJournalImport(options: {
  csvFile: File | null
  screenshotFiles: File[]
}): Promise<JournalImportResult> {
  return postJournalImport({ ...options, dryRun: false })
}
