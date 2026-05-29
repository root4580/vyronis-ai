import type { TradeCoachMessageRecord } from "@/lib/trade-coach/types"

/** Show only the latest coach bubble; older coach lines go under View history. */
export function partitionCoachThreadMessages(
  messages: TradeCoachMessageRecord[],
  options?: { hideNarrativeWhenMtfVisible?: boolean },
): { visible: TradeCoachMessageRecord[]; history: TradeCoachMessageRecord[] } {
  if (messages.length === 0) {
    return { visible: [], history: [] }
  }

  const users = messages.filter((m) => m.role === "user")
  const coaches = messages.filter((m) => m.role === "coach")

  if (coaches.length === 0) {
    return { visible: messages, history: [] }
  }

  const withQuestion = coaches.filter((m) => m.question_key)
  const latestCoach = withQuestion[withQuestion.length - 1] ?? coaches[coaches.length - 1]

  const hideLatestNarrative =
    Boolean(options?.hideNarrativeWhenMtfVisible) && latestCoach && !latestCoach.question_key

  const history = coaches.filter((m) => m.id !== latestCoach?.id)
  const visible = [...users]
  if (latestCoach && !hideLatestNarrative) {
    visible.push(latestCoach)
  }

  visible.sort((a, b) => a.step_index - b.step_index)
  history.sort((a, b) => a.step_index - b.step_index)
  return { visible, history }
}
