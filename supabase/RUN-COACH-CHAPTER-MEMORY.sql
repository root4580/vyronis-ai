-- Paste this ENTIRE file into Supabase → SQL Editor → Run
-- (Do NOT use \i — that only works in psql CLI, not the web editor)

-- Coach chapter memory + session metadata
-- Extends trade_coach_sessions (canonical) — idempotent.

ALTER TABLE public.trade_coach_sessions
  ADD COLUMN IF NOT EXISTS week_chapter integer,
  ADD COLUMN IF NOT EXISTS session_type text,
  ADD COLUMN IF NOT EXISTS questions_answered jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS emotional_score integer,
  ADD COLUMN IF NOT EXISTS key_insight text,
  ADD COLUMN IF NOT EXISTS outcome text;

CREATE INDEX IF NOT EXISTS trade_coach_sessions_user_week_chapter_idx
  ON public.trade_coach_sessions (user_id, account_id, week_chapter DESC);

CREATE TABLE IF NOT EXISTS public.coach_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  key_lessons text[] NOT NULL DEFAULT '{}',
  milestones jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_session_at timestamptz,
  total_sessions integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS coach_memories_user_account_idx
  ON public.coach_memories (user_id, account_id);

ALTER TABLE public.coach_memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coach_memories_select_own ON public.coach_memories;
CREATE POLICY coach_memories_select_own ON public.coach_memories
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS coach_memories_insert_own ON public.coach_memories;
CREATE POLICY coach_memories_insert_own ON public.coach_memories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS coach_memories_update_own ON public.coach_memories;
CREATE POLICY coach_memories_update_own ON public.coach_memories
  FOR UPDATE USING (auth.uid() = user_id);
