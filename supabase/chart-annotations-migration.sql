-- Chart annotation overlays for GPT Vision MTF analysis
-- Run in Supabase → SQL Editor after visual-analysis-migration.sql

ALTER TABLE public.trade_coach_sessions
  ADD COLUMN IF NOT EXISTS chart_annotations jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS trade_coach_sessions_chart_annotations_idx
  ON public.trade_coach_sessions (user_id, updated_at DESC)
  WHERE chart_annotations <> '{}'::jsonb;

NOTIFY pgrst, 'reload schema';
