-- Base trades table + Row Level Security for Vyronis AI
-- Run in Supabase → SQL Editor BEFORE trade-fields-migration.sql

CREATE TABLE IF NOT EXISTS public.trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pair text NOT NULL,
  direction text NOT NULL,
  result text NOT NULL,
  pnl numeric NOT NULL DEFAULT 0,
  emotion text,
  setup text,
  strategy_name text,
  risk_percent numeric DEFAULT 1,
  rule_followed boolean DEFAULT true,
  trade_date date,
  higher_timeframe text,
  entry_timeframe text,
  confirmation_timeframe text,
  confirmation_signal text,
  session text,
  screenshot_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trades_user_id_created_at_idx
  ON public.trades (user_id, created_at DESC);

ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trades' AND policyname = 'Users can view own trades'
  ) THEN
    CREATE POLICY "Users can view own trades"
      ON public.trades FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trades' AND policyname = 'Users can insert own trades'
  ) THEN
    CREATE POLICY "Users can insert own trades"
      ON public.trades FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trades' AND policyname = 'Users can update own trades'
  ) THEN
    CREATE POLICY "Users can update own trades"
      ON public.trades FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trades' AND policyname = 'Users can delete own trades'
  ) THEN
    CREATE POLICY "Users can delete own trades"
      ON public.trades FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
