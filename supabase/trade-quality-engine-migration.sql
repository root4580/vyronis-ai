-- Trade Quality Engine fields for AI Trade Coach sessions
-- Run in Supabase → SQL Editor after trade-coach-migration.sql

ALTER TABLE public.trade_coach_sessions
  ADD COLUMN IF NOT EXISTS quality_score int,
  ADD COLUMN IF NOT EXISTS quality_grade text
    CHECK (quality_grade IS NULL OR quality_grade IN ('A', 'B', 'C', 'D', 'F')),
  ADD COLUMN IF NOT EXISTS recommendation text
    CHECK (recommendation IS NULL OR recommendation IN ('TAKE', 'SKIP', 'CAUTION')),
  ADD COLUMN IF NOT EXISTS confidence_score int,
  ADD COLUMN IF NOT EXISTS score_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS strengths jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS quality_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quality_override_at timestamptz;

CREATE INDEX IF NOT EXISTS trade_coach_sessions_user_quality_idx
  ON public.trade_coach_sessions (user_id, quality_score DESC NULLS LAST);

NOTIFY pgrst, 'reload schema';
