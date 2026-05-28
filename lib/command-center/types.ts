import type { PrimaryLeakInsight } from "@/lib/behavior/types"
import type { PlannedCoachSessionItem } from "@/lib/trade-coach/types"
import type { PatternMemoryPattern } from "@/lib/trade-coach/pattern-memory"

export type CommandCenterMode = "companion" | "pre_trade" | "post_trade" | "weekly"

export type CommandCenterMessageRole = "user" | "assistant" | "system"

export type CommandCenterMessageType =
  | "text"
  | "greeting"
  | "warning"
  | "card"
  | "analysis"
  | "system"

export type CommandCenterMessageRecord = {
  id: string
  thread_id: string
  role: CommandCenterMessageRole
  message_type: CommandCenterMessageType
  content: string
  payload: Record<string, unknown>
  created_at: string
}

export type CommandCenterWarning = {
  id: string
  severity: "info" | "warning" | "critical"
  title: string
  message: string
  source: "leak" | "pattern" | "risk" | "planned"
}

export type CommandCenterGreeting = {
  headline: string
  subline: string
  sessionLabel: string
}

export type CommandCenterTraderSnapshot = {
  tradeCount: number
  todayTradeCount: number
  todayPnL: number
  winRate: number
  plannedCount: number
  unreadSignalCount: number
}

export type CommandCenterContext = {
  enabled: boolean
  threadId: string
  mode: CommandCenterMode
  greeting: CommandCenterGreeting
  warnings: CommandCenterWarning[]
  snapshot: CommandCenterTraderSnapshot
  primaryLeak: PrimaryLeakInsight
  topPatterns: PatternMemoryPattern[]
  plannedSessions: PlannedCoachSessionItem[]
  messages: CommandCenterMessageRecord[]
}
