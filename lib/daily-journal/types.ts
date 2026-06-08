export type DailyJournalEntry = {
  id: string
  sessionDate: string
  improveTomorrow: string
  rulesNextSession: string
  focusArea: string
  updatedAt: string
}

export type DailyJournalClosePayload = {
  accountId: string
  sessionDate?: string
  improveTomorrow: string
  rulesNextSession: string
  focusArea: string
}

export type DailyJournalCloseResponse = {
  connected: boolean
  entry: DailyJournalEntry | null
  setupMessage?: string | null
}
