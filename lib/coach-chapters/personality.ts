import { formatPnL } from "@/lib/trade-utils"
import type { WeeklySummaryRecord } from "@/lib/weekly-chapters/types"
import type { CoachGradeBand, CoachMilestone } from "@/lib/coach-chapters/types"

const BANNED_PHRASES: Array<[RegExp, string]> = [
  [/skip this trade/gi, "This setup isn't ready yet — let it develop and come back stronger."],
  [/fails your minimum grade/gi, "Your edge is built on patience. This one needs more time."],
  [/minimum grade/gi, "your process bar"],
  [/\brejected\b/gi, "not ready yet"],
  [/not qualified/gi, "not ready yet"],
  [/stand down for now/gi, "protect your chapter — a better setup is coming"],
  [/process or psychology blockers/gi, "your mind or the setup needs more alignment"],
  [/consider skipping this trade/gi, "Not today — protect your chapter. A better setup is coming."],
  [/auto-grades skip/gi, "flags as not ready yet"],
  [/skip for process/gi, "Not today — protect your chapter"],
  [/skip —/gi, "Not yet —"],
  [/\bSKIP\b/g, "NOT YET"],
]

export function sanitizeCoachLanguage(text: string): string {
  let result = text
  for (const [pattern, replacement] of BANNED_PHRASES) {
    result = result.replace(pattern, replacement)
  }
  return result
}

export function buildCooldownCoachIntro(firstName: string): string {
  const name = firstName.trim() || "Trader"
  return sanitizeCoachLanguage(
    `Hey ${name}. Three tough trades in a row. That happens to every great trader.

Before your next move, let's talk.

Not to stop you — but to make sure your next trade is your best trade.

Ready?`,
  )
}

export const COOLDOWN_WARM_QUESTIONS = [
  {
    key: "loss_cause" as const,
    prompt:
      "Looking at your last 3 trades honestly, what do you think happened?",
    placeholder: "Setup, execution, emotion, or market conditions…",
  },
  {
    key: "change_plan" as const,
    prompt: "What's ONE thing you'll do differently on your next entry?",
    placeholder: "One concrete change — wait for close, smaller size, run Coach first…",
  },
  {
    key: "emotional_score" as const,
    prompt: "On a scale of 1–10, how clear and calm is your mind right now?",
    placeholder: "10 = clear and calm, 1 = reactive or tilted",
    type: "score" as const,
  },
]

export function buildCooldownUnlockSuccessMessage(firstName: string): string {
  const name = firstName.trim() || "Trader"
  return sanitizeCoachLanguage(
    `That's the mindset of a professional, ${name}. You've reflected, you're ready. Go find your A+ setup. Make this next trade count.`,
  )
}

export function buildCooldownSoftLockMessage(firstName: string): string {
  const name = firstName.trim() || "Trader"
  return sanitizeCoachLanguage(
    `Your honesty shows real self-awareness, ${name}. The market will be here tomorrow. Go do something good for yourself today. Chapter continues fresh on Monday. Paper trading stays open in Practice Room if you want to study setups.`,
  )
}

export function buildChapterOpeningMessage(input: {
  firstName: string
  recentChapter: WeeklySummaryRecord | null
}): string {
  const name = input.firstName.trim() || "Trader"
  const chapter = input.recentChapter
  if (!chapter) {
    return sanitizeCoachLanguage(
      `${name}, this is a new chapter in your journey. I'm here with you — not to enforce rules, but to help you trade your best setups.`,
    )
  }

  const pnlText = formatPnL(chapter.pnl, chapter.pnl >= 0 ? "WIN" : "LOSS")
  const resultPhrase =
    chapter.trades_taken === 0
      ? "You stayed patient — no trades logged"
      : chapter.pnl >= 0
        ? `You took ${chapter.trades_taken} trade${chapter.trades_taken === 1 ? "" : "s"} and finished ${pnlText}`
        : `You took ${chapter.trades_taken} trade${chapter.trades_taken === 1 ? "" : "s"}, P&L ${pnlText}`

  const characterLine =
    chapter.losses > 0 && chapter.key_lesson
      ? chapter.key_lesson
      : chapter.pnl >= 0
        ? "You traded with discipline — that's the standard."
        : chapter.trades_taken > 0
          ? "You held your SL like a pro — that's character."
          : "Patience is part of your edge."

  return sanitizeCoachLanguage(
    `${name}, last week was Chapter ${chapter.chapter_number}. ${resultPhrase}. ${characterLine}`,
  )
}

