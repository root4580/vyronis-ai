export type CouncilAgentId = "jarvis" | "nova" | "zara" | "luna" | "rex" | "cipher"

export type CouncilAgentDefinition = {
  id: CouncilAgentId
  name: string
  role: string
  personality: string
  maxSentences: number
  accentClass: string
  /** Master coordinator — opens/closes briefing, routes council traffic. */
  isCoordinator?: boolean
}

export type CouncilTranscriptEntry = {
  id: string
  agent: CouncilAgentId | "user" | "system"
  content: string
  createdAt: string
}

export type CouncilSessionRecord = {
  id: string
  user_id: string
  account_id: string | null
  session_date: string
  agents_spoken: string[]
  full_transcript: CouncilTranscriptEntry[]
  key_insights: string[]
  briefing_completed: boolean
  created_at: string
  updated_at: string
}

export type CouncilSettingsRecord = {
  id: string
  user_id: string
  jarvis_voice_id: string | null
  nova_voice_id: string | null
  zara_voice_id: string | null
  rex_voice_id: string | null
  luna_voice_id: string | null
  cipher_voice_id: string | null
  auto_briefing_enabled: boolean
  briefing_time: string
  language_preference: string
  last_briefing_date: string | null
  updated_at: string
}

export type CouncilChartSnapshot = {
  pair: string
  url: string
  label: string
}

export type CouncilStatsSnapshot = {
  balance: number
  currency: string
  drawdownPct: number
  tradesThisWeek: number
  maxTradesPerWeek: number
  tradesRemaining: number
  disciplineScore: number | null
  chapterLabel: string
}

export type CouncilVisualContext = {
  stats: CouncilStatsSnapshot
  watchlistCharts: CouncilChartSnapshot[]
  lastTradeChart: CouncilChartSnapshot | null
}

export type CouncilAgentContext = {
  jarvis: string
  nova: string
  zara: string
  rex: string
  luna: string
  cipher: string
  traderFirstName: string
  chapterNumber: number
  chapterLabel: string
  preferredSession: string
  visual: CouncilVisualContext
}

export type CouncilMemoryHighlight = {
  agent: CouncilAgentId
  preview: string
  reply: string
}

export type CouncilHistorySession = {
  id: string
  sessionDate: string
  briefingCompleted: boolean
  messageCount: number
  keyInsights: string[]
}

export type CouncilBriefingResponse = {
  sessionId: string
  messages: CouncilTranscriptEntry[]
  keyInsights?: string[]
  migrationPending?: boolean
}

export type CouncilRespondResponse = {
  sessionId: string
  agent: CouncilAgentId
  message: CouncilTranscriptEntry
  messages: CouncilTranscriptEntry[]
  chimeIn?: CouncilTranscriptEntry | null
  migrationPending?: boolean
}

export type CouncilSessionResponse = {
  session: CouncilSessionRecord | null
  settings: CouncilSettingsRecord | null
  isMorningWindow: boolean
  voiceConfigured?: boolean
  listenConfigured?: boolean
  conversationAgent?: CouncilAgentId | null
  visual?: CouncilVisualContext | null
  keyInsights?: string[]
  memoryHighlights?: CouncilMemoryHighlight[]
  migrationPending?: boolean
}

export type CouncilHistoryResponse = {
  sessions: CouncilHistorySession[]
  migrationPending?: boolean
}

export type CouncilSettingsUpdateInput = {
  auto_briefing_enabled?: boolean
  briefing_time?: string
}
