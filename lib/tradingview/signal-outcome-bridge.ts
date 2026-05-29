import type { SupabaseClient } from "@supabase/supabase-js"
import type { OutcomeLessonRecord } from "@/lib/learning/outcome-learning-engine"
import { isMissingLearningTableError } from "@/lib/learning/server-service"
import type { TradingViewSignalAnalysis } from "@/lib/tradingview/types"

function isMissingSignalsTable(message: string): boolean {
  return /tradingview_signals|does not exist|PGRST205/i.test(message)
}

/** After a trade is logged, link it to the originating TradingView alert for the learn loop. */
export async function linkTradingViewAlertOutcome(input: {
  supabase: SupabaseClient
  userId: string
  tradeId: string
  sessionId?: string | null
  outcomeLesson?: OutcomeLessonRecord | null
}): Promise<void> {
  const { supabase, userId, tradeId, sessionId, outcomeLesson } = input

  let signalId: string | null = null

  if (sessionId) {
    const { data: session, error } = await supabase
      .from("trade_coach_sessions")
      .select("planned_context")
      .eq("user_id", userId)
      .eq("id", sessionId)
      .maybeSingle()

    if (error && !isMissingLearningTableError(error)) return
    const ctx = (session?.planned_context || {}) as { tradingview_signal_id?: string }
    signalId = ctx.tradingview_signal_id ? String(ctx.tradingview_signal_id) : null
  }

  if (!signalId) {
    const { data: sessions } = await supabase
      .from("trade_coach_sessions")
      .select("planned_context")
      .eq("user_id", userId)
      .eq("trade_id", tradeId)
      .limit(1)

    const ctx = (sessions?.[0]?.planned_context || {}) as { tradingview_signal_id?: string }
    signalId = ctx.tradingview_signal_id ? String(ctx.tradingview_signal_id) : null
  }

  if (!signalId) return

  const { data: signal, error: fetchError } = await supabase
    .from("tradingview_signals")
    .select("ai_analysis")
    .eq("user_id", userId)
    .eq("id", signalId)
    .maybeSingle()

  if (fetchError) {
    if (isMissingSignalsTable(fetchError.message)) return
    return
  }

  const analysis = (signal?.ai_analysis || {}) as TradingViewSignalAnalysis
  const outcome_learning = outcomeLesson
    ? {
        trade_id: tradeId,
        result: outcomeLesson.result,
        session_note: outcomeLesson.executionSummary,
        emotion: outcomeLesson.emotion,
        lesson: outcomeLesson.lesson,
        natural_reference: outcomeLesson.naturalReference,
        vyronis_was_right: outcomeLesson.vyronisWasRight,
        synced_at: new Date().toISOString(),
      }
    : {
        trade_id: tradeId,
        synced_at: new Date().toISOString(),
      }

  const { error: updateError } = await supabase
    .from("tradingview_signals")
    .update({
      trade_id: tradeId,
      status: "converted",
      ai_analysis: {
        ...analysis,
        outcome_learning,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", signalId)

  if (updateError && !isMissingSignalsTable(updateError.message)) {
    console.error("linkTradingViewAlertOutcome:", updateError.message)
  }
}
