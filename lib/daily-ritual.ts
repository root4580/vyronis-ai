import { detectPrimaryLeak, type LeakEngineInput } from "@/lib/behavior"
import { getSignedPnL } from "@/lib/trade-utils"
import { getLocalDateKey, getTodayTrades } from "@/lib/user-settings"

export type RitualStepId = "check-in" | "coach" | "log" | "debrief"

export type DailyRitualStoredState = {
  dateKey: string
  checkIn?: {
    emotion: string
    completedAt: string
  }
  coach?: {
    completedAt: string
  }
  debrief?: {
    completedAt: string
  }
}

export type RitualStepStatus = "pending" | "current" | "complete"

export type RitualStepView = {
  id: RitualStepId
  label: string
  shortLabel: string
  status: RitualStepStatus
  hint: string
}

export type DailyDebriefSummary = {
  tradeCount: number
  winCount: number
  lossCount: number
  todayPnL: number
  rulesFollowedPercent: number
  correctiveAction: string
  hasTodayLeak: boolean
}

export type DailyRitualView = {
  dateKey: string
  steps: RitualStepView[]
  debrief: DailyDebriefSummary
  completedCount: number
  progressPercent: number
  allComplete: boolean
  checkInEmotion: string | null
}

const STORAGE_PREFIX = "vyronis-daily-ritual"

function readStorage(key: string): DailyRitualStoredState | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DailyRitualStoredState
    if (!parsed?.dateKey) return null
    return parsed
  } catch {
    return null
  }
}

function writeStorage(key: string, state: DailyRitualStoredState): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(key, JSON.stringify(state))
}

export function getDailyRitualStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`
}

export function loadDailyRitualState(userId: string): DailyRitualStoredState {
  const todayKey = getLocalDateKey(new Date())
  const key = getDailyRitualStorageKey(userId)
  const stored = readStorage(key)
  if (!stored || stored.dateKey !== todayKey) {
    return { dateKey: todayKey }
  }
  return stored
}

export function saveDailyRitualState(userId: string, state: DailyRitualStoredState): void {
  writeStorage(getDailyRitualStorageKey(userId), state)
}

export function markRitualCheckIn(userId: string, emotion: string): DailyRitualStoredState {
  const state = loadDailyRitualState(userId)
  state.checkIn = { emotion, completedAt: new Date().toISOString() }
  saveDailyRitualState(userId, state)
  return state
}

export function markRitualCoachEngaged(userId: string): DailyRitualStoredState {
  const state = loadDailyRitualState(userId)
  state.coach = { completedAt: new Date().toISOString() }
  saveDailyRitualState(userId, state)
  return state
}

export function markRitualDebriefComplete(userId: string): DailyRitualStoredState {
  const state = loadDailyRitualState(userId)
  state.debrief = { completedAt: new Date().toISOString() }
  saveDailyRitualState(userId, state)
  return state
}

function isCoachStepComplete(
  stored: DailyRitualStoredState,
  plannedInProgress: boolean,
): boolean {
  if (stored.coach?.completedAt) return true
  return plannedInProgress
}

function isLogStepComplete<T extends { trade_date?: string | null; created_at: string }>(
  trades: T[],
): boolean {
  return getTodayTrades(trades).length > 0
}

function isDebriefStepComplete(
  stored: DailyRitualStoredState,
  logComplete: boolean,
): boolean {
  if (stored.debrief?.completedAt) return true
  return false
}

export function buildDailyDebriefSummary<T extends LeakEngineInput["trades"][number]>(
  trades: T[],
  maxRiskPerTrade: number,
): DailyDebriefSummary {
  const todayTrades = getTodayTrades(trades)
  const winCount = todayTrades.filter((t) => t.result === "WIN").length
  const lossCount = todayTrades.filter((t) => t.result === "LOSS").length
  const todayPnL = todayTrades.reduce((sum, trade) => sum + getSignedPnL(trade.pnl, trade.result), 0)
  const rulesFollowed = todayTrades.filter((trade) => trade.rule_followed !== false).length
  const rulesFollowedPercent =
    todayTrades.length > 0 ? Math.round((rulesFollowed / todayTrades.length) * 100) : 100

  let correctiveAction =
    "Log today's trades with honest emotion tags — your debrief sharpens with real session data."
  let hasTodayLeak = false

  if (todayTrades.length >= 2) {
    const todayLeak = detectPrimaryLeak({
      trades: todayTrades,
      maxRiskPerTrade,
      lookbackDays: 1,
    })
    correctiveAction = todayLeak.correctiveAction
    hasTodayLeak = todayLeak.status !== "insufficient_data"
  } else if (todayTrades.length === 1) {
    correctiveAction =
      "One trade logged — add emotion and confirmation on the next entry to expose today's pattern."
  }

  return {
    tradeCount: todayTrades.length,
    winCount,
    lossCount,
    todayPnL,
    rulesFollowedPercent,
    correctiveAction,
    hasTodayLeak,
  }
}

function resolveStepStatuses(
  checkInComplete: boolean,
  coachComplete: boolean,
  logComplete: boolean,
  debriefComplete: boolean,
): RitualStepView[] {
  const completion = [checkInComplete, coachComplete, logComplete, debriefComplete]
  const firstIncomplete = completion.findIndex((done) => !done)

  const defs: Array<Omit<RitualStepView, "status">> = [
    {
      id: "check-in",
      label: "Check-in",
      shortLabel: "Check-in",
      hint: "Set emotional baseline before the session.",
    },
    {
      id: "coach",
      label: "Coach",
      shortLabel: "Coach",
      hint: "Run pre-trade coach on your planned setup.",
    },
    {
      id: "log",
      label: "Log",
      shortLabel: "Log",
      hint: "Journal today's executions while memory is fresh.",
    },
    {
      id: "debrief",
      label: "Debrief",
      shortLabel: "Debrief",
      hint: "Close the day with one corrective focus.",
    },
  ]

  return defs.map((step, index) => {
    let status: RitualStepStatus = "pending"
    if (completion[index]) {
      status = "complete"
    } else if (firstIncomplete === index) {
      status = "current"
    }
    return { ...step, status }
  })
}

export function buildDailyRitualView(input: {
  userId: string
  trades: LeakEngineInput["trades"]
  maxRiskPerTrade: number
  hasPlannedCoachInProgress: boolean
  storedState?: DailyRitualStoredState
}): DailyRitualView {
  const stored = input.storedState ?? loadDailyRitualState(input.userId)
  const checkInComplete = Boolean(stored.checkIn?.completedAt)
  const coachComplete = isCoachStepComplete(stored, input.hasPlannedCoachInProgress)
  const logComplete = isLogStepComplete(input.trades)
  const debriefComplete = isDebriefStepComplete(stored, logComplete)

  const steps = resolveStepStatuses(checkInComplete, coachComplete, logComplete, debriefComplete)
  const debrief = buildDailyDebriefSummary(input.trades, input.maxRiskPerTrade)
  const completedCount = [checkInComplete, coachComplete, logComplete, debriefComplete].filter(
    Boolean,
  ).length

  return {
    dateKey: stored.dateKey,
    steps,
    debrief,
    completedCount,
    progressPercent: Math.round((completedCount / 4) * 100),
    allComplete: completedCount === 4,
    checkInEmotion: stored.checkIn?.emotion ?? null,
  }
}
