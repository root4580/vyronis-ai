/* Outcome learning: plan vs execution vs Vyronis verdict accuracy
   Run after 021-adaptive-cognition-foundation.sql */

CREATE TABLE IF NOT EXISTS public.outcome_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_id text NOT NULL,
  pair text,
  result text,
  planned_summary text,
  execution_summary text,
  emotion text,
  vyronis_verdict_at_plan text,
  vyronis_was_right boolean,
  override_reason text,
  lesson text NOT NULL,
  natural_reference text,
  category text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, trade_id)
);

CREATE INDEX IF NOT EXISTS outcome_lessons_user_created_idx
  ON public.outcome_lessons (user_id, created_at DESC);

ALTER TABLE public.outcome_lessons ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'outcome_lessons'
      AND policyname = 'Users manage own outcome lessons'
  ) THEN
    CREATE POLICY "Users manage own outcome lessons"
      ON public.outcome_lessons FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
