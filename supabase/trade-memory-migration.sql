-- Trade Memory + Learning Engine
-- Run in Supabase → SQL Editor after trades-migration.sql and trade-coach-migration.sql

CREATE TABLE IF NOT EXISTS public.trade_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_id uuid NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.trade_coach_sessions(id) ON DELETE SET NULL,
  pair text NOT NULL DEFAULT '',
  direction text NOT NULL DEFAULT '',
  timeframe text,
  setup_type text,
  result text NOT NULL DEFAULT '',
  rr_achieved numeric,
  emotion_before text,
  emotion_after text,
  mistakes jsonb NOT NULL DEFAULT '[]'::jsonb,
  screenshot_url text,
  ai_verdict text,
  ai_summary text NOT NULL DEFAULT '',
  coaching_feedback jsonb NOT NULL DEFAULT '{}'::jsonb,
  htf_alignment_score int,
  session text,
  strategy_name text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trade_memory_trade_id_key UNIQUE (trade_id)
);

CREATE INDEX IF NOT EXISTS trade_memory_user_id_updated_at_idx
  ON public.trade_memory (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS trade_memory_user_id_pair_idx
  ON public.trade_memory (user_id, pair);

CREATE INDEX IF NOT EXISTS trade_memory_session_id_idx
  ON public.trade_memory (session_id)
  WHERE session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.emotional_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern_key text NOT NULL,
  label text NOT NULL,
  category text NOT NULL DEFAULT 'emotion',
  severity text NOT NULL DEFAULT 'warning'
    CHECK (severity IN ('warning', 'insight', 'positive')),
  occurrence_count int NOT NULL DEFAULT 0,
  loss_count int NOT NULL DEFAULT 0,
  win_count int NOT NULL DEFAULT 0,
  trend text NOT NULL DEFAULT 'stable'
    CHECK (trend IN ('increasing', 'stable', 'decreasing')),
  last_seen_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT emotional_patterns_user_pattern_key UNIQUE (user_id, pattern_key)
);

CREATE INDEX IF NOT EXISTS emotional_patterns_user_id_count_idx
  ON public.emotional_patterns (user_id, occurrence_count DESC);

CREATE TABLE IF NOT EXISTS public.ai_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  review_type text NOT NULL DEFAULT 'weekly'
    CHECK (review_type IN ('weekly', 'trade', 'monthly')),
  week_start date,
  week_end date,
  summary text NOT NULL DEFAULT '',
  recurring_mistakes jsonb NOT NULL DEFAULT '[]'::jsonb,
  emotional_trends jsonb NOT NULL DEFAULT '[]'::jsonb,
  discipline_score int NOT NULL DEFAULT 0,
  most_profitable_setup text,
  advice jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_reviews_user_id_week_idx
  ON public.ai_reviews (user_id, week_start DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_reviews_user_week_key'
  ) THEN
    ALTER TABLE public.ai_reviews
      ADD CONSTRAINT ai_reviews_user_week_key UNIQUE (user_id, review_type, week_start);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.setup_statistics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  setup_type text NOT NULL,
  trade_count int NOT NULL DEFAULT 0,
  win_count int NOT NULL DEFAULT 0,
  loss_count int NOT NULL DEFAULT 0,
  breakeven_count int NOT NULL DEFAULT 0,
  win_rate numeric NOT NULL DEFAULT 0,
  total_pnl numeric NOT NULL DEFAULT 0,
  avg_rr numeric,
  best_session text,
  best_emotion text,
  htf_alignment_accuracy numeric NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT setup_statistics_user_setup_key UNIQUE (user_id, setup_type)
);

CREATE INDEX IF NOT EXISTS setup_statistics_user_win_rate_idx
  ON public.setup_statistics (user_id, win_rate DESC);

ALTER TABLE public.trade_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emotional_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setup_statistics ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trade_memory' AND policyname = 'Users manage own trade memory'
  ) THEN
    CREATE POLICY "Users manage own trade memory"
      ON public.trade_memory FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'emotional_patterns' AND policyname = 'Users manage own emotional patterns'
  ) THEN
    CREATE POLICY "Users manage own emotional patterns"
      ON public.emotional_patterns FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ai_reviews' AND policyname = 'Users manage own ai reviews'
  ) THEN
    CREATE POLICY "Users manage own ai reviews"
      ON public.ai_reviews FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'setup_statistics' AND policyname = 'Users manage own setup statistics'
  ) THEN
    CREATE POLICY "Users manage own setup statistics"
      ON public.setup_statistics FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
