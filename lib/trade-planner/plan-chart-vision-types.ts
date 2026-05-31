import type { TradePlanDirection } from "@/lib/trade-planner/types"

export type PlanChartVisionSource =
  | "mt5_chart"
  | "mt5_order"
  | "tradingview"
  | "mobile_broker"
  | "unknown"

export type PlanSlAssessment = "tight" | "reasonable" | "wide" | "unknown"

export type PlanTpAssessment = "early" | "reasonable" | "extended" | "unknown"

export type PlanStructureTag =
  | "liquidity_sweep"
  | "fvg"
  | "order_block"
  | "ema"
  | "swing_high"
  | "swing_low"
  | "breakout"
  | "consolidation"

export type PlanChartVisionResult = {
  available: boolean
  source: PlanChartVisionSource
  pair: string
  direction: TradePlanDirection | ""
  timeframe: string | null
  entryPrice: number | null
  stopLoss: number | null
  takeProfit: number | null
  summary: string
  confidence: number
  slAssessment: PlanSlAssessment
  slCoaching: string
  tpAssessment: PlanTpAssessment
  tpCoaching: string
  structureTags: PlanStructureTag[]
  structureObservations: string[]
  suggestedStopLoss: number | null
  suggestedTakeProfit: number | null
  pointers: string[]
}

export type PlanChartAutofillResponse = {
  vision: PlanChartVisionResult
  applied: {
    pair: string
    direction: TradePlanDirection
    entryPrice: string
    stopLoss: string
    takeProfit: string
  } | null
  pointers: string[]
}

export type PlanPointerCategory = "sl" | "tp" | "structure" | "rr" | "general"

export type ParsedPlanPointer = {
  category: PlanPointerCategory
  message: string
}

export function parsePlanPointerLine(line: string): ParsedPlanPointer {
  const trimmed = line.trim()
  const slMatch = /^SL\s*[—–-]\s*(.+)$/i.exec(trimmed)
  if (slMatch) return { category: "sl", message: slMatch[1].trim() }

  const tpMatch = /^TP\s*[—–-]\s*(.+)$/i.exec(trimmed)
  if (tpMatch) return { category: "tp", message: tpMatch[1].trim() }

  const structureMatch = /^Structure\s*[—–-]\s*(.+)$/i.exec(trimmed)
  if (structureMatch) return { category: "structure", message: structureMatch[1].trim() }

  const rrMatch = /^R:R\s*[—–-]\s*(.+)$/i.exec(trimmed)
  if (rrMatch) return { category: "rr", message: rrMatch[1].trim() }

  return { category: "general", message: trimmed }
}
