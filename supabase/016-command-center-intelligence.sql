-- Command Center Intelligence — compressed memory insights
-- Run after 015-command-center-mode-threads.sql

CREATE TABLE IF NOT EXISTS public.command_center_memory_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id uuid REFERENCES public.command_center_threads(id) ON DELETE CASCADE,
  source_message_id uuid REFERENCES public.command_center_messages(id) ON DELETE SET NULL,
  category text NOT NULL CHECK (
    category IN (
      'repeated_behavior',
      'improving_discipline',
      'dangerous_pattern',
      'best_setup_condition',
      'emotional_trigger'
    )
  ),
  insight text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS command_center_memory_insights_user_idx
  ON public.command_center_memory_insights (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS command_center_memory_insights_thread_idx
  ON public.command_center_memory_insights (thread_id, created_at DESC);

ALTER TABLE public.command_center_memory_insights ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'command_center_memory_insights'
      AND policyname = 'Users manage own command center memory insights'
  ) THEN
    CREATE POLICY "Users manage own command center memory insights"
      ON public.command_center_memory_insights FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
