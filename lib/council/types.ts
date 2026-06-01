export type CouncilAgentId = "sarah" | "adam" | "scott" | "hamza" | "khalid"

export type CouncilAgentDefinition = {
  id: CouncilAgentId
  name: string
  role: string
  personality: string
  maxSentences: number
  accentClass: string
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
  sarah_voice_id: string | null
  adam_voice_id: string | null
  scott_voice_id: string | null
  hamza_voice_id: string | null
  khalid_voice_id: string | null
  auto_briefing_enabled: boolean
  briefing_time: string
  language_preference: string
  last_briefing_date: string | null
  updated_at: string
}

export type CouncilAgentContext = {
  sarah: string
  adam: string
  scott: string
  hamza: string
  khalid: string
  traderFirstName: string
  chapterNumber: number
  chapterLabel: string
}

export type CouncilBriefingResponse = {
  sessionId: string
  messages: CouncilTranscriptEntry[]
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
  migrationPending?: boolean
}
