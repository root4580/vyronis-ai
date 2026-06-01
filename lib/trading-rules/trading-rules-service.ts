import type { SupabaseClient } from "@supabase/supabase-js"
import {
  accountScopeOrFilter,
  resolveActiveAccountId,
  resolveLegacyTradeAccountId,
} from "@/lib/accounts/server-active-account"
import { getTradingAccount } from "@/lib/accounts/trading-account-service"
import type { TradingAccountRecord } from "@/lib/accounts/types"
import {
  buildCooldownSoftLockMessage,
  buildCooldownUnlockSuccessMessage,
  sanitizeCoachLanguage,
} from "@/lib/coach-chapters/personality"
import { loadCoachChapterContext } from "@/lib/coach-chapters/context-service"
import {
  evaluateTradingRules,
  resolveCooldownAfterTrade,
  shouldClearStaleCooldown,
  type TradingRulesTradeRow,
} from "@/lib/trading-rules/evaluate-trading-rules"
import type { CooldownUnlockResult, TradingRulesSnapshot } from "@/lib/trading-rules/types"
import {
  buildCooldownUnlockCoachSummary,
  parseCooldownUnlockAnswers,
} from "@/lib/trading-rules/cooldown-questions"

function isMissingColumnError(message: string): boolean {
  return /column .* does not exist|schema cache|max_trades_per_week|cooldown_active|session_kind/i.test(
    message,
  )
}

function rulesFromAccount(account: TradingAccountRecord) {
  return {
    max_trades_per_week: account.max_trades_per_week ?? 2,
    loss_streak_limit: account.loss_streak_limit ?? 3,
    min_emotional_score: account.min_emotional_score ?? 7,
  }
}

function cooldownFromAccount(account: TradingAccountRecord) {
  return {
    cooldown_active: account.cooldown_active ?? false,
    cooldown_triggered_at: account.cooldown_triggered_at ?? null,
    last_coach_unlock_at: account.last_coach_unlock_at ?? null,
    last_coach_unlock_session_id: account.last_coach_unlock_session_id ?? null,
  }
}

