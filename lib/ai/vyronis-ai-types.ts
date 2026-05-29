export type VyronisAITaskType =
  | "trading_setup_grading"
  | "strategy_document_review"
  | "screenshot_analysis"
  | "final_summary"

export type VyronisAIGrade = "A+" | "A" | "B" | "Skip"

export type VyronisAIResponse = {
  provider: string
  taskType: VyronisAITaskType
  score: number
  grade: VyronisAIGrade
  summary: string
  reasons: string[]
  warnings: string[]
  confidence: number
}

export type VyronisAIProviderId = "openai" | "claude" | "gemini"

export type RunVyronisAIInput = {
  taskType: VyronisAITaskType
  prompt: string
  data?: unknown
}

export type RunProviderInput = RunVyronisAIInput
