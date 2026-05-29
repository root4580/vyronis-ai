import type {
  EmotionCheckAnswers,
  MarketBiasInput,
  MarketBiasRecord,
  PairPlanInput,
  PostTradeReviewAnswers,
  StrategyBrainDashboard,
  StrategySetupEvaluationInput,
  StrategySetupEvaluationResult,
  WeeklyPlanWithPairs,
} from "@/lib/strategy-brain/types"

async function parseJson<T>(res: Response): Promise<T> {
  const body = (await res.json()) as T & { error?: string }
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? res.statusText)
  }
  return body as T
}

export async function fetchStrategyBrainDashboard(): Promise<StrategyBrainDashboard> {
  const res = await fetch("/api/strategy-brain/dashboard")
  return parseJson<StrategyBrainDashboard>(res)
}

export async function fetchMarketBias(): Promise<MarketBiasRecord | null> {
  const res = await fetch("/api/strategy-brain/bias")
  const data = await parseJson<{ bias: MarketBiasRecord | null }>(res)
  return data.bias
}

export async function saveMarketBias(input: MarketBiasInput): Promise<MarketBiasRecord> {
  const res = await fetch("/api/strategy-brain/bias", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const data = await parseJson<{ bias: MarketBiasRecord }>(res)
  return data.bias
}

export async function fetchWeeklyPlan(weekStart?: string): Promise<WeeklyPlanWithPairs> {
  const q = weekStart ? `?week=${encodeURIComponent(weekStart)}` : ""
  const res = await fetch(`/api/strategy-brain/weekly-plan${q}`)
  return parseJson<WeeklyPlanWithPairs>(res)
}

export async function saveWeeklyPlan(input: {
  week_start?: string
  session_notes?: string
  pairs: PairPlanInput[]
}): Promise<WeeklyPlanWithPairs> {
  const res = await fetch("/api/strategy-brain/weekly-plan", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  return parseJson<WeeklyPlanWithPairs>(res)
}

export async function updatePairAoiStatus(
  pairPlanId: string,
  aoi_status: import("@/lib/strategy-brain/types").AoiStatus,
): Promise<void> {
  const res = await fetch("/api/strategy-brain/pair-plans/status", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pair_plan_id: pairPlanId, aoi_status }),
  })
  await parseJson(res)
}

export async function evaluateStrategySetup(
  input: StrategySetupEvaluationInput,
): Promise<StrategySetupEvaluationResult> {
  const res = await fetch("/api/strategy-brain/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  return parseJson<StrategySetupEvaluationResult>(res)
}

export async function submitEmotionCheck(input: {
  pair?: string
  trade_id?: string
  answers: EmotionCheckAnswers
}): Promise<{ id: string; emotion_score: number; result: import("@/lib/strategy-brain/types").EmotionCheckResult }> {
  const res = await fetch("/api/strategy-brain/emotion-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  return parseJson(res)
}

export async function submitPostTradeReview(input: {
  trade_id: string
  answers: PostTradeReviewAnswers
}): Promise<{ id: string }> {
  const res = await fetch("/api/strategy-brain/post-review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  return parseJson(res)
}
