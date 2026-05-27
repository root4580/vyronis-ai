-- GPT Vision visual analysis persistence for trade_coach_sessions
-- Run in Supabase → SQL Editor after mtf-coach-migration.sql

ALTER TABLE public.trade_coach_sessions
  ADD COLUMN IF NOT EXISTS visual_analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS vision_provider text,
  ADD COLUMN IF NOT EXISTS vision_analyzed_at timestamptz;

CREATE INDEX IF NOT EXISTS trade_coach_sessions_visual_analysis_idx
  ON public.trade_coach_sessions (user_id, vision_analyzed_at DESC)
  WHERE vision_analyzed_at IS NOT NULL;

NOTIFY pgrst, 'reload schema';
