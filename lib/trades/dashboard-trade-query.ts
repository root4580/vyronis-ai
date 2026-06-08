/** Columns needed for dashboard / journal list (avoids select *). */
export const DASHBOARD_TRADE_SELECT =
  "id, pair, direction, result, pnl, emotion, setup, strategy_name, risk_percent, rule_followed, user_id, account_id, trade_date, higher_timeframe, entry_timeframe, confirmation_timeframe, confirmation_signal, session, screenshot_url, reflection_chart_url, entry_price, stop_loss, take_profit, risk_reward, lots, opened_at, closed_at, hold_minutes, emotion_after, mistake_tags, trade_notes, thinking_before, thinking_during, thinking_after, biggest_mistake, lesson_learned, what_worked, what_didnt_work, setup_score, setup_classification, setup_score_breakdown, setup_coaching_insights, weekly_bias, daily_bias, h4_bias, aoi_type, confirmation_type, entry_quality, vyronis_evaluation, import_source, plan_id, created_at"

/** Before supabase/038-trade-reflection-chart.sql is applied. */
export const DASHBOARD_TRADE_SELECT_WITHOUT_REFLECTION = DASHBOARD_TRADE_SELECT.replace(
  ", reflection_chart_url",
  "",
)

/** Before supabase/042-trade-reflection-journal.sql is applied. */
export const DASHBOARD_TRADE_SELECT_WITHOUT_TRADE_REFLECTION = DASHBOARD_TRADE_SELECT.replace(
  ", thinking_before, thinking_during, thinking_after, biggest_mistake, lesson_learned, what_worked, what_didnt_work",
  "",
).replace(", hold_minutes", "")

/** Cap initial load — enough for analytics; refresh still updates cache. */
export const DASHBOARD_TRADES_LIMIT = 400
