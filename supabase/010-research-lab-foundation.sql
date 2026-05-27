-- Vyronis MT5 Research Lab (Phase A) — demo CSV import only
-- Run in Supabase → SQL Editor after core trade migrations.
-- Rollback: drop new tables/columns; manual journal trades unaffected.

-- Feature flag on user settings
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS research_lab_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_settings.research_lab_enabled IS
  'When true, user can access /research-lab and import MT5 demo CSV trades.';

-- Demo-only research strategy registry
CREATE TABLE IF NOT EXISTS public.research_strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  magic_number integer,
  playbook_id uuid REFERENCES public.strategy_playbooks(id) ON DELETE SET NULL,
  account_type text NOT NULL DEFAULT 'demo'
    CHECK (account_type IN ('demo')),
  is_active boolean NOT NULL DEFAULT true,
  color text NOT NULL DEFAULT '#22d3ee',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE UNIQUE INDEX IF NOT EXISTS research_strategies_user_magic_idx
  ON public.research_strategies (user_id, magic_number)
  WHERE magic_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS research_strategies_user_active_idx
  ON public.research_strategies (user_id, is_active, updated_at DESC);

-- Import batch audit trail
CREATE TABLE IF NOT EXISTS public.research_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  research_strategy_id uuid NOT NULL REFERENCES public.research_strategies(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'mt5_csv'
    CHECK (source IN ('mt5_csv')),
  filename text,
  row_count integer NOT NULL DEFAULT 0,
  imported_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed')),
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS research_import_batches_user_created_idx
  ON public.research_import_batches (user_id, created_at DESC);

-- Extend trades for research imports (nullable — manual flow unchanged)
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS research_strategy_id uuid
    REFERENCES public.research_strategies(id) ON DELETE SET NULL;

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS import_source text NOT NULL DEFAULT 'manual';

ALTER TABLE public.trades
  DROP CONSTRAINT IF EXISTS trades_import_source_check;

ALTER TABLE public.trades
  ADD CONSTRAINT trades_import_source_check
  CHECK (import_source IN ('manual', 'mt5_csv', 'mt5_webhook'));

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS import_batch_id uuid
    REFERENCES public.research_import_batches(id) ON DELETE SET NULL;

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS external_ticket text;

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS magic_number integer;

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS broker text;

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS account_login text;

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS opened_at timestamptz;

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS lots numeric;

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS commission numeric;

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS swap numeric;

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS raw_payload jsonb;

-- Research imports must reference a strategy
ALTER TABLE public.trades
  DROP CONSTRAINT IF EXISTS trades_research_import_strategy_check;

ALTER TABLE public.trades
  ADD CONSTRAINT trades_research_import_strategy_check
  CHECK (
    import_source = 'manual'
    OR research_strategy_id IS NOT NULL
  );

-- Dedupe: same MT5 ticket cannot be imported twice per user/source
CREATE UNIQUE INDEX IF NOT EXISTS trades_user_external_ticket_import_idx
  ON public.trades (user_id, external_ticket, import_source)
  WHERE external_ticket IS NOT NULL AND import_source <> 'manual';

CREATE INDEX IF NOT EXISTS trades_user_research_strategy_closed_idx
  ON public.trades (user_id, research_strategy_id, closed_at DESC)
  WHERE research_strategy_id IS NOT NULL;

-- RLS: research_strategies
ALTER TABLE public.research_strategies ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'research_strategies'
      AND policyname = 'Users manage own research strategies'
  ) THEN
    CREATE POLICY "Users manage own research strategies"
      ON public.research_strategies FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- RLS: research_import_batches
ALTER TABLE public.research_import_batches ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'research_import_batches'
      AND policyname = 'Users manage own research import batches'
  ) THEN
    CREATE POLICY "Users manage own research import batches"
      ON public.research_import_batches FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

COMMENT ON TABLE public.research_strategies IS 'Demo-only MT5 research strategies for Vyronis Research Lab';
COMMENT ON TABLE public.research_import_batches IS 'Audit log for MT5 CSV import batches';
COMMENT ON COLUMN public.trades.import_source IS 'manual = journal; mt5_csv = research lab import';

NOTIFY pgrst, 'reload schema';