export const PRE_TRADE_TOGETHER_LINE =
  "Let's look at this together — I'll review the setup with your chapter history in mind."

export function buildPreTradeGradeMessage(input: {
  grade: CoachGradeBand
  pair?: string
  missingReasons?: string[]
}): string {
  const pair = input.pair ?? "this pair"
  if (input.grade === "A+" || input.grade === "A") {
    return sanitizeCoachLanguage(
      "This is what you've been waiting for. All filters aligned. Clean structure. Trust your analysis. Execute the plan.",
    )
  }

  const missing =
    input.missingReasons?.length && input.missingReasons.length > 0
      ? input.missingReasons.slice(0, 2).join(" · ")
      : "Wait for the full confirmation on your entry timeframe."

  return sanitizeCoachLanguage(
    `This setup on ${pair} has potential but isn't quite there yet. Here's what's missing: ${missing}

Want to paper trade it instead and watch how it develops?`,
  )
}

export function buildPaperTradeGradeMessage(input: {
  grade: CoachGradeBand
  missingReasons?: string[]
}): string {
  const missing =
    input.missingReasons?.length && input.missingReasons.length > 0
      ? input.missingReasons.slice(0, 2).join(", ")
      : "confirmation on your entry timeframe"

  switch (input.grade) {
    case "A+":
      return sanitizeCoachLanguage(
        "This is a beautiful setup. All filters aligned perfectly. Paper trade it and trust your analysis. This is exactly what you look for.",
      )
    case "A":
      return sanitizeCoachLanguage(
        "Solid setup with good structure. One or two filters need watching. Great learning opportunity — paper trade it and take notes.",
      )
    case "B":
      return sanitizeCoachLanguage(
        `This setup has potential but isn't quite ready yet. Here's what's missing: ${missing}. Perfect for paper trading to learn what confirmation looks like.`,
      )
    case "C":
    case "D":
    case "low":
    default:
      return sanitizeCoachLanguage(
        "This one needs more development. Not ready yet — but paper trading it will show you exactly why. Watch how it plays out and learn.",
      )
  }
}

export function buildWeeklyCoachReviewMessage(input: {
  firstName: string
  chapterNumber: number
  narrativeLines: string[]
  carryForwardLesson: string
}): string {
  const name = input.firstName.trim() || "Trader"
  const body = input.narrativeLines.join("\n\n")
  return sanitizeCoachLanguage(
    `Chapter ${input.chapterNumber} is complete, ${name}.

Here's what I saw this week:

${body}

One thing to carry into Chapter ${input.chapterNumber + 1}:
"${input.carryForwardLesson}"

You're building something real here. See you next week.`,
  )
}

export function buildMilestoneCelebration(milestone: CoachMilestone): string {
  return sanitizeCoachLanguage(milestone.message)
}

export function mapSetupGradeToBand(grade: string | null | undefined): CoachGradeBand {
  const normalized = (grade ?? "").replace(/\s+/g, "").toUpperCase()
  if (normalized === "A+") return "A+"
  if (normalized === "A") return "A"
  if (normalized === "B") return "B"
  if (normalized === "C") return "C"
  if (normalized === "D") return "D"
  return "low"
}

export function shouldTakeTradeGrowthLabel(
  shouldTakeTrade?: "yes" | "caution" | "no" | null,
): string | null {
  if (shouldTakeTrade === "yes") {
    return sanitizeCoachLanguage("Aligned with your process — execute the plan with discipline.")
  }
  if (shouldTakeTrade === "caution") {
    return sanitizeCoachLanguage(
      "Valid setup — wait for confirmation before entry. Patience is the edge.",
    )
  }
  if (shouldTakeTrade === "no") {
    return sanitizeCoachLanguage("Skip this trade — playbook or setup quality is not there.")
  }
  return null
}
