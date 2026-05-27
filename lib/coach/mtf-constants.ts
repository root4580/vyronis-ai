export const MTF_TIMEFRAME_IDS = ["weekly", "daily", "h4", "h1", "m15"] as const

export type CoachMtfTimeframe = (typeof MTF_TIMEFRAME_IDS)[number]

export type MtfSlotRole = "bias" | "entry"

export type MtfSlotConfig = {
  id: CoachMtfTimeframe
  label: string
  shortLabel: string
  role: MtfSlotRole
  urlField: keyof import("@/lib/trade-coach/types").TradeCoachSessionRecord
}

export const MTF_SLOTS: MtfSlotConfig[] = [
  {
    id: "weekly",
    label: "Weekly Bias Chart",
    shortLabel: "Weekly",
    role: "bias",
    urlField: "weekly_screenshot_url",
  },
  {
    id: "daily",
    label: "Daily Bias Chart",
    shortLabel: "Daily",
    role: "bias",
    urlField: "daily_screenshot_url",
  },
  {
    id: "h4",
    label: "H4 Bias Chart",
    shortLabel: "H4",
    role: "bias",
    urlField: "h4_screenshot_url",
  },
  {
    id: "h1",
    label: "H1 Setup Chart",
    shortLabel: "H1",
    role: "entry",
    urlField: "h1_screenshot_url",
  },
  {
    id: "m15",
    label: "M15 Entry Chart",
    shortLabel: "M15",
    role: "entry",
    urlField: "m15_screenshot_url",
  },
]

export const BIAS_TIMEFRAMES: CoachMtfTimeframe[] = ["weekly", "daily", "h4"]
export const ENTRY_TIMEFRAMES: CoachMtfTimeframe[] = ["h1", "m15"]

export function buildMtfStoragePath(
  userId: string,
  sessionId: string,
  timeframe: CoachMtfTimeframe,
  ext = "webp",
): string {
  return `${userId}/coach-sessions/${sessionId}/${timeframe}.${ext}`
}
