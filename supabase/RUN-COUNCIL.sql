-- Vyronis AI Trading Council (Phase 1 — text)
-- Run once in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.council_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  session_date date NOT NULL,
  agents_spoken text[] NOT NULL DEFAULT '{}',
  full_transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
  key_insights text[] NOT NULL DEFAULT '{}',
  briefing_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS council_sessions_user_account_date_idx
  ON public.council_sessions (user_id, account_id, session_date);

CREATE TABLE IF NOT EXISTS public.agent_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_name text NOT NULL,
  last_10_conversations jsonb NOT NULL DEFAULT '[]'::jsonb,
  key_patterns_detected text[] NOT NULL DEFAULT '{}',
  last_session_date date,
  total_sessions integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, agent_name)
);

CREATE TABLE IF NOT EXISTS public.council_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  sarah_voice_id text,
  adam_voice_id text,
  scott_voice_id text,
  hamza_voice_id text,
  khalid_voice_id text,
  auto_briefing_enabled boolean NOT NULL DEFAULT true,
  briefing_time text NOT NULL DEFAULT 'on_login',
  language_preference text NOT NULL DEFAULT 'en',
  last_briefing_date date,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.council_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.council_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS council_sessions_select_own ON public.council_sessions;
CREATE POLICY council_sessions_select_own ON public.council_sessions
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS council_sessions_insert_own ON public.council_sessions;
CREATE POLICY council_sessions_insert_own ON public.council_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS council_sessions_update_own ON public.council_sessions;
CREATE POLICY council_sessions_update_own ON public.council_sessions
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS agent_memories_select_own ON public.agent_memories;
CREATE POLICY agent_memories_select_own ON public.agent_memories
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS agent_memories_insert_own ON public.agent_memories;
CREATE POLICY agent_memories_insert_own ON public.agent_memories
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS agent_memories_update_own ON public.agent_memories;
CREATE POLICY agent_memories_update_own ON public.agent_memories
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS council_settings_select_own ON public.council_settings;
CREATE POLICY council_settings_select_own ON public.council_settings
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS council_settings_insert_own ON public.council_settings;
CREATE POLICY council_settings_insert_own ON public.council_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS council_settings_update_own ON public.council_settings;
CREATE POLICY council_settings_update_own ON public.council_settings
  FOR UPDATE USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
