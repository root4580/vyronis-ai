import type { RunProviderInput, VyronisAIResponse } from "@/lib/ai/vyronis-ai-types"
import {
  buildMockVyronisAIResponse,
  buildUserMessage,
  buildVyronisAISystemPrompt,
  getScreenshotImageUrl,
  isVyronisAIConfigured,
  parseVyronisAIResponse,
} from "@/lib/ai/providers/vyronis-ai-shared"

function getGeminiModel(): string {
  return process.env.GEMINI_TEXT_MODEL?.trim() || process.env.GEMINI_VISION_MODEL?.trim() || "gemini-2.0-flash"
}

export function isGeminiConfiguredForVyronis(): boolean {
  return isVyronisAIConfigured("GEMINI_API_KEY")
}

async function fetchImageInline(imageUrl: string): Promise<{ mimeType: string; data: string } | null> {
  try {
    const response = await fetch(imageUrl)
    if (!response.ok) return null
    const buffer = await response.arrayBuffer()
    const mimeType = (response.headers.get("content-type") || "image/jpeg").split(";")[0]
    return { mimeType, data: Buffer.from(buffer).toString("base64") }
  } catch {
    return null
  }
}

export async function runGemini(input: RunProviderInput): Promise<VyronisAIResponse> {
  const provider = "gemini"

  if (!isGeminiConfiguredForVyronis()) {
    return buildMockVyronisAIResponse("mock-gemini", input.taskType)
  }

  const apiKey = process.env.GEMINI_API_KEY!.trim()
  const model = getGeminiModel()
  const systemPrompt = buildVyronisAISystemPrompt(input.taskType)
  const userMessage = buildUserMessage(input)
  const imageUrl =
    input.taskType === "screenshot_analysis" ? getScreenshotImageUrl(input.data) : null

  const parts: Array<Record<string, unknown>> = [
    { text: `${systemPrompt}\n\n${userMessage}` },
  ]

  if (imageUrl) {
    const inline = await fetchImageInline(imageUrl)
    if (inline) {
      parts.push({
        inline_data: {
          mime_type: inline.mimeType,
          data: inline.data,
        },
      })
    }
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 900,
        responseMimeType: "application/json",
      },
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(`Gemini API ${response.status}: ${detail.slice(0, 120)}`)
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> }
    }>
  }

  const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || ""
  if (!text) {
    return buildMockVyronisAIResponse("mock-gemini", input.taskType, {
      summary: "Gemini returned an empty response — mock fallback applied.",
    })
  }

  return parseVyronisAIResponse(text, provider, input.taskType)
}
