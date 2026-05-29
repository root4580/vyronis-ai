import OpenAI from "openai"
import type { RunProviderInput, VyronisAIResponse } from "@/lib/ai/vyronis-ai-types"
import {
  buildMockVyronisAIResponse,
  buildUserMessage,
  buildVyronisAISystemPrompt,
  getScreenshotImageUrl,
  isVyronisAIConfigured,
  parseVyronisAIResponse,
} from "@/lib/ai/providers/vyronis-ai-shared"

let client: OpenAI | null = null

function getClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return null
  if (!client) client = new OpenAI({ apiKey })
  return client
}

function getTextModel(): string {
  return process.env.OPENAI_TEXT_MODEL?.trim() || process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o"
}

export function isOpenAIConfiguredForVyronis(): boolean {
  return isVyronisAIConfigured("OPENAI_API_KEY")
}

export async function runOpenAI(input: RunProviderInput): Promise<VyronisAIResponse> {
  const provider = "openai"

  if (!isOpenAIConfiguredForVyronis()) {
    return buildMockVyronisAIResponse("mock-openai", input.taskType)
  }

  const openai = getClient()
  if (!openai) {
    return buildMockVyronisAIResponse("mock-openai", input.taskType)
  }

  const systemPrompt = buildVyronisAISystemPrompt(input.taskType)
  const userMessage = buildUserMessage(input)
  const imageUrl =
    input.taskType === "screenshot_analysis" ? getScreenshotImageUrl(input.data) : null

  const completion = await openai.chat.completions.create({
    model: getTextModel(),
    temperature: 0.25,
    max_tokens: 900,
    response_format: { type: "json_object" },
    messages: imageUrl
      ? [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userMessage },
              { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
            ],
          },
        ]
      : [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
  })

  const content = completion.choices[0]?.message?.content
  if (!content) {
    return buildMockVyronisAIResponse("mock-openai", input.taskType, {
      summary: "OpenAI returned an empty response — mock fallback applied.",
    })
  }

  return parseVyronisAIResponse(content, provider, input.taskType)
}
