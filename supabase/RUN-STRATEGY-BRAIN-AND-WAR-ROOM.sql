-- Vyronis Strategy Brain + Weekly War Room (run once in Supabase SQL Editor)
-- Project: NEXT_PUBLIC_SUPABASE_URL (jjdxodqipdjfkjanjywf)

-- 026 Strategy Brain foundation

CREATE TABLE IF NOT EXISTS public.strategy_brain_market_bias (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  weekly_bias text NOT NULL DEFAULT 'Neutral'
    CHECK (weekly_bias IN ('Bullish', 'Bearish', 'Neutral')),
  daily_bias text NOT NULL DEFAULT 'Neutral'
    CHECK (daily_bias IN ('Bullish', 'Bearish', 'Neutral')),
  h4_bias text NOT NULL DEFAULT 'Neutral'
    CHECK (h4_bias IN ('Bullish', 'Bearish', 'Neutral')),
  directional_permission boolean NOT NULL DEFAULT false,
  setup_valid boolean NOT NULL DEFAULT true,
  conflict_summary text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.strategy_brain_weekly_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  session_notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS strategy_brain_weekly_plans_user_week_idx
  ON public.strategy_brain_weekly_plans (user_id, week_start DESC);

CREATE TABLE IF NOT EXISTS public.strategy_brain_pair_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.strategy_brain_weekly_plans(id) ON DELETE CASCADE,
  pair text NOT NULL,
  directional_bias text NOT NULL DEFAULT 'Neutral'
    CHECK (directional_bias IN ('Bullish', 'Bearish', 'Neutral')),
  aoi_high numeric,
  aoi_low numeric,
  invalidation numeric,
  weekly_thesis text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  aoi_status text NOT NULL DEFAULT 'WAITING'
    CHECK (aoi_status IN ('WAITING', 'INSIDE_AOI', 'CONFIRMING', 'INVALIDATED')),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS strategy_brain_pair_plans_plan_idx
  ON public.strategy_brain_pair_plans (plan_id, sort_order);

CREATE INDEX IF NOT EXISTS strategy_brain_pair_plans_user_pair_idx
  ON public.strategy_brain_pair_plans (user_id, pair);

CREATE TABLE IF NOT EXISTS public.strategy_brain_setup_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pair_plan_id uuid REFERENCES public.strategy_brain_pair_plans(id) ON DELETE SET NULL,
  pair text NOT NULL,
  trade_direction text,
  confirmation jsonb NOT NULL DEFAULT '{}'::jsonb,
  scoring jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_score int NOT NULL DEFAULT 0,
  grade text NOT NULL DEFAULT 'D',
  recommendation text NOT NULL DEFAULT 'SKIP',
  borderline_count int NOT NULL DEFAULT 0,
  memory_insight text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS strategy_brain_setup_eval_user_idx
  ON public.strategy_brain_setup_evaluations (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.strategy_brain_emotion_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pair text,
  trade_id uuid REFERENCES public.trades(id) ON DELETE SET NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  emotion_score int NOT NULL DEFAULT 0,
  emotion_stable boolean NOT NULL DEFAULT false,
  major_news_risk boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS strategy_brain_emotion_checks_user_idx
  ON public.strategy_brain_emotion_checks (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.strategy_brain_post_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_id uuid NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  review_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, trade_id)
);

CREATE INDEX IF NOT EXISTS strategy_brain_post_reviews_user_idx
  ON public.strategy_brain_post_reviews (user_id, created_at DESC);

ALTER TABLE public.strategy_brain_market_bias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategy_brain_weekly_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategy_brain_pair_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategy_brain_setup_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategy_brain_emotion_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategy_brain_post_reviews ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'strategy_brain_market_bias',
    'strategy_brain_weekly_plans',
    'strategy_brain_pair_plans',
    'strategy_brain_setup_evaluations',
    'strategy_brain_emotion_checks',
    'strategy_brain_post_reviews'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND policyname = t || '_select_own'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT USING (auth.uid() = user_id)',
        t || '_select_own', t
      );
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND policyname = t || '_insert_own'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (auth.uid() = user_id)',
        t || '_insert_own', t
      );
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND policyname = t || '_update_own'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)',
        t || '_update_own', t
      );
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND policyname = t || '_delete_own'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR DELETE USING (auth.uid() = user_id)',
        t || '_delete_own', t
      );
    END IF;
  END LOOP;
END $$;

-- 027 War Room columns

ALTER TABLE public.strategy_brain_weekly_plans
  ADD COLUMN IF NOT EXISTS session_focus text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS expected_scenarios text NOT NULL DEFAULT '';

ALTER TABLE public.strategy_brain_pair_plans
  ADD COLUMN IF NOT EXISTS screenshot_urls jsonb NOT NULL DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
