import { getOpenAiClient, getOpenAiVisionModel, isOpenAiConfigured } from "@/lib/ai/providers/openai-provider"
import { fetchImageDataUrl } from "@/lib/ai/providers/vision-shared"
import type { Mt5ScreenshotAutofill, Mt5ScreenshotSource } from "@/lib/journal/mt5-screenshot-vision-types"
import { inferSessionFromMt5Timestamps } from "@/lib/trading/mt5-session-from-time"

function parsePrice(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null
  const parsed = Number(String(raw).replace(/,/g, ""))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/** Profit / swap / commission — may be negative on MT5 history. */
function parseSignedMoney(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null
  const cleaned = String(raw).replace(/,/g, "").replace(/\s/g, "")
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizePair(raw: unknown, hint?: string): string {
  const text = String(raw || hint || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
  if (text.length >= 6) return text.slice(0, 6)
  if (text.length >= 3) return text
  return hint?.toUpperCase().replace(/[^A-Z0-9]/g, "") || ""
}

function normalizeDirection(raw: unknown): "BUY" | "SELL" | "" {
  const text = String(raw || "").toLowerCase()
  if (text.includes("sell") || text.includes("short")) return "SELL"
  if (text.includes("buy") || text.includes("long")) return "BUY"
  return ""
}

function normalizeResult(raw: unknown, profit: number | null): "WIN" | "LOSS" | "BREAKEVEN" | "" {
  const text = String(raw || "").toUpperCase()
  if (text === "WIN" || text === "LOSS" || text === "BREAKEVEN") return text
  if (profit == null) return ""
  if (Math.abs(profit) < 0.01) return "BREAKEVEN"
  return profit > 0 ? "WIN" : "LOSS"
}

function normalizeSource(raw: unknown): Mt5ScreenshotSource {
  const text = String(raw || "").toLowerCase()
  if (text.includes("position")) return "mt5_positions"
  if (text.includes("history") || text.includes("deal")) return "mt5_history"
  if (text.includes("order")) return "mt5_order"
  if (text.includes("chart")) return "mt5_chart"
  return "unknown"
}

function buildMt5VisionPrompt(hints?: { pair?: string; direction?: string }): string {
  return [
    "You extract trade execution fields from MetaTrader 5 (MT5) screenshots — desktop terminal or mobile app.",
    "Mobile MT5 often shows a deal/position sheet: symbol (e.g. GBPCAD), buy/sell + lots, Opening price, Closing price, S/L, T/P, Profit, ticket #, timestamps.",
    "Desktop may show: Terminal → Trade/History/Positions, order dialog, or chart with SL/TP lines.",
    "",
    "Read visible UI text and price labels carefully:",
    "- Symbol (EURUSD, GBPUSD, XAUUSD, etc.) — strip slashes",
    "- Type / Action: buy/sell → direction",
    "- Price / Open / Entry / @ price",
    "- S/L or Stop Loss",
    "- T/P or Take Profit",
    "- Profit, Swap, Commission (for closed or open P&L)",
    "- Volume in lots if shown",
    "- Closing price (mobile) or Close price (desktop history)",
    "- open_time: verbatim opening timestamp from MT5 (e.g. 2026.05.29 18:49:49)",
    "- close_time: verbatim close timestamp if shown (e.g. 2026.05.29 18:56:51)",
    "- trade_date: YYYY-MM-DD from opening date",
    "- Profit is signed (negative = loss). Map result: profit>0 WIN, profit<0 LOSS, ~0 BREAKEVEN",
    "- Do NOT guess session — leave session null; server converts MT5 time to EST.",
    "",
    hints?.pair ? `Trader hint pair: ${hints.pair}` : "",
    hints?.direction ? `Trader hint direction: ${hints.direction}` : "",
    "If a field is not clearly visible, return null — do not invent prices.",
    "Distinguish open position vs closed history row when possible.",
    "",
    "Return ONLY valid JSON:",
    `{`,
    `  "source": "mt5_positions|mt5_history|mt5_order|mt5_chart|unknown",`,
    `  "pair": "EURUSD",`,
    `  "direction": "BUY|SELL",`,
    `  "entry_price": number|null,`,
    `  "stop_loss": number|null,`,
    `  "take_profit": number|null,`,
    `  "close_price": number|null,`,
    `  "volume_lots": number|null,`,
    `  "profit": number|null,`,
    `  "result": "WIN|LOSS|BREAKEVEN|null",`,
    `  "trade_date": "YYYY-MM-DD|null",`,
    `  "open_time": "2026.05.29 18:49:49|null",`,
    `  "close_time": "2026.05.29 18:56:51|null",`,
    `  "session": null,`,
    `  "summary": "one sentence — what you read from MT5",`,
    `  "confidence": 0-100`,
    `}`,
  ]
    .filter(Boolean)
    .join("\n")
}

type AiPayload = {
  source?: string
  pair?: string
  direction?: string
  entry_price?: unknown
  stop_loss?: unknown
  take_profit?: unknown
  close_price?: unknown
  volume_lots?: unknown
  profit?: unknown
  result?: string | null
  trade_date?: string | null
  open_time?: string | null
  close_time?: string | null
  session?: string | null
  summary?: string
  confidence?: unknown
}

function applyEstSession(autofill: Mt5ScreenshotAutofill): Mt5ScreenshotAutofill {
  const timing = inferSessionFromMt5Timestamps({
    openTimeRaw: autofill.open_time_raw,
    closeTimeRaw: autofill.close_time_raw,
    tradeDate: autofill.trade_date,
  })

  const summaryParts = [autofill.summary]
  if (timing.sessionEstLabel) summaryParts.push(`Session ${timing.sessionEstLabel}`)

  return {
    ...autofill,
    trade_date: timing.tradeDate ?? autofill.trade_date,
    session: timing.session ?? autofill.session,
    session_est_label: timing.sessionEstLabel,
    summary: summaryParts.filter(Boolean).join(" · ").slice(0, 400),
  }
}

function resolveDirection(
  raw: unknown,
  directionHint?: string,
): "BUY" | "SELL" | "" {
  const fromVision = normalizeDirection(raw)
  if (fromVision) return fromVision
  const hint = String(directionHint || "").toUpperCase()
  if (hint === "BUY" || hint === "SELL") return hint
  return ""
}

export function mt5AutofillHasExtractedFields(autofill: Mt5ScreenshotAutofill): boolean {
  return Boolean(
    autofill.pair ||
      autofill.direction ||
      autofill.entry_price != null ||
      autofill.stop_loss != null ||
      autofill.take_profit != null ||
      autofill.close_price != null ||
      autofill.profit != null ||
      autofill.result ||
      autofill.trade_date ||
      autofill.volume_lots != null,
  )
}

function parsePayload(
  raw: string,
  hints?: { pair?: string; direction?: string },
): Mt5ScreenshotAutofill {
  let parsed: AiPayload = {}
  try {
    parsed = JSON.parse(raw) as AiPayload
  } catch {
    parsed = {}
  }

  const profit = parseSignedMoney(parsed.profit)
  const pair = normalizePair(parsed.pair, hints?.pair)
  const direction = resolveDirection(parsed.direction, hints?.direction)

  const base: Mt5ScreenshotAutofill = {
    available: Boolean(
      pair &&
        (direction ||
          profit != null ||
          parsed.entry_price != null ||
          parsed.stop_loss != null ||
          parsed.take_profit != null ||
          parsed.close_price != null),
    ),
    source: normalizeSource(parsed.source),
    pair,
    direction,
    entry_price: parsePrice(parsed.entry_price),
    stop_loss: parsePrice(parsed.stop_loss),
    take_profit: parsePrice(parsed.take_profit),
    close_price: parsePrice(parsed.close_price),
    volume_lots: parsePrice(parsed.volume_lots),
    profit,
    result: normalizeResult(parsed.result, profit),
    trade_date:
      typeof parsed.trade_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.trade_date)
        ? parsed.trade_date
        : null,
    session: null,
    open_time_raw: typeof parsed.open_time === "string" ? parsed.open_time.trim() : null,
    close_time_raw: typeof parsed.close_time === "string" ? parsed.close_time.trim() : null,
    session_est_label: null,
    summary: String(parsed.summary || "MT5 screenshot analyzed.").slice(0, 400),
    confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 50)),
  }

  return applyEstSession(base)
}

