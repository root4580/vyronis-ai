-- AI Trade Coach sessions, messages, and post-trade feedback
-- Run in Supabase → SQL Editor after trades-migration.sql
--
-- trade_id is uuid to match trades.id (see 001-fix-coach-trade-id-uuid.sql for existing prod repair).

CREATE TABLE IF NOT EXISTS public.trade_coach_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_id uuid REFERENCES public.trades(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'linked')),
  planned_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trade_coach_sessions_user_id_updated_at_idx
  ON public.trade_coach_sessions (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS trade_coach_sessions_trade_id_idx
  ON public.trade_coach_sessions (trade_id);

CREATE TABLE IF NOT EXISTS public.trade_coach_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.trade_coach_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('coach', 'user')),
  question_key text,
  content text NOT NULL,
  step_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trade_coach_messages_session_id_step_idx
  ON public.trade_coach_messages (session_id, step_index, created_at);

CREATE TABLE IF NOT EXISTS public.trade_coach_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.trade_coach_sessions(id) ON DELETE SET NULL,
  trade_id uuid NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  planned_vs_actual jsonb NOT NULL DEFAULT '[]'::jsonb,
  discipline_analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  coaching_summary text NOT NULL DEFAULT '',
  feedback_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  discipline_score int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trade_coach_feedback_trade_id_key UNIQUE (trade_id)
);

COMMENT ON COLUMN public.trade_coach_sessions.trade_id IS
  'uuid FK to trades.id. Required for replay and memory linkage.';

CREATE INDEX IF NOT EXISTS trade_coach_feedback_user_id_trade_id_idx
  ON public.trade_coach_feedback (user_id, trade_id);

ALTER TABLE public.trade_coach_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_coach_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_coach_feedback ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trade_coach_sessions' AND policyname = 'Users manage own coach sessions'
  ) THEN
    CREATE POLICY "Users manage own coach sessions"
      ON public.trade_coach_sessions
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trade_coach_messages' AND policyname = 'Users manage own coach messages'
  ) THEN
    CREATE POLICY "Users manage own coach messages"
      ON public.trade_coach_messages
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trade_coach_feedback' AND policyname = 'Users manage own coach feedback'
  ) THEN
    CREATE POLICY "Users manage own coach feedback"
      ON public.trade_coach_feedback
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
