import { TRADE_PLANNER_PAIRS } from "@/lib/trade-planner/forex-pairs"
import type { TradePlanDirection } from "@/lib/trade-planner/types"
import { normalizeDirection, normalizeSymbol, parseEntryPrice } from "@/lib/tradingview/signal-normalizer"
import type { TradingViewSignalListItem, TradingViewSignalRecord } from "@/lib/tradingview/types"

export const TRADINGVIEW_PLANNER_HANDOFF_KEY = "vyronis.tradingviewPlannerHandoff"

export type TradingViewPlannerHandoff = {
  signalId: string
  pair: string
  direction: TradePlanDirection
  entryPrice: string
  stopLoss: string
  takeProfit: string
  chartUrl: string | null
  strategyName: string | null
  setupGrade: string | null
}

function formatPrice(value: number | string | null | undefined): string {
  if (value == null || value === "") return ""
  const numeric = typeof value === "number" ? value : Number.parseFloat(String(value))
  if (!Number.isFinite(numeric) || numeric <= 0) return ""
  const rounded = Math.round(numeric * 100000) / 100000
  return String(rounded)
}

function resolvePlannerPair(symbol: string): string {
  const normalized = normalizeSymbol(symbol)
  return (TRADE_PLANNER_PAIRS as readonly string[]).includes(normalized) ? normalized : normalized
}

export function buildTradingViewPlannerHandoff(
  signal: Pick<
    TradingViewSignalRecord | TradingViewSignalListItem,
    | "id"
    | "symbol"
    | "direction"
    | "strategy_name"
    | "entry_zone"
    | "stop_loss"
    | "take_profit"
    | "chart_url"
    | "ai_analysis"
  >,
): TradingViewPlannerHandoff {
  return {
    signalId: signal.id,
    pair: resolvePlannerPair(signal.symbol),
    direction: normalizeDirection(signal.direction),
    entryPrice: formatPrice(parseEntryPrice(signal.entry_zone ?? null)),
    stopLoss: formatPrice(signal.stop_loss),
    takeProfit: formatPrice(signal.take_profit),
    chartUrl: signal.chart_url ?? null,
    strategyName: signal.strategy_name ?? null,
    setupGrade: signal.ai_analysis?.setup_grade ?? null,
  }
}

export function writeTradingViewPlannerHandoff(handoff: TradingViewPlannerHandoff): void {
  if (typeof window === "undefined") return
  window.sessionStorage.setItem(TRADINGVIEW_PLANNER_HANDOFF_KEY, JSON.stringify(handoff))
}

export function readTradingViewPlannerHandoff(): TradingViewPlannerHandoff | null {
  if (typeof window === "undefined") return null

  try {
    const raw = window.sessionStorage.getItem(TRADINGVIEW_PLANNER_HANDOFF_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<TradingViewPlannerHandoff>
    if (!parsed?.signalId || !parsed.pair) return null
    return {
      signalId: parsed.signalId,
      pair: parsed.pair,
      direction: parsed.direction === "SELL" ? "SELL" : "BUY",
      entryPrice: typeof parsed.entryPrice === "string" ? parsed.entryPrice : "",
      stopLoss: typeof parsed.stopLoss === "string" ? parsed.stopLoss : "",
      takeProfit: typeof parsed.takeProfit === "string" ? parsed.takeProfit : "",
      chartUrl: typeof parsed.chartUrl === "string" ? parsed.chartUrl : null,
      strategyName: typeof parsed.strategyName === "string" ? parsed.strategyName : null,
      setupGrade: typeof parsed.setupGrade === "string" ? parsed.setupGrade : null,
    }
  } catch {
    return null
  }
}

export function clearTradingViewPlannerHandoff(): void {
  if (typeof window === "undefined") return
  window.sessionStorage.removeItem(TRADINGVIEW_PLANNER_HANDOFF_KEY)
}

export function getTradingViewPlannerHref(signal: TradingViewSignalListItem): string {
  const pair = resolvePlannerPair(signal.symbol)
  return `/trade-planner?pair=${encodeURIComponent(pair)}&fromSignal=${encodeURIComponent(signal.id)}`
}

export function openTradingViewSignalInPlanner(signal: TradingViewSignalListItem): string {
  const handoff = buildTradingViewPlannerHandoff(signal)
  writeTradingViewPlannerHandoff(handoff)
  return getTradingViewPlannerHref(signal)
}
