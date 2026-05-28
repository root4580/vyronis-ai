import type { PrimaryLeakInsight } from "@/lib/behavior/types"
import type { PlannedCoachSessionItem } from "@/lib/trade-coach/types"
import type { PatternMemoryPattern } from "@/lib/trade-coach/pattern-memory"

import type { CompanionConversationalState } from "@/lib/intelligence/conversational-types"

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

export type CommandCenterOpenOptions = {
  mode?: CommandCenterMode
  focusId?: string | null
  recordTransition?: boolean
  transitionLabel?: string
}

export type CommandCenterContext = {
  enabled: boolean
  threadId: string
  companionThreadId: string
  mode: CommandCenterMode
  focusId: string | null
  companionState: CompanionConversationalState
  greeting: CommandCenterGreeting
  warnings: CommandCenterWarning[]
  snapshot: CommandCenterTraderSnapshot
  primaryLeak: PrimaryLeakInsight
  topPatterns: PatternMemoryPattern[]
  plannedSessions: PlannedCoachSessionItem[]
  messages: CommandCenterMessageRecord[]
  /** Warnings not yet mentioned in the companion thread (avoids duplicate UI signals) */
  freshWarnings: CommandCenterWarning[]
}