export async function fetchAccountTradesForRules(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  legacyAccountId: string | null,
): Promise<TradingRulesTradeRow[]> {
  let query = supabase
    .from("trades")
    .select("trade_date, created_at, pnl, result, account_id")
    .eq("user_id", userId)
    .order("trade_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(120)

  query = query.or(accountScopeOrFilter(accountId, legacyAccountId))

  const { data, error } = await query
  if (error) {
    if (isMissingColumnError(error.message)) {
      const fallback = await supabase
        .from("trades")
        .select("trade_date, created_at, pnl, result")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(120)
      return (fallback.data ?? []) as TradingRulesTradeRow[]
    }
    throw new Error(error.message)
  }

  return (data ?? []) as TradingRulesTradeRow[]
}

async function clearStaleAccountCooldown(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from("accounts")
    .update({
      cooldown_active: false,
      cooldown_triggered_at: null,
      updated_at: now,
    })
    .eq("user_id", userId)
    .eq("id", accountId)

  if (error && !isMissingColumnError(error.message)) {
    throw new Error(error.message)
  }
}

export async function getTradingRulesSnapshot(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
): Promise<TradingRulesSnapshot | null> {
  const account = await getTradingAccount(supabase, userId, accountId)
  if (!account) return null

  const legacyAccountId = await resolveLegacyTradeAccountId(supabase, userId)
  const trades = await fetchAccountTradesForRules(
    supabase,
    userId,
    accountId,
    legacyAccountId,
  )

  const snapshot = evaluateTradingRules({
    accountId,
    rules: rulesFromAccount(account),
    cooldown: cooldownFromAccount(account),
    trades,
  })

  if (
    shouldClearStaleCooldown({
      snapshot,
      accountCooldownActive: account.cooldown_active ?? false,
    })
  ) {
    await clearStaleAccountCooldown(supabase, userId, accountId)
    snapshot.cooldown.cooldown_active = false
    snapshot.cooldown.cooldown_triggered_at = null
  }

  return snapshot
}

export async function syncTradingRulesCooldown(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
): Promise<TradingRulesSnapshot | null> {
  const account = await getTradingAccount(supabase, userId, accountId)
  if (!account) return null

  const legacyAccountId = await resolveLegacyTradeAccountId(supabase, userId)
  const trades = await fetchAccountTradesForRules(
    supabase,
    userId,
    accountId,
    legacyAccountId,
  )

  const rules = rulesFromAccount(account)
  const sorted = [...trades].sort((a, b) => {
    const da = a.trade_date ?? a.created_at ?? ""
    const db = b.trade_date ?? b.created_at ?? ""
    return db.localeCompare(da)
  })
  const latestTrade = sorted[0]
  if (!latestTrade) {
    return getTradingRulesSnapshot(supabase, userId, accountId)
  }

  const nextCooldown = resolveCooldownAfterTrade({
    rules,
    tradesAfterInsert: trades,
    latestTrade,
  })

  const { error } = await supabase
    .from("accounts")
    .update({
      cooldown_active: nextCooldown.cooldownActive,
      cooldown_triggered_at: nextCooldown.triggeredAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", accountId)

  if (error && !isMissingColumnError(error.message)) {
    throw new Error(error.message)
  }

  return getTradingRulesSnapshot(supabase, userId, accountId)
}

export async function submitCooldownUnlock(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  rawAnswers: {
    lossCause?: string
    changePlan?: string
    emotionalScore?: number | string
  },
): Promise<CooldownUnlockResult> {
  const account = await getTradingAccount(supabase, userId, accountId)
  if (!account) throw new Error("Account not found")

  const answers = parseCooldownUnlockAnswers(rawAnswers)
  if (!answers) {
    throw new Error("Answer all three questions with a valid emotional score (1–10).")
  }

  const minRequired = account.min_emotional_score ?? 7
  const summary = buildCooldownUnlockCoachSummary(answers)
  const now = new Date().toISOString()
  const chapterContext = await loadCoachChapterContext(supabase, userId, accountId).catch(() => null)
  const firstName = chapterContext?.traderFirstName ?? "Trader"

  const sessionPayload: Record<string, unknown> = {
    user_id: userId,
    account_id: accountId,
    status: "completed",
    session_kind: "cooldown_unlock",
    session_type: "cooldown_unlock",
    week_chapter: chapterContext?.currentChapterNumber ?? null,
    emotional_score: answers.emotionalScore,
    key_insight: answers.changePlan,
    questions_answered: {
      loss_cause: answers.lossCause,
      change_plan: answers.changePlan,
      emotional_score: answers.emotionalScore,
    },
    outcome: answers.emotionalScore >= minRequired ? "unlocked" : "soft_lock",
    planned_context: {
      cooldown_unlock: answers,
      coach_analysis: {
        summary,
        emotional_score: answers.emotionalScore,
      },
    },
    updated_at: now,
  }

  let sessionId: string | null = null

  const insertSession = await supabase
    .from("trade_coach_sessions")
    .insert(sessionPayload)
    .select("id")
    .single()

  if (insertSession.error && /session_kind|column/i.test(insertSession.error.message)) {
    const { session_kind: _kind, ...withoutKind } = sessionPayload
    const retry = await supabase
      .from("trade_coach_sessions")
      .insert(withoutKind)
      .select("id")
      .single()
    if (retry.error) throw new Error(retry.error.message)
    sessionId = retry.data?.id ? String(retry.data.id) : null
  } else if (insertSession.error) {
    throw new Error(insertSession.error.message)
  } else {
    sessionId = insertSession.data?.id ? String(insertSession.data.id) : null
  }

  if (sessionId) {
    const messages = [
      {
        session_id: sessionId,
        user_id: userId,
        role: "coach" as const,
        question_key: null,
        content: sanitizeCoachLanguage(
          "Three tough trades in a row — let's reflect before your next move.",
        ),
        step_index: 0,
      },
      {
        session_id: sessionId,
        user_id: userId,
        role: "user" as const,
        question_key: "loss_cause",
        content: answers.lossCause,
        step_index: 1,
      },
      {
        session_id: sessionId,
        user_id: userId,
        role: "user" as const,
        question_key: "change_plan",
        content: answers.changePlan,
        step_index: 2,
      },
      {
        session_id: sessionId,
        user_id: userId,
        role: "user" as const,
        question_key: "emotional_score",
        content: String(answers.emotionalScore),
        step_index: 3,
      },
      {
        session_id: sessionId,
        user_id: userId,
        role: "coach" as const,
        question_key: null,
        content: summary,
        step_index: 4,
      },
    ]

    await supabase.from("trade_coach_messages").insert(messages)
  }

  if (answers.emotionalScore < minRequired) {
    return {
      unlocked: false,
      message: buildCooldownSoftLockMessage(firstName),
      sessionId: sessionId ?? undefined,
      emotionalScore: answers.emotionalScore,
      minRequired,
    }
  }

  const { error: updateError } = await supabase
    .from("accounts")
    .update({
      cooldown_active: false,
      cooldown_triggered_at: null,
      last_coach_unlock_at: now,
      last_coach_unlock_session_id: sessionId,
      updated_at: now,
    })
    .eq("user_id", userId)
    .eq("id", accountId)

  if (updateError && !isMissingColumnError(updateError.message)) {
    throw new Error(updateError.message)
  }

  return {
    unlocked: true,
    message: buildCooldownUnlockSuccessMessage(firstName),
    sessionId: sessionId ?? undefined,
    emotionalScore: answers.emotionalScore,
    minRequired,
  }
}

export async function resolveTradingRulesForRequest(
  supabase: SupabaseClient,
  userId: string,
  request?: Request,
): Promise<{ accountId: string | null; snapshot: TradingRulesSnapshot | null }> {
  const accountId = await resolveActiveAccountId(supabase, userId, request)
  if (!accountId) return { accountId: null, snapshot: null }
  const snapshot = await getTradingRulesSnapshot(supabase, userId, accountId)
  return { accountId, snapshot }
}
