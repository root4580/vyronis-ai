import type {
  RunProviderInput,
  VyronisAIGrade,
  VyronisAIResponse,
  VyronisAITaskType,
} from "@/lib/ai/vyronis-ai-types"

const VALID_GRADES: VyronisAIGrade[] = ["A+", "A", "B", "Skip"]

export function isVyronisAIConfigured(envKey: string): boolean {
  return Boolean(process.env[envKey]?.trim())
}

export function logProviderError(
  provider: string,
  taskType: VyronisAITaskType,
  error: unknown,
): void {
  const message = error instanceof Error ? error.message : String(error)
  const safe = message
    .replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]")
    .replace(/sb_[a-zA-Z0-9_-]+/g, "[redacted]")
    .slice(0, 240)
  console.error(`[VyronisAI] ${provider} failed for ${taskType}: ${safe}`)
}

export function buildUserMessage(input: RunProviderInput): string {
  const dataBlock =
    input.data !== undefined
      ? `\n\nStructured input:\n${JSON.stringify(input.data, null, 2)}`
      : ""
  return `${input.prompt.trim()}${dataBlock}`
}

export function buildVyronisAISystemPrompt(taskType: VyronisAITaskType): string {
  return [
    "You are Vyronis AI, a disciplined trading intelligence engine.",
    `Task: ${taskType}.`,
    "Respond with JSON only (no markdown fences) using exactly this shape:",
    JSON.stringify({
      score: 72,
      grade: "B",
      summary: "One sentence verdict.",
      reasons: ["reason one", "reason two"],
      warnings: ["warning one"],
      confidence: 65,
    }),
    'grade must be one of: "A+", "A", "B", "Skip".',
    "score and confidence are integers 0-100.",
    "reasons and warnings are short trader-facing strings.",
  ].join("\n")
}

function normalizeGrade(value: unknown): VyronisAIGrade {
  const text = String(value ?? "B").trim()
  if (VALID_GRADES.includes(text as VyronisAIGrade)) return text as VyronisAIGrade
  if (/skip|reject|no/i.test(text)) return "Skip"
  if (/a\+|aplus/i.test(text)) return "A+"
  if (/^a$/i.test(text)) return "A"
  return "B"
}

function clampScore(value: unknown, fallback = 50): number {
  const n = typeof value === "number" ? value : parseInt(String(value), 10)
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.min(100, Math.round(n)))
}

export function parseVyronisAIResponse(
  raw: string,
  provider: string,
  taskType: VyronisAITaskType,
): VyronisAIResponse {
  const trimmed = raw.trim()
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return buildMockVyronisAIResponse(`mock-${provider}`, taskType, {
      summary: trimmed.slice(0, 280) || "Analysis completed with unstructured output.",
    })
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    return {
      provider,
      taskType,
      score: clampScore(parsed.score, 60),
      grade: normalizeGrade(parsed.grade),
      summary: String(parsed.summary || "Vyronis analysis complete.").slice(0, 500),
      reasons: Array.isArray(parsed.reasons)
        ? parsed.reasons.map((r) => String(r)).slice(0, 8)
        : [],
      warnings: Array.isArray(parsed.warnings)
        ? parsed.warnings.map((w) => String(w)).slice(0, 8)
        : [],
      confidence: clampScore(parsed.confidence, clampScore(parsed.score, 60)),
    }
  } catch {
    return buildMockVyronisAIResponse(`mock-${provider}`, taskType, {
      summary: "Could not parse model JSON — using safe fallback.",
    })
  }
}

const MOCK_BY_TASK: Record<
  VyronisAITaskType,
  Pick<VyronisAIResponse, "score" | "grade" | "summary" | "reasons" | "warnings" | "confidence">
> = {
  trading_setup_grading: {
    score: 72,
    grade: "B",
    summary: "Mock analysis: setup is tradable but needs confirmation.",
    reasons: ["HTF alignment is acceptable", "AOI is nearby"],
    warnings: ["Momentum is not fully confirmed", "Use this as mock data only"],
    confidence: 65,
  },
  strategy_document_review: {
    score: 68,
    grade: "B",
    summary: "Mock review: strategy rules are mostly clear with a few gaps.",
    reasons: ["Risk rules are defined", "Entry criteria are documented"],
    warnings: ["Session filters are vague", "Mock data only"],
    confidence: 62,
  },
  screenshot_analysis: {
    score: 70,
    grade: "B",
    summary: "Mock vision: structure looks tradable pending confirmation.",
    reasons: ["Trend context appears supportive", "Key level is visible"],
    warnings: ["Vision API key not configured", "Mock data only"],
    confidence: 60,
  },
  final_summary: {
    score: 75,
    grade: "B",
    summary: "Mock summary: process was acceptable; tighten execution discipline.",
    reasons: ["Plan vs execution mostly aligned"],
    warnings: ["Emotional notes incomplete", "Mock data only"],
    confidence: 67,
  },
}

export function buildMockVyronisAIResponse(
  provider: string,
  taskType: VyronisAITaskType,
  overrides?: Partial<VyronisAIResponse>,
): VyronisAIResponse {
  const base = MOCK_BY_TASK[taskType]
  return {
    provider,
    taskType,
    score: base.score,
    grade: base.grade,
    summary: base.summary,
    reasons: [...base.reasons],
    warnings: [...base.warnings],
    confidence: base.confidence,
    ...overrides,
  }
}

export function getScreenshotImageUrl(data: unknown): string | null {
  if (!data || typeof data !== "object") return null
  const record = data as Record<string, unknown>
  const url = record.imageUrl ?? record.image_url ?? record.screenshotUrl
  return typeof url === "string" && url.trim() ? url.trim() : null
}
