/** Columns needed for dashboard / journal list (avoids select *). */
export const DASHBOARD_TRADE_SELECT =
  "id, pair, direction, result, pnl, emotion, setup, strategy_name, risk_percent, rule_followed, user_id, trade_date, higher_timeframe, entry_timeframe, confirmation_timeframe, confirmation_signal, session, screenshot_url, entry_price, stop_loss, take_profit, risk_reward, emotion_after, mistake_tags, trade_notes, setup_score, setup_classification, setup_score_breakdown, setup_coaching_insights, import_source, created_at"

/** Cap initial load — enough for analytics; refresh still updates cache. */
export const DASHBOARD_TRADES_LIMIT = 400
