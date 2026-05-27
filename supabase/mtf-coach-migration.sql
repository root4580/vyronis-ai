-- Multi-Timeframe Chart Vision for trade_coach_sessions
-- Run in Supabase → SQL Editor after chart-vision-ai-migration.sql

ALTER TABLE public.trade_coach_sessions
  ADD COLUMN IF NOT EXISTS weekly_screenshot_url text,
  ADD COLUMN IF NOT EXISTS daily_screenshot_url text,
  ADD COLUMN IF NOT EXISTS h4_screenshot_url text,
  ADD COLUMN IF NOT EXISTS h1_screenshot_url text,
  ADD COLUMN IF NOT EXISTS m15_screenshot_url text,
  ADD COLUMN IF NOT EXISTS mtf_analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS bias_alignment_score integer,
  ADD COLUMN IF NOT EXISTS entry_confirmation_score integer;

CREATE INDEX IF NOT EXISTS trade_coach_sessions_mtf_bias_idx
  ON public.trade_coach_sessions (user_id, bias_alignment_score DESC)
  WHERE bias_alignment_score IS NOT NULL;

NOTIFY pgrst, 'reload schema';
