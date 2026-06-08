import { getOpenAiClient, getOpenAiVisionModel, isOpenAiConfigured } from "@/lib/ai/providers/openai-provider"
import { fetchImageDataUrl } from "@/lib/ai/providers/vision-shared"
import { computeAchievedRR } from "@/lib/paper-trades/stats"
import type { PaperTradeResult } from "@/lib/paper-trades/types"

export type PaperCloseAiField = "closePrice" | "result" | "pnl" | "rr"

export type PaperChartCloseAutofillResult = {
  chartImageUrl: string
  confidence: number
  confidenceLabel: string
  aiFilledFields: PaperCloseAiField[]
  applied: {
    closePrice: number | null
    result: Exclude<PaperTradeResult, "PENDING"> | null
    rr: number | null
    pnl: number | null
  } | null
  summary: string
}

function parsePrice(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null
  const parsed = Number(String(raw).replace(/,/g, ""))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function normalizeCloseResult(raw: unknown): Exclude<PaperTradeResult, "PENDING"> | null {
  const text = String(raw || "").toUpperCase()
  if (text.includes("WIN")) return "WIN"
  if (text.includes("LOSS")) return "LOSS"
  if (text.includes("BREAK") || text === "BE") return "BREAKEVEN"
  return null
}

function inferResultFromPrices(input: {
  direction: string
  entry: number
  sl: number | null
  closePrice: number
}): Exclude<PaperTradeResult, "PENDING"> {
  const dir = input.direction.toUpperCase()
  const entry = input.entry
  const close = input.closePrice
  const relMove = Math.abs(close - entry) / Math.max(entry, 1e-9)

  if (relMove < 0.00008) return "BREAKEVEN"

  if (dir === "BUY" || dir === "LONG") {
    if (input.sl != null && close <= input.sl) return "LOSS"
    return close > entry ? "WIN" : "LOSS"
  }

  if (input.sl != null && close >= input.sl) return "LOSS"
  return close < entry ? "WIN" : "LOSS"
}

function defaultPnlR(
  result: Exclude<PaperTradeResult, "PENDING">,
  rr: number | null,
): number {
  if (result === "BREAKEVEN") return 0
  if (result === "LOSS") return rr != null && rr < 0 ? rr : -1
  if (rr != null && rr > 0) return rr
  return 1
}

function buildCloseVisionPrompt(input: {
  symbol: string
  direction: string
  entry: number | null
  sl: number | null
  tp: number | null
}): string {
  return [
    "You are Vyronis Practice Room — read a POST-TRADE / EXIT screenshot and extract how the trade closed.",
    "",
    "Look for: close price, exit price, position close line, deal close, last price at exit, MT5 closed position row, TradingView position closed overlay.",
    "Prefer the actual exit/close price over live current price if both appear.",
    "",
    `Open trade context: ${input.symbol} ${input.direction}`,
    input.entry != null ? `Entry at open: ${input.entry}` : "",
    input.sl != null ? `Stop loss at open: ${input.sl}` : "",
    input.tp != null ? `Take profit at open: ${input.tp}` : "",
    "",
    "Infer outcome vs entry: WIN if price moved in trade direction, LOSS if stopped or against, BREAKEVEN if flat.",
    "If exit price is not clearly visible, return null for close_price — never invent.",
    "",
    "Return ONLY valid JSON:",
    `{`,
    `  "close_price": number|null,`,
    `  "result": "WIN|LOSS|BREAKEVEN|null",`,
    `  "summary": "one sentence on what the chart shows",`,
    `  "confidence": 0-100`,
    `}`,
  ]
    .filter(Boolean)
    .join("\n")
}

type AiPayload = {
  close_price?: unknown
  result?: unknown
  summary?: string
  confidence?: unknown
}

export async function buildPaperChartCloseAutofill(input: {
  imageUrl: string
  symbol: string
  direction: string
  entry: number | null
  sl: number | null
  tp: number | null
}): Promise<PaperChartCloseAutofillResult> {
  const chartImageUrl = input.imageUrl.trim()
  const aiFilledFields: PaperCloseAiField[] = []
  const empty: PaperChartCloseAutofillResult = {
    chartImageUrl,
    confidence: 0,
    confidenceLabel: "❓ Manual entry recommended",
    aiFilledFields,
    applied: null,
    summary: "Could not read exit price from chart.",
  }

  if (!isOpenAiConfigured()) return empty

  const openai = getOpenAiClient()
  if (!openai) return empty

  const dataUrl = await fetchImageDataUrl(chartImageUrl).catch(() => chartImageUrl)

  const completion = await openai.chat.completions.create({
    model: getOpenAiVisionModel(),
    temperature: 0.15,
    max_tokens: 600,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: buildCloseVisionPrompt({
              symbol: input.symbol,
              direction: input.direction,
              entry: input.entry,
              sl: input.sl,
              tp: input.tp,
            }),
          },
          { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
        ],
      },
    ],
  })

  const content = completion.choices[0]?.message?.content
  if (!content) return empty

  let parsed: AiPayload = {}
  try {
    parsed = JSON.parse(content) as AiPayload
  } catch {
    return empty
  }

  const confidence = Math.max(0, Math.min(100, Number(parsed.confidence) || 50))
  const confidenceLabel =
    confidence >= 75
      ? "✅ High confidence"
      : confidence >= 40
        ? "⚠️ Please verify close price"
        : "❓ Manual entry recommended"

  const closePrice = parsePrice(parsed.close_price)
  if (closePrice == null) {
    return {
      chartImageUrl,
      confidence,
      confidenceLabel,
      aiFilledFields,
      applied: null,
      summary: String(parsed.summary || empty.summary).slice(0, 400),
    }
  }

  aiFilledFields.push("closePrice")

  let result = normalizeCloseResult(parsed.result)
  if (!result && input.entry != null) {
    result = inferResultFromPrices({
      direction: input.direction,
      entry: input.entry,
      sl: input.sl,
      closePrice,
    })
  }
  if (result) aiFilledFields.push("result")

  let rr: number | null = null
  if (input.entry != null && input.sl != null) {
    rr = computeAchievedRR({
      direction: input.direction,
      entry: input.entry,
      sl: input.sl,
      closePrice,
    })
    if (rr != null) aiFilledFields.push("rr")
  }

  const pnl = result ? defaultPnlR(result, rr) : null
  if (pnl != null) aiFilledFields.push("pnl")

  return {
    chartImageUrl,
    confidence,
    confidenceLabel,
    aiFilledFields,
    applied: {
      closePrice,
      result,
      rr,
      pnl,
    },
    summary: String(parsed.summary || "Exit chart analyzed.").slice(0, 400),
  }
}
