import type { RunProviderInput, VyronisAIResponse } from "@/lib/ai/vyronis-ai-types"
import {
  buildMockVyronisAIResponse,
  buildUserMessage,
  buildVyronisAISystemPrompt,
  getScreenshotImageUrl,
  isVyronisAIConfigured,
  parseVyronisAIResponse,
} from "@/lib/ai/providers/vyronis-ai-shared"

function getClaudeModel(): string {
  return process.env.CLAUDE_TEXT_MODEL?.trim() || process.env.CLAUDE_VISION_MODEL?.trim() || "claude-sonnet-4-20250514"
}

export function isClaudeConfiguredForVyronis(): boolean {
  return isVyronisAIConfigured("ANTHROPIC_API_KEY")
}

async function fetchImageBase64(imageUrl: string): Promise<{ mediaType: string; data: string } | null> {
  try {
    const response = await fetch(imageUrl)
    if (!response.ok) return null
    const buffer = await response.arrayBuffer()
    const contentType = response.headers.get("content-type") || "image/jpeg"
    const data = Buffer.from(buffer).toString("base64")
    return { mediaType: contentType.split(";")[0], data }
  } catch {
    return null
  }
}

export async function runClaude(input: RunProviderInput): Promise<VyronisAIResponse> {
  const provider = "claude"

  if (!isClaudeConfiguredForVyronis()) {
    return buildMockVyronisAIResponse("mock-claude", input.taskType)
  }

  const apiKey = process.env.ANTHROPIC_API_KEY!.trim()
  const systemPrompt = buildVyronisAISystemPrompt(input.taskType)
  const userMessage = buildUserMessage(input)
  const imageUrl =
    input.taskType === "screenshot_analysis" ? getScreenshotImageUrl(input.data) : null

  const userContent: Array<Record<string, unknown>> = [{ type: "text", text: userMessage }]
  if (imageUrl) {
    const image = await fetchImageBase64(imageUrl)
    if (image) {
      userContent.push({
        type: "image",
        source: {
          type: "base64",
          media_type: image.mediaType,
          data: image.data,
        },
      })
    }
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: getClaudeModel(),
      max_tokens: 900,
      temperature: 0.25,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(`Claude API ${response.status}: ${detail.slice(0, 120)}`)
  }

  const payload = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>
  }
  const text = payload.content?.find((block) => block.type === "text")?.text
  if (!text) {
    return buildMockVyronisAIResponse("mock-claude", input.taskType, {
      summary: "Claude returned an empty response — mock fallback applied.",
    })
  }

  return parseVyronisAIResponse(text, provider, input.taskType)
}
