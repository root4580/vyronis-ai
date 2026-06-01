export type CouncilAgentId = "nova" | "zara" | "luna" | "rex" | "cipher"

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

export type CouncilAgentContext = {
  nova: string
  zara: string
  rex: string
  luna: string
  cipher: string
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
