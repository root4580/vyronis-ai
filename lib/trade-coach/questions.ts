export {
  buildCoachIntro,
  estimateQuestionCount,
  extractResponsesFromMessages,
  getActiveQuestionFromSession,
  getAnsweredKeys,
  getCoachWorkflowPhase,
  getNextQuestionKey,
  getQuestionByKey,
  hasChartUploaded,
  normalizeAnswer,
  validateAnswer,
} from "@/lib/trade-coach/pre-trade-flow"

/** @deprecated Use dynamic flow from pre-trade-flow.ts */
export const PRE_TRADE_QUESTIONS = [] as const

/** @deprecated Use getQuestionByKey instead */
export function getPreTradeQuestion(_index: number) {
  return null
}

/** @deprecated Use estimateQuestionCount instead */
export function getPreTradeQuestionCount() {
  return 9
}

export function buildCoachClosingMessage() {
  return "Pre-trade check-in complete."
}
