import { getOpenAiClient, getOpenAiVisionModel, isOpenAiConfigured } from "@/lib/ai/providers/openai-provider"
import { fetchImageDataUrl } from "@/lib/ai/providers/vision-shared"
import type {
  PlanChartVisionResult,
  PlanChartVisionSource,
  PlanSlAssessment,
  PlanStructureTag,
  PlanTpAssessment,
} from "@/lib/trade-planner/plan-chart-vision-types"
import type { TradePlanDirection } from "@/lib/trade-planner/types"

function parsePrice(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null
  const parsed = Number(String(raw).replace(/,/g, ""))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function normalizePair(raw: unknown, hint?: string): string {
  const text = String(raw || hint || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
  if (text.length >= 6) return text.slice(0, 6)
  return hint?.toUpperCase().replace(/[^A-Z0-9]/g, "") || text
}

function normalizeDirection(raw: unknown): TradePlanDirection | "" {
  const text = String(raw || "").toLowerCase()
  if (text.includes("sell") || text.includes("short")) return "SELL"
  if (text.includes("buy") || text.includes("long")) return "BUY"
  return ""
}

function normalizeSource(raw: unknown): PlanChartVisionSource {
  const text = String(raw || "").toLowerCase()
  if (text.includes("tradingview")) return "tradingview"
  if (text.includes("order")) return "mt5_order"
  if (text.includes("chart")) return "mt5_chart"
  if (text.includes("mobile")) return "mobile_broker"
  return "unknown"
}

function normalizeSlAssessment(raw: unknown): PlanSlAssessment {
  const text = String(raw || "").toLowerCase()
  if (text.includes("tight")) return "tight"
  if (text.includes("wide")) return "wide"
  if (text.includes("reason")) return "reasonable"
  return "unknown"
}

function normalizeTpAssessment(raw: unknown): PlanTpAssessment {
  const text = String(raw || "").toLowerCase()
  if (text.includes("early") || text.includes("short")) return "early"
  if (text.includes("extend") || text.includes("aggressive")) return "extended"
  if (text.includes("reason")) return "reasonable"
  return "unknown"
}

const STRUCTURE_TAGS: PlanStructureTag[] = [
  "liquidity_sweep",
  "fvg",
  "order_block",
  "ema",
  "swing_high",
  "swing_low",
  "breakout",
  "consolidation",
]

function normalizeStructureTags(raw: unknown): PlanStructureTag[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => String(item).toLowerCase().replace(/\s+/g, "_"))
    .filter((item): item is PlanStructureTag => STRUCTURE_TAGS.includes(item as PlanStructureTag))
}

function buildPlanChartVisionPrompt(input: {
  pairHint?: string
  directionHint?: TradePlanDirection
}): string {
  return [
    "You are Vyronis Trade Planner chart coach — read a PRE-TRADE screenshot and return plan levels + structure coaching.",
    "",
    "=== TRADINGVIEW (very common) ===",
    "Long/Short Position tool: horizontal entry line; GREEN zone = target side; RED zone = stop side.",
    "Read overlay labels exactly: Target, Stop, Risk/Reward, pip counts, percentages.",
    "Entry = boundary between green and red boxes (not the live price unless that IS the entry).",
    "Pair + timeframe from top-left header (e.g. NZDJPY · 4h).",
    "",
    "=== MT5 / MOBILE ===",
    "Order dialog, position row, or chart with SL/TP lines — read S/L, T/P, Open/Entry prices.",
    "",
    "=== STRUCTURE TO COMMENT ON (visible only — do not invent) ===",
    "- Liquidity sweep: wick through prior high/low then rejection",
    "- FVG / imbalance: gap between candles on impulse leg",
    "- EMA (e.g. 50 EMA): is SL beyond or inside EMA support/resistance?",
    "- Swing high/low, consolidation box, breakout",
    "",
    "=== COACHING RULES ===",
    "sl_verdict: tight | reasonable | wide",
    "  tight = SL inside noise / too close to entry for this TF",
    "  wide = SL far beyond obvious invalidation — suggest tightening (lowering for longs, raising for shorts)",
    "tp_verdict: early | reasonable | extended",
    "  early = TP before obvious liquidity (prior high/low, equal highs)",
    "  extended = TP beyond visible liquidity — mention partials",
    "Use plain trader language. Reference visible levels when possible.",
    "",
    "pointers MUST be 4–6 bullets, each prefixed exactly:",
    "  SL — ... (stop too tight / too wide / placement vs EMA or structure)",
    "  TP — ... (place at liquidity sweep, FVG fill, prior high/low, extend target)",
    "  Structure — ... (FVG, sweep, breakout, consolidation)",
    "  R:R — ... (only if R:R visible or computable)",
    "",
    input.pairHint ? `Trader pair hint: ${input.pairHint}` : "",
    input.directionHint ? `Trader direction hint: ${input.directionHint}` : "",
    "If a price is not clearly visible, return null — never invent levels.",
    "suggested_stop_loss / suggested_take_profit: only if you see a better obvious level on chart; else null.",
    "",
    "Return ONLY valid JSON:",
    `{`,
    `  "source": "tradingview|mt5_chart|mt5_order|mobile_broker|unknown",`,
    `  "pair": "NZDJPY",`,
    `  "direction": "BUY|SELL",`,
    `  "timeframe": "4H|null",`,
    `  "entry_price": number|null,`,
    `  "stop_loss": number|null,`,
    `  "take_profit": number|null,`,
    `  "sl_verdict": "tight|reasonable|wide",`,
    `  "sl_coaching": "one sentence on stop placement",`,
    `  "tp_verdict": "early|reasonable|extended",`,
    `  "tp_coaching": "one sentence — e.g. move TP to liquidity above prior high or FVG top",`,
    `  "structure_tags": ["liquidity_sweep","fvg","ema","breakout"],`,
    `  "structure_observations": ["short note", "short note"],`,
    `  "suggested_stop_loss": number|null,`,
    `  "suggested_take_profit": number|null,`,
    `  "pointers": ["SL — ...", "TP — ...", "Structure — ..."],`,
    `  "summary": "one sentence overview",`,
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
  timeframe?: string | null
  entry_price?: unknown
  stop_loss?: unknown
  take_profit?: unknown
  summary?: string
  confidence?: unknown
  sl_verdict?: string
  sl_coaching?: string
  tp_verdict?: string
  tp_coaching?: string
  structure_tags?: unknown
  structure_observations?: unknown
  suggested_stop_loss?: unknown
  suggested_take_profit?: unknown
  pointers?: unknown
}

function buildPointersFromPayload(parsed: AiPayload): string[] {
  const fromModel = Array.isArray(parsed.pointers)
    ? parsed.pointers.map((item) => String(item).trim()).filter(Boolean)
    : []

  const synthesized: string[] = []

  if (parsed.sl_coaching) {
    const verdict = String(parsed.sl_verdict || "").toLowerCase()
    const prefix =
      verdict.includes("tight")
        ? "SL — Stop looks tight"
        : verdict.includes("wide")
          ? "SL — Stop looks wide"
          : "SL —"
    synthesized.push(
      prefix === "SL —"
        ? `SL — ${String(parsed.sl_coaching)}`
        : `${prefix}: ${String(parsed.sl_coaching)}`,
    )
  }

  if (parsed.tp_coaching) {
    synthesized.push(`TP — ${String(parsed.tp_coaching)}`)
  }

  if (Array.isArray(parsed.structure_observations)) {
    for (const note of parsed.structure_observations) {
      const text = String(note).trim()
      if (text) synthesized.push(`Structure — ${text}`)
    }
  }

  const merged = [...fromModel, ...synthesized]
  const seen = new Set<string>()
  const unique: string[] = []
  for (const line of merged) {
    const key = line.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(line)
  }
  return unique.slice(0, 6)
}

function parsePayload(raw: string, pairHint?: string): PlanChartVisionResult {
  let parsed: AiPayload = {}
  try {
    parsed = JSON.parse(raw) as AiPayload
  } catch {
    parsed = {}
  }

  const pair = normalizePair(parsed.pair, pairHint)
  const direction = normalizeDirection(parsed.direction)
  const entryPrice = parsePrice(parsed.entry_price)
  const stopLoss = parsePrice(parsed.stop_loss)
  const takeProfit = parsePrice(parsed.take_profit)

  return {
    available: Boolean(pair && direction && (entryPrice || stopLoss || takeProfit)),
    source: normalizeSource(parsed.source),
    pair,
    direction,
    timeframe: typeof parsed.timeframe === "string" ? parsed.timeframe.trim() || null : null,
    entryPrice,
    stopLoss,
    takeProfit,
    summary: String(parsed.summary || "Chart analyzed for plan levels.").slice(0, 400),
    confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 50)),
    slAssessment: normalizeSlAssessment(parsed.sl_verdict),
    slCoaching: String(parsed.sl_coaching || "").slice(0, 400),
    tpAssessment: normalizeTpAssessment(parsed.tp_verdict),
    tpCoaching: String(parsed.tp_coaching || "").slice(0, 400),
    structureTags: normalizeStructureTags(parsed.structure_tags),
    structureObservations: Array.isArray(parsed.structure_observations)
      ? parsed.structure_observations.map((item) => String(item).trim()).filter(Boolean).slice(0, 4)
      : [],
    suggestedStopLoss: parsePrice(parsed.suggested_stop_loss),
    suggestedTakeProfit: parsePrice(parsed.suggested_take_profit),
    pointers: buildPointersFromPayload(parsed),
  }
}

