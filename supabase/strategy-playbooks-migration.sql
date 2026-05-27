-- Strategy Playbooks for AI Trade Coach chart rule matching
-- Run in Supabase → SQL Editor after trade-coach-migration.sql

CREATE TABLE IF NOT EXISTS public.strategy_playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  bias_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  entry_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  invalidation_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  confluence_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  forbidden_conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  rr_minimum numeric NOT NULL DEFAULT 2,
  example_notes jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS strategy_playbooks_user_id_updated_at_idx
  ON public.strategy_playbooks (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS strategy_playbooks_user_id_name_idx
  ON public.strategy_playbooks (user_id, strategy_name);

CREATE UNIQUE INDEX IF NOT EXISTS strategy_playbooks_user_default_idx
  ON public.strategy_playbooks (user_id)
  WHERE is_default = true;

ALTER TABLE public.strategy_playbooks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'strategy_playbooks'
      AND policyname = 'strategy_playbooks_select_own'
  ) THEN
    CREATE POLICY strategy_playbooks_select_own
      ON public.strategy_playbooks
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'strategy_playbooks'
      AND policyname = 'strategy_playbooks_insert_own'
  ) THEN
    CREATE POLICY strategy_playbooks_insert_own
      ON public.strategy_playbooks
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'strategy_playbooks'
      AND policyname = 'strategy_playbooks_update_own'
  ) THEN
    CREATE POLICY strategy_playbooks_update_own
      ON public.strategy_playbooks
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'strategy_playbooks'
      AND policyname = 'strategy_playbooks_delete_own'
  ) THEN
    CREATE POLICY strategy_playbooks_delete_own
      ON public.strategy_playbooks
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
