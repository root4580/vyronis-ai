-- Vyronis AI weekly review reports (Phase 1 — psychology & performance)
CREATE TABLE IF NOT EXISTS public.weekly_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  week_end date NOT NULL,
  week_label text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  discipline_score integer NOT NULL DEFAULT 0,
  emotional_stability_score integer NOT NULL DEFAULT 0,
  execution_score integer NOT NULL DEFAULT 0,
  consistency_score integer NOT NULL DEFAULT 0,
  overall_score integer NOT NULL DEFAULT 0,
  recurring_mistakes jsonb NOT NULL DEFAULT '[]'::jsonb,
  emotional_patterns jsonb NOT NULL DEFAULT '[]'::jsonb,
  discipline_trends jsonb NOT NULL DEFAULT '{}'::jsonb,
  best_setup_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  behavioral_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  strongest_session text,
  weakest_habit text,
  improvement_plan jsonb NOT NULL DEFAULT '[]'::jsonb,
  insights jsonb NOT NULL DEFAULT '[]'::jsonb,
  report_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider text NOT NULL DEFAULT 'deterministic'
    CHECK (provider IN ('deterministic', 'openai', 'claude', 'gemini', 'heuristic')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.weekly_reviews
  DROP CONSTRAINT IF EXISTS weekly_reviews_user_week_key;

ALTER TABLE public.weekly_reviews
  ADD CONSTRAINT weekly_reviews_user_week_key UNIQUE (user_id, week_start);

ALTER TABLE public.weekly_reviews
  DROP CONSTRAINT IF EXISTS weekly_reviews_discipline_score_range;

ALTER TABLE public.weekly_reviews
  ADD CONSTRAINT weekly_reviews_discipline_score_range
  CHECK (discipline_score >= 0 AND discipline_score <= 100);

ALTER TABLE public.weekly_reviews
  DROP CONSTRAINT IF EXISTS weekly_reviews_emotional_stability_score_range;

ALTER TABLE public.weekly_reviews
  ADD CONSTRAINT weekly_reviews_emotional_stability_score_range
  CHECK (emotional_stability_score >= 0 AND emotional_stability_score <= 100);

ALTER TABLE public.weekly_reviews
  DROP CONSTRAINT IF EXISTS weekly_reviews_execution_score_range;

ALTER TABLE public.weekly_reviews
  ADD CONSTRAINT weekly_reviews_execution_score_range
  CHECK (execution_score >= 0 AND execution_score <= 100);

ALTER TABLE public.weekly_reviews
  DROP CONSTRAINT IF EXISTS weekly_reviews_consistency_score_range;

ALTER TABLE public.weekly_reviews
  ADD CONSTRAINT weekly_reviews_consistency_score_range
  CHECK (consistency_score >= 0 AND consistency_score <= 100);

ALTER TABLE public.weekly_reviews
  DROP CONSTRAINT IF EXISTS weekly_reviews_overall_score_range;

ALTER TABLE public.weekly_reviews
  ADD CONSTRAINT weekly_reviews_overall_score_range
  CHECK (overall_score >= 0 AND overall_score <= 100);

CREATE INDEX IF NOT EXISTS weekly_reviews_user_week_idx
  ON public.weekly_reviews (user_id, week_start DESC);

ALTER TABLE public.weekly_reviews ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'weekly_reviews'
      AND policyname = 'Users manage own weekly reviews'
  ) THEN
    CREATE POLICY "Users manage own weekly reviews"
      ON public.weekly_reviews FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

COMMENT ON TABLE public.weekly_reviews IS 'Vyronis AI weekly psychology and performance reviews';
COMMENT ON COLUMN public.weekly_reviews.report_payload IS 'Full WeeklyReviewReport JSON for Vyronis 2.0 clients';
COMMENT ON COLUMN public.weekly_reviews.provider IS 'deterministic = journal-derived; openai/claude/gemini for future LLM narratives';
