import OpenAI from "openai"
import type { ChartVisionInput } from "@/lib/coach/types"
import type {
  AiCoachTextInput,
  AiDebriefTextInput,
  AiProvider,
  AiTextCompletionInput,
  AiVisionTimeframeInput,
} from "@/lib/ai/providers/provider-interface"
import {
  buildTimeframeVisionPrompt,
  buildTimeframeVisualAnalysis,
  fetchImageDataUrl,
  parseTimeframeVisionPayload,
  timeframeAnalysisToChartVision,
} from "@/lib/ai/providers/vision-shared"

let client: OpenAI | null = null

export function getOpenAiClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return null
  if (!client) client = new OpenAI({ apiKey })
  return client
}

export function getOpenAiVisionModel(): string {
  return process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o"
}

export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim())
}

/** @deprecated use isOpenAiConfigured */
export const isOpenAiVisionConfigured = isOpenAiConfigured

async function completeOpenAiText(input: AiTextCompletionInput): Promise<string> {
  const openai = getOpenAiClient()
  if (!openai) throw new Error("OPENAI_API_KEY is not configured")

  const completion = await openai.chat.completions.create({
    model: getOpenAiVisionModel(),
    temperature: input.temperature ?? 0.3,
    max_tokens: input.maxTokens ?? 800,
    response_format: input.jsonMode ? { type: "json_object" } : undefined,
    messages: [
      ...(input.systemPrompt
        ? [{ role: "system" as const, content: input.systemPrompt }]
        : []),
      { role: "user" as const, content: input.userPrompt },
    ],
  })

  const content = completion.choices[0]?.message?.content
  if (!content) throw new Error("OpenAI returned an empty response")
  return content
}

export const openaiProvider: AiProvider = {
  id: "openai",
  label: "OpenAI",
  capabilities: { vision: true, text: true },
  isConfigured: isOpenAiConfigured,
  getVisionModel: getOpenAiVisionModel,
  async analyzeTimeframeVision(input: AiVisionTimeframeInput) {
    const openai = getOpenAiClient()
    if (!openai) throw new Error("OPENAI_API_KEY is not configured")

    const model = getOpenAiVisionModel()
    const imageUrl = await fetchImageDataUrl(input.screenshotUrl).catch(() => input.screenshotUrl)

    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.2,
      max_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: buildTimeframeVisionPrompt(
                input.timeframe,
                input.plannedContext,
                input.playbook,
              ),
            },
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
          ],
        },
      ],
    })

    const content = completion.choices[0]?.message?.content
    if (!content) throw new Error("OpenAI Vision returned an empty response")

    const payload = parseTimeframeVisionPayload(content)
    return buildTimeframeVisualAnalysis({
      payload,
      screenshotUrl: input.screenshotUrl,
      timeframe: input.timeframe,
      provider: "openai",
      plannedContext: input.plannedContext,
    })
  },
  async analyzeChartVision(input: ChartVisionInput) {
    const timeframe = input.timeframe || "h1"
    const tfResult = await openaiProvider.analyzeTimeframeVision({
      screenshotUrl: input.screenshotUrl,
      plannedContext: input.plannedContext,
      timeframe,
    })
    return timeframeAnalysisToChartVision(tfResult, "openai")
  },
  completeText: completeOpenAiText,
  async generateCoachInsight(input: AiCoachTextInput) {
    return completeOpenAiText({
      systemPrompt:
        "You are Vyronis AI, a disciplined trading coach. Be concise, actionable, and risk-aware.",
      userPrompt: input.prompt,
      jsonMode: input.jsonMode,
      maxTokens: 600,
    })
  },
  async generateDebriefNarrative(input: AiDebriefTextInput) {
    return completeOpenAiText({
      systemPrompt:
        "You are Vyronis AI writing a weekly trading debrief. Focus on discipline, patterns, and next-week advice.",
      userPrompt:
        input.prompt ||
        [
          `Weekly summary: ${input.summary}`,
          `Trades: ${input.tradeCount}, Win rate: ${input.winRate}%`,
          `Recurring mistakes: ${input.recurringMistakes.join(", ") || "none"}`,
          "Write a concise coaching narrative (3-5 sentences).",
        ].join("\n"),
      maxTokens: 500,
    })
  },
}
