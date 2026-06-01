import type { SupabaseClient } from "@supabase/supabase-js"
import { randomUUID } from "crypto"
import type { CouncilAgentContext, CouncilTranscriptEntry } from "@/lib/council/types"
import {
  buildNovaEmotionAck,
  buildNovaEmotionCheckQuestion,
  buildRexLowEmotionResponse,
  isNovaEmotionCheckPending,
  parseEmotionScoreFromMessage,
} from "@/lib/council/emotion-check"
import { buildJarvisOpening } from "@/lib/council/jarvis-service"

function todayDateISO(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

function isMissingCheckinTable(message: string): boolean {
  return /council_daily_checkins|relation .* does not exist|schema cache/i.test(message)
}

export async function getTodayCouncilEmotionCheck(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
): Promise<number | null> {
  const sessionDate = todayDateISO()
  const { data, error } = await supabase
    .from("council_daily_checkins")
    .select("emotion_score")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .eq("session_date", sessionDate)
    .maybeSingle()

  if (error) {
    if (isMissingCheckinTable(error.message)) return null
    throw new Error(error.message)
  }

  return data?.emotion_score != null ? Number(data.emotion_score) : null
}

export async function saveCouncilEmotionCheck(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  councilSessionId: string,
  score: number,
): Promise<void> {
  const sessionDate = todayDateISO()
  const { error } = await supabase.from("council_daily_checkins").upsert(
    {
      user_id: userId,
      account_id: accountId,
      session_date: sessionDate,
      emotion_score: score,
      council_session_id: councilSessionId,
    },
    { onConflict: "user_id,account_id,session_date" },
  )

  if (error) {
    if (isMissingCheckinTable(error.message)) return
    throw new Error(error.message)
  }
}

export function buildCouncilOpenMessages(context: CouncilAgentContext): CouncilTranscriptEntry[] {
  const now = new Date().toISOString()
  return [
    {
      id: randomUUID(),
      agent: "jarvis",
      content: buildJarvisOpening({
        traderFirstName: context.traderFirstName,
        preferredSession: context.preferredSession,
        balance: context.visual.stats.balance,
        currency: context.visual.stats.currency,
        drawdownPct: context.visual.stats.drawdownPct,
        watchlistCount: context.visual.watchlistCharts.length,
        economicCalendar: context.economicCalendar,
      }),
      createdAt: now,
    },
    {
      id: randomUUID(),
      agent: "nova",
      content: buildNovaEmotionCheckQuestion(context.traderFirstName),
      createdAt: now,
    },
  ]
}

export function buildEmotionCheckFollowUpMessages(score: number): CouncilTranscriptEntry[] {
  const now = new Date().toISOString()
  const messages: CouncilTranscriptEntry[] = [
    {
      id: randomUUID(),
      agent: "nova",
      content: buildNovaEmotionAck(score),
      createdAt: now,
    },
  ]

  if (score < 7) {
    messages.push({
      id: randomUUID(),
      agent: "rex",
      content: buildRexLowEmotionResponse(score),
      createdAt: now,
    })
  }

  return messages
}

export async function shouldRunCouncilOpenRitual(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  transcript: CouncilTranscriptEntry[],
): Promise<boolean> {
  if (transcript.length > 0) return false
  const existingScore = await getTodayCouncilEmotionCheck(supabase, userId, accountId)
  return existingScore == null
}

export function isAwaitingEmotionCheckResponse(transcript: CouncilTranscriptEntry[]): boolean {
  return isNovaEmotionCheckPending(transcript)
}

export function parseCouncilEmotionScore(message: string): number | null {
  return parseEmotionScoreFromMessage(message)
}
