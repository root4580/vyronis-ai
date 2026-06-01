import type { PaperTradeDraft } from "@/lib/paper-trades/types"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"
import type { SetupGrade } from "@/lib/strategy-brain/types"
import type { PairPlanRecord } from "@/lib/strategy-brain/types"
import type { TradingViewSignalListItem } from "@/lib/tradingview/types"
import { biasToDirection, signalDirectionToTradeDirection } from "@/lib/paper-trades/stats"

function parseEntryFromZone(zone: string | null | undefined): number | null {
  if (!zone?.trim()) return null
  const match = zone.match(/[\d.]+/)
  return match ? parseFloat(match[0]) : null
}

function warRoomEntry(plan: PairPlanRecord): number | null {
  if (plan.aoi_low != null && plan.aoi_high != null) {
    return Number(((plan.aoi_low + plan.aoi_high) / 2).toFixed(5))
  }
  return plan.aoi_low ?? plan.aoi_high ?? null
}

export function buildWarRoomPaperDraft(plan: PairPlanRecord): PaperTradeDraft {
  const direction = biasToDirection(plan.directional_bias)
  return {
    symbol: plan.pair,
    direction,
    entry: warRoomEntry(plan),
    sl: plan.invalidation,
    tp: direction === "BUY" ? plan.aoi_high : plan.aoi_low,
    notes: [plan.weekly_thesis, plan.notes].filter(Boolean).join("\n"),
    source: "war_room",
    source_ref: plan.id,
  }
}

export function buildSignalPaperDraft(signal: TradingViewSignalListItem): PaperTradeDraft {
  return {
    symbol: signal.symbol,
    direction: signalDirectionToTradeDirection(signal.direction),
    entry: parseEntryFromZone(signal.entry_zone),
    sl: signal.stop_loss,
    tp: signal.take_profit,
    notes: signal.message ?? "",
    source: "webhook",
    source_ref: signal.id,
    setup_grade: signal.ai_analysis?.setup_grade ?? null,
  }
}

export function isAPlusSetupGrade(grade: string | null | undefined): boolean {
  return (grade ?? "").replace(/\s+/g, "").toUpperCase() === "A+"
}

export const PAPER_COACH_PENDING_KEY = "vyronis:paper-coach-pending"
export const PAPER_COACH_COMPLETE_EVENT = "vyronis:paper-coach-complete"

export type PaperCoachCompleteDetail = PaperTradeDraft & {
  coach_session_id?: string | null
}

export function writePaperCoachPending(draft: PaperTradeDraft): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(PAPER_COACH_PENDING_KEY, JSON.stringify(draft))
}

export function readPaperCoachPending(): PaperTradeDraft | null {
  if (typeof window === "undefined") return null
  const raw = sessionStorage.getItem(PAPER_COACH_PENDING_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as PaperTradeDraft
  } catch {
    return null
  }
}

export function clearPaperCoachPending(): void {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(PAPER_COACH_PENDING_KEY)
}

export function buildPlannedContextFromPaperDraft(draft: PaperTradeDraft): PreTradePlannedContext {
  return {
    pair: draft.symbol,
    direction: draft.direction,
    entry_price: draft.entry != null ? String(draft.entry) : undefined,
    stop_loss: draft.sl != null ? String(draft.sl) : undefined,
    take_profit: draft.tp != null ? String(draft.tp) : undefined,
    setup: draft.notes ?? undefined,
    chart_url: draft.chart_image_url ?? undefined,
    tradingview_setup_grade: (draft.setup_grade as SetupGrade | null | undefined) ?? undefined,
    signal_source: "manual",
    trade_date: new Date().toISOString().split("T")[0],
  }
}
