import type {
  CsvImportResult,
  ResearchStrategyInput,
  ResearchStrategyRecord,
} from "@/lib/research/types"
import type { ResearchComparisonSummary } from "@/lib/research/strategy-comparison"

async function parseJson<T>(response: Response): Promise<T> {
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error || "Research Lab request failed")
  }
  return payload as T
}

export async function fetchResearchStrategies(): Promise<ResearchStrategyRecord[]> {
  const response = await fetch("/api/research/strategies", { credentials: "same-origin" })
  return parseJson(response)
}

export async function createResearchStrategy(
  input: ResearchStrategyInput,
): Promise<ResearchStrategyRecord> {
  const response = await fetch("/api/research/strategies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(input),
  })
  return parseJson(response)
}

export async function importResearchCsv(options: {
  file: File
  researchStrategyId: string
  dryRun?: boolean
}): Promise<CsvImportResult> {
  const formData = new FormData()
  formData.set("file", options.file)
  formData.set("researchStrategyId", options.researchStrategyId)
  formData.set("dryRun", options.dryRun ? "true" : "false")

  const response = await fetch("/api/research/import/csv", {
    method: "POST",
    credentials: "same-origin",
    body: formData,
  })

  return parseJson(response)
}

export async function fetchResearchComparison(): Promise<ResearchComparisonSummary> {
  const response = await fetch("/api/research/comparison", { credentials: "same-origin" })
  return parseJson(response)
}

export async function fetchResearchLabEnabled(): Promise<boolean> {
  const response = await fetch("/api/research/enabled", { credentials: "same-origin" })
  if (response.status === 404) return false
  const payload = await parseJson<{ enabled: boolean }>(response)
  return payload.enabled
}
