import { parseMistakeTags } from "@/lib/trade-form-config"

type TradeReviewInput = {
  result: string
  pnl: number
  emotion: string | null
  rule_followed: boolean | null
  mistake_tags: string | null
  coach_grade: string | null
  coach_insight: string | null
  coach_strengths: string[]
  coach_warnings: string[]
}

function normalizeResult(result: string): string {
  return result.toUpperCase()
}

export function buildChapterTradeReviewNotes(input: TradeReviewInput): {
  whatWentRight: string | null
  whatWentWrong: string | null
} {
  const result = normalizeResult(input.result)
  const isWin = result === "WIN" || input.pnl > 0
  const isLoss = result === "LOSS" || input.pnl < 0

  const strengths: string[] = [...input.coach_strengths]
  const warnings: string[] = [...input.coach_warnings]

  if (isWin) {
    if (input.rule_followed === true) {
      strengths.unshift("You followed your plan — process over outcome.")
    }
    if (input.coach_grade?.replace(/\s+/g, "").toUpperCase() === "A+") {
      strengths.unshift("Coach graded this A+ — high-quality setup execution.")
    } else if (input.coach_insight) {
      strengths.push(input.coach_insight)
    }
    const emotion = (input.emotion ?? "").toLowerCase()
    if (emotion.includes("calm") || emotion.includes("disciplined") || emotion.includes("confident")) {
      strengths.unshift(`Emotional state was ${input.emotion} — good composure.`)
    }

    return {
      whatWentRight: strengths[0] ?? "Green trade logged — note what you repeated.",
      whatWentWrong: null,
    }
  }

  if (isLoss) {
    if (input.rule_followed === false) {
      warnings.unshift("Trading rules were not followed on this trade.")
    }

    const emotion = (input.emotion ?? "").toLowerCase()
    if (emotion.includes("revenge")) {
      warnings.unshift("Revenge emotion tagged — classic tilt trigger.")
    } else if (emotion.includes("fomo")) {
      warnings.unshift("FOMO emotion tagged — entry may have been rushed.")
    } else if (emotion.includes("anxious") || emotion.includes("fear")) {
      warnings.unshift(`Emotion was ${input.emotion} — size or timing may have been off.`)
    }

    const tags = parseMistakeTags(input.mistake_tags)
    if (tags.length > 0) {
      warnings.push(`Mistakes noted: ${tags.slice(0, 3).join(", ")}.`)
    }

    if (!input.coach_grade) {
      warnings.push("No Coach grade on this trade — harder to see setup quality in hindsight.")
    } else if (input.coach_insight) {
      warnings.push(input.coach_insight)
    }

    return {
      whatWentRight: null,
      whatWentWrong: warnings[0] ?? "Loss logged — review entry timing and rule adherence.",
    }
  }

  return { whatWentRight: null, whatWentWrong: null }
}
