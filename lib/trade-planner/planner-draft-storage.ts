import type { TradePlanDirection } from "@/lib/trade-planner/types"

export const PLANNER_DRAFT_STORAGE_KEY = "vyronis:trade-planner-draft"

export type PlannerDraft = {
  pair: string
  direction: TradePlanDirection
  accountSize: string
  riskPercent: string
  entryPrice: string
  stopLoss: string
  takeProfit: string
  loadedPlanId: string | null
  editingPlanId: string | null
  chartScreenshotUrl: string | null
  chartPointers: string[]
  updatedAt: number
}

export function readPlannerDraft(): PlannerDraft | null {
  if (typeof window === "undefined") return null

  try {
    const raw = window.localStorage.getItem(PLANNER_DRAFT_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<PlannerDraft>
    if (!parsed || typeof parsed !== "object") return null

    return {
      pair: typeof parsed.pair === "string" ? parsed.pair : "EURUSD",
      direction: parsed.direction === "SELL" ? "SELL" : "BUY",
      accountSize: typeof parsed.accountSize === "string" ? parsed.accountSize : "",
      riskPercent: typeof parsed.riskPercent === "string" ? parsed.riskPercent : "",
      entryPrice: typeof parsed.entryPrice === "string" ? parsed.entryPrice : "",
      stopLoss: typeof parsed.stopLoss === "string" ? parsed.stopLoss : "",
      takeProfit: typeof parsed.takeProfit === "string" ? parsed.takeProfit : "",
      loadedPlanId: typeof parsed.loadedPlanId === "string" ? parsed.loadedPlanId : null,
      editingPlanId: typeof parsed.editingPlanId === "string" ? parsed.editingPlanId : null,
      chartScreenshotUrl:
        typeof parsed.chartScreenshotUrl === "string" ? parsed.chartScreenshotUrl : null,
      chartPointers: Array.isArray(parsed.chartPointers)
        ? parsed.chartPointers.filter((item): item is string => typeof item === "string")
        : [],
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0,
    }
  } catch {
    return null
  }
}

export function writePlannerDraft(draft: PlannerDraft): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(PLANNER_DRAFT_STORAGE_KEY, JSON.stringify(draft))
}

export function clearPlannerDraft(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(PLANNER_DRAFT_STORAGE_KEY)
}
