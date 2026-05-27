-- Chart-first AI Trade Coach fields
-- Run in Supabase → SQL Editor after trade-coach-migration.sql
-- NOTE: chart_url is deprecated by 004-mark-deprecated-session-columns.sql (use screenshot_url).

ALTER TABLE public.trade_coach_sessions
  ADD COLUMN IF NOT EXISTS chart_url text,
  ADD COLUMN IF NOT EXISTS chart_analysis jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS trade_coach_sessions_user_chart_idx
  ON public.trade_coach_sessions (user_id, updated_at DESC)
  WHERE chart_url IS NOT NULL;

NOTIFY pgrst, 'reload schema';