async function analyzeWithOpenAi(
  imageUrl: string,
  hints: { pairHint?: string; directionHint?: TradePlanDirection },
): Promise<PlanChartVisionResult> {
  const openai = getOpenAiClient()
  if (!openai) throw new Error("OPENAI_API_KEY is not configured")

  const dataUrl = await fetchImageDataUrl(imageUrl).catch(() => imageUrl)

  const completion = await openai.chat.completions.create({
    model: getOpenAiVisionModel(),
    temperature: 0.15,
    max_tokens: 1400,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: buildPlanChartVisionPrompt(hints) },
          { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
        ],
      },
    ],
  })

  const content = completion.choices[0]?.message?.content
  if (!content) throw new Error("Vision returned an empty response")
  return parsePayload(content, hints.pairHint)
}

export async function analyzeTradePlanChartScreenshot(input: {
  imageUrl: string
  pairHint?: string
  directionHint?: TradePlanDirection
}): Promise<PlanChartVisionResult> {
  const imageUrl = input.imageUrl?.trim()
  if (!imageUrl) throw new Error("imageUrl is required")

  if (isOpenAiConfigured()) {
    try {
      return await analyzeWithOpenAi(imageUrl, {
        pairHint: input.pairHint,
        directionHint: input.directionHint,
      })
    } catch (error) {
      console.error("Trade plan chart vision error:", error)
    }
  }

  return {
    available: false,
    source: "unknown",
    pair: normalizePair(null, input.pairHint),
    direction: input.directionHint || "",
    timeframe: null,
    entryPrice: null,
    stopLoss: null,
    takeProfit: null,
    summary:
      "Add OPENAI_API_KEY to autofill entry, stop, and target from chart screenshots.",
    confidence: 0,
    slAssessment: "unknown",
    slCoaching: "",
    tpAssessment: "unknown",
    tpCoaching: "",
    structureTags: [],
    structureObservations: [],
    suggestedStopLoss: null,
    suggestedTakeProfit: null,
    pointers: [],
  }
}
