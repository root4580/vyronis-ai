import type { MarketBiasRecord, WeeklyPlanWithPairs } from "@/lib/strategy-brain/types"

export type WarRoomWorkflowStep = {
  id: string
  label: string
  complete: boolean
  hint: string
}

export type WarRoomReadiness = {
  percent: number
  steps: WarRoomWorkflowStep[]
  headline: string
}

export function computeWarRoomReadiness(input: {
  weekPlan: WeeklyPlanWithPairs | null
  marketBias: MarketBiasRecord | null
  sessionFocus: string
  expectedScenarios: string
}): WarRoomReadiness {
  const pairs = input.weekPlan?.pairs ?? []
  const pairsWithThesis = pairs.filter((p) => p.weekly_thesis?.trim()).length
  const pairsWithAoi = pairs.filter(
    (p) => p.aoi_high != null && p.aoi_low != null,
  ).length
  const pairsWithInvalidation = pairs.filter((p) => p.invalidation != null).length
  const pairsWatching = pairs.filter((p) => p.aoi_status !== "INVALIDATED").length

  const biasSet =
    Boolean(input.marketBias) &&
    input.marketBias!.weekly_bias !== "Neutral" &&
    input.marketBias!.daily_bias !== "Neutral"

  const steps: WarRoomWorkflowStep[] = [
    {
      id: "bias",
      label: "HTF bias",
      complete: Boolean(input.marketBias?.directional_permission),
      hint: input.marketBias?.conflict_summary || "Set weekly / daily / H4 bias",
    },
    {
      id: "pairs",
      label: "Watchlist",
      complete: pairs.length >= 1 && pairs.length <= 5,
      hint:
        pairs.length === 0
          ? "Add at least one pair"
          : pairs.length < 3
            ? `${pairs.length} pair — 3–5 recommended for broader focus`
            : `${pairs.length}/5 pairs selected`,
    },
    {
      id: "aoi",
      label: "AOI zones",
      complete: pairs.length > 0 && pairsWithAoi >= 1,
      hint: `${pairsWithAoi} pairs with AOI range`,
    },
    {
      id: "invalidation",
      label: "Invalidation",
      complete: pairs.length > 0 && pairsWithInvalidation >= 1,
      hint: `${pairsWithInvalidation} invalidation levels set`,
    },
    {
      id: "thesis",
      label: "Thesis",
      complete: pairsWithThesis >= Math.min(2, pairs.length),
      hint: `${pairsWithThesis} pair theses written`,
    },
    {
      id: "session",
      label: "Session plan",
      complete:
        input.sessionFocus.trim().length > 12 && input.expectedScenarios.trim().length > 12,
      hint: "Focus + expected scenarios",
    },
    {
      id: "monitor",
      label: "AOI monitor",
      complete: pairsWatching > 0 && pairs.some((p) => p.aoi_status !== "WAITING"),
      hint: `${pairsWatching} pairs on watch — human marks status`,
    },
  ]

  const done = steps.filter((s) => s.complete).length
  const percent = Math.round((done / steps.length) * 100)

  let headline = "Mission prep in progress"
  if (percent >= 85) headline = "War Room ready — execute with discretion"
  else if (percent >= 55) headline = "Core plan set — finish AOI & session notes"
  else if (!biasSet) headline = "Start with HTF bias before picking setups"

  return { percent, steps, headline }
}
