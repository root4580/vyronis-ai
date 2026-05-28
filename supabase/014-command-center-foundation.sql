-- Vyronis AI Command Center (Phase A) — persistent companion threads
-- Run after 013-tradingview-signals.sql

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS command_center_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.user_settings.command_center_enabled IS
  'When true, floating AI Command Center is available in the dashboard.';

CREATE TABLE IF NOT EXISTS public.command_center_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Vyronis Companion',
  focus_type text NOT NULL DEFAULT 'companion'
    CHECK (focus_type IN ('companion', 'pre_trade', 'post_trade', 'weekly')),
  focus_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS command_center_companion_thread_idx
  ON public.command_center_threads (user_id)
  WHERE focus_type = 'companion';

CREATE TABLE IF NOT EXISTS public.command_center_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.command_center_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  message_type text NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'greeting', 'warning', 'card', 'analysis', 'system')),
  content text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS command_center_messages_thread_idx
  ON public.command_center_messages (thread_id, created_at ASC);

ALTER TABLE public.command_center_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.command_center_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'command_center_threads'
      AND policyname = 'Users manage own command center threads'
  ) THEN
    CREATE POLICY "Users manage own command center threads"
      ON public.command_center_threads FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'command_center_messages'
      AND policyname = 'Users manage own command center messages'
  ) THEN
    CREATE POLICY "Users manage own command center messages"
      ON public.command_center_messages FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
