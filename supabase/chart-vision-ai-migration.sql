-- Chart Vision AI fields for trade_coach_sessions
-- Run in Supabase → SQL Editor after chart-first-coach-migration.sql

ALTER TABLE public.trade_coach_sessions
  ADD COLUMN IF NOT EXISTS screenshot_url text,
  ADD COLUMN IF NOT EXISTS vision_score integer;

-- Keep screenshot_url in sync with legacy chart_url
UPDATE public.trade_coach_sessions
SET screenshot_url = chart_url
WHERE screenshot_url IS NULL AND chart_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS trade_coach_sessions_user_screenshot_idx
  ON public.trade_coach_sessions (user_id, updated_at DESC)
  WHERE screenshot_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS trade_coach_sessions_vision_score_idx
  ON public.trade_coach_sessions (user_id, vision_score DESC)
  WHERE vision_score IS NOT NULL;

NOTIFY pgrst, 'reload schema';