async function analyzeWithOpenAi(
  imageUrl: string,
  hints?: { pair?: string; direction?: string },
): Promise<Mt5ScreenshotAutofill> {
  const openai = getOpenAiClient()
  if (!openai) throw new Error("OPENAI_API_KEY is not configured")

  const dataUrl = await fetchImageDataUrl(imageUrl).catch(() => imageUrl)

  const completion = await openai.chat.completions.create({
    model: getOpenAiVisionModel(),
    temperature: 0.15,
    max_tokens: 900,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: buildMt5VisionPrompt(hints) },
          { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
        ],
      },
    ],
  })

  const content = completion.choices[0]?.message?.content
  if (!content) throw new Error("Vision returned an empty response")
  return parsePayload(content, hints)
}

export async function analyzeMt5TradeScreenshot(input: {
  imageUrl: string
  pairHint?: string
  directionHint?: string
}): Promise<Mt5ScreenshotAutofill> {
  const imageUrl = input.imageUrl?.trim()
  if (!imageUrl) throw new Error("imageUrl is required")

  const hints = {
    pair: input.pairHint?.trim(),
    direction: input.directionHint?.trim(),
  }

  if (isOpenAiConfigured()) {
    try {
      return await analyzeWithOpenAi(imageUrl, hints)
    } catch (error) {
      console.error("MT5 screenshot OpenAI vision error:", error)
    }
  }

  return {
    available: false,
    source: "unknown",
    pair: normalizePair(null, hints.pair),
    direction: resolveDirection(null, hints.direction),
    entry_price: null,
    stop_loss: null,
    take_profit: null,
    close_price: null,
    volume_lots: null,
    profit: null,
    result: "",
    trade_date: null,
    session: null,
    open_time_raw: null,
    close_time_raw: null,
    session_est_label: null,
    summary:
      "Add OPENAI_API_KEY in .env.local to autofill from MT5 screenshots (pair, direction, entry, SL, TP, P&L).",
    confidence: 0,
  }
}
