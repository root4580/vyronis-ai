export type CompanionConversationalState =
  | "calm"
  | "analytical"
  | "warning"
  | "protective"
  | "confident"
  | "reflective"

export type CompanionReplyResult = {
  content: string
  followUpQuestion?: string
  companionState: CompanionConversationalState
  thinkingPhases: string[]
  memoryReference?: string
  mentionedWarningIds: string[]
  isCriticalHighlight?: boolean
}

export type RecentTradeMemory = {
  id: string
  pair: string
  direction: string
  result: string
  pnl: number
  emotion: string
  session?: string | null
  trade_date?: string | null
  created_at: string
  rule_followed?: boolean | null
}

export const COMPANION_STATE_LABELS: Record<CompanionConversationalState, string> = {
  calm: "Calm",
  analytical: "Analytical",
  warning: "Alert",
  protective: "Protective",
  confident: "Confident",
  reflective: "Reflective",
}
