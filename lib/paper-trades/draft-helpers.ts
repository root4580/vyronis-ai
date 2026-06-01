import type { PaperTradeDraft } from "@/lib/paper-trades/types"
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
