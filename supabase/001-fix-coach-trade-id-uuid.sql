-- =============================================================================
-- 001-fix-coach-trade-id-uuid.sql
-- Vyronis AI — Repair migration 1 of 4 (FINAL production-safe)
-- =============================================================================
--
-- PURPOSE
--   Align coach trade_id columns with uuid trades.id, restore FKs, and restore
--   UNIQUE(trade_id) on trade_coach_feedback for Supabase upsert onConflict.
--
-- RUN AFTER
--   000-trades-id-bigint-to-uuid.sql (if legacy bigint trades.id existed)
--   OR base trade-coach-migration.sql on greenfield uuid trades.id
--
-- RUN BEFORE
--   002-trade-integrity.sql
--
-- IDEMPOTENT: Safe to run multiple times.
--
-- ROLLBACK (manual — restore from backup; cannot safely reverse uuid mapping)
--   ALTER TABLE trade_coach_feedback DROP CONSTRAINT trade_coach_feedback_trade_id_key;
--   ALTER TABLE trade_coach_sessions DROP CONSTRAINT trade_coach_sessions_trade_id_fkey;
--   ALTER TABLE trade_coach_feedback DROP CONSTRAINT trade_coach_feedback_trade_id_fkey;
-- =============================================================================

-- ---------------------------------------------------------------------------
-- A) Drop FKs before type/integrity repairs
-- ---------------------------------------------------------------------------
ALTER TABLE public.trade_coach_sessions
  DROP CONSTRAINT IF EXISTS trade_coach_sessions_trade_id_fkey;

ALTER TABLE public.trade_coach_feedback
  DROP CONSTRAINT IF EXISTS trade_coach_feedback_trade_id_fkey;

-- ---------------------------------------------------------------------------
-- B) Convert coach trade_id → uuid when still bigint/text (skip if already uuid)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_type text;
BEGIN
  SELECT data_type INTO v_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'trade_coach_sessions'
    AND column_name = 'trade_id';

  IF v_type IS NULL THEN
    ALTER TABLE public.trade_coach_sessions ADD COLUMN trade_id uuid;
    RETURN;
  END IF;

  IF v_type = 'uuid' THEN
    RETURN;
  END IF;

  IF v_type IN ('bigint', 'integer', 'smallint') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'trade_coach_sessions'
        AND column_name = 'trade_id_legacy_bigint'
    ) THEN
      ALTER TABLE public.trade_coach_sessions
        RENAME COLUMN trade_id TO trade_id_legacy_bigint;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'trade_coach_sessions'
        AND column_name = 'trade_id'
    ) THEN
      ALTER TABLE public.trade_coach_sessions ADD COLUMN trade_id uuid;
    END IF;

    COMMENT ON COLUMN public.trade_coach_sessions.trade_id_legacy_bigint IS
      'PRESERVED (001): legacy bigint trade_id. Use trade_id uuid.';
    RETURN;
  END IF;

  IF v_type IN ('text', 'character varying') THEN
    ALTER TABLE public.trade_coach_sessions
      ALTER COLUMN trade_id TYPE uuid
      USING NULLIF(btrim(trade_id::text), '')::uuid;
  END IF;
END $$;

DO $$
DECLARE
  v_type text;
BEGIN
  SELECT data_type INTO v_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'trade_coach_feedback'
    AND column_name = 'trade_id';

  IF v_type IS NULL THEN
    ALTER TABLE public.trade_coach_feedback ADD COLUMN trade_id uuid;
    RETURN;
  END IF;

  IF v_type = 'uuid' THEN
    RETURN;
  END IF;

  IF v_type IN ('bigint', 'integer', 'smallint') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'trade_coach_feedback'
        AND column_name = 'trade_id_legacy_bigint'
    ) THEN
      ALTER TABLE public.trade_coach_feedback
        RENAME COLUMN trade_id TO trade_id_legacy_bigint;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'trade_coach_feedback'
        AND column_name = 'trade_id'
    ) THEN
      ALTER TABLE public.trade_coach_feedback ADD COLUMN trade_id uuid;
    END IF;

    COMMENT ON COLUMN public.trade_coach_feedback.trade_id_legacy_bigint IS
      'PRESERVED (001): legacy bigint trade_id. Use trade_id uuid.';
    RETURN;
  END IF;

  IF v_type IN ('text', 'character varying') THEN
    ALTER TABLE public.trade_coach_feedback
      ALTER COLUMN trade_id TYPE uuid
      USING NULLIF(btrim(trade_id::text), '')::uuid;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- C) Backfill uuid links (only fills NULL trade_id; never overwrites existing)
-- ---------------------------------------------------------------------------
UPDATE public.trade_coach_feedback AS f
SET trade_id = s.trade_id
FROM public.trade_coach_sessions AS s
WHERE f.session_id = s.id
  AND f.trade_id IS NULL
  AND s.trade_id IS NOT NULL;

UPDATE public.trade_coach_sessions AS s
SET trade_id = f.trade_id
FROM public.trade_coach_feedback AS f
WHERE f.session_id = s.id
  AND s.trade_id IS NULL
  AND f.trade_id IS NOT NULL;

UPDATE public.trade_coach_feedback AS f
SET trade_id = tm.trade_id
FROM public.trade_memory AS tm
WHERE f.trade_id IS NULL
  AND tm.user_id = f.user_id
  AND tm.trade_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.trades AS t
    WHERE t.id = tm.trade_id AND t.user_id = f.user_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.trade_coach_feedback AS existing
    WHERE existing.trade_id = tm.trade_id AND existing.id <> f.id
  );

UPDATE public.trade_coach_sessions AS s
SET trade_id = tm.trade_id
FROM public.trade_memory AS tm
WHERE s.trade_id IS NULL
  AND tm.user_id = s.user_id
  AND tm.trade_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.trades AS t
    WHERE t.id = tm.trade_id AND t.user_id = s.user_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.trade_coach_sessions AS existing
    WHERE existing.trade_id = tm.trade_id AND existing.id <> s.id
  );

-- Backfill from 000 mapping table when legacy bigint columns exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'trade_id_migration_map'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'trade_coach_feedback'
        AND column_name = 'trade_id_legacy_bigint'
    ) THEN
      UPDATE public.trade_coach_feedback AS f
      SET trade_id = m.uuid_id
      FROM public.trade_id_migration_map AS m
      WHERE f.trade_id IS NULL
        AND f.trade_id_legacy_bigint = m.legacy_bigint_id;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'trade_coach_sessions'
        AND column_name = 'trade_id_legacy_bigint'
    ) THEN
      UPDATE public.trade_coach_sessions AS s
      SET trade_id = m.uuid_id
      FROM public.trade_id_migration_map AS m
      WHERE s.trade_id IS NULL
        AND s.trade_id_legacy_bigint = m.legacy_bigint_id;
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- D) Safe cleanup before constraints (preserve valid linked rows)
-- ---------------------------------------------------------------------------

-- Remove feedback rows that cannot link to a trade (true orphans).
DELETE FROM public.trade_coach_feedback AS f
WHERE f.trade_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.trades AS t WHERE t.id = f.trade_id
  );

-- Remove unlinkable NULL feedback (coach upsert always requires trade_id).
DELETE FROM public.trade_coach_feedback
WHERE trade_id IS NULL;

-- Unlink sessions pointing at deleted trades (sessions FK uses ON DELETE SET NULL).
UPDATE public.trade_coach_sessions AS s
SET trade_id = NULL
WHERE s.trade_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.trades AS t WHERE t.id = s.trade_id
  );

-- Keep newest coach review per trade before UNIQUE(trade_id).
DELETE FROM public.trade_coach_feedback AS f
USING (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY trade_id
        ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
      ) AS row_num
    FROM public.trade_coach_feedback
    WHERE trade_id IS NOT NULL
  ) AS ranked
  WHERE row_num > 1
) AS duplicates
WHERE f.id = duplicates.id;

-- ---------------------------------------------------------------------------
-- E) Indexes + FK constraints (uuid → trades.id uuid)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS trade_coach_sessions_trade_id_idx
  ON public.trade_coach_sessions (trade_id);

CREATE INDEX IF NOT EXISTS trade_coach_feedback_user_id_trade_id_idx
  ON public.trade_coach_feedback (user_id, trade_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trade_coach_sessions_trade_id_fkey'
  ) THEN
    ALTER TABLE public.trade_coach_sessions
      ADD CONSTRAINT trade_coach_sessions_trade_id_fkey
      FOREIGN KEY (trade_id) REFERENCES public.trades(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trade_coach_feedback_trade_id_fkey'
  ) THEN
    ALTER TABLE public.trade_coach_feedback
      ADD CONSTRAINT trade_coach_feedback_trade_id_fkey
      FOREIGN KEY (trade_id) REFERENCES public.trades(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- F) Restore UNIQUE(trade_id) for Supabase upsert onConflict (not partial index)
-- ---------------------------------------------------------------------------
ALTER TABLE public.trade_coach_feedback
  DROP CONSTRAINT IF EXISTS trade_coach_feedback_trade_id_key;

DROP INDEX IF EXISTS public.trade_coach_feedback_trade_id_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.trade_coach_feedback'::regclass
      AND conname = 'trade_coach_feedback_trade_id_key'
      AND contype = 'u'
  ) THEN
    ALTER TABLE public.trade_coach_feedback
      ADD CONSTRAINT trade_coach_feedback_trade_id_key UNIQUE (trade_id);
  END IF;
END $$;

ALTER TABLE public.trade_coach_feedback
  ALTER COLUMN trade_id SET NOT NULL;

COMMENT ON CONSTRAINT trade_coach_feedback_trade_id_key ON public.trade_coach_feedback IS
  'One coach review per trade. Required for upsert onConflict(trade_id).';

-- ---------------------------------------------------------------------------
-- G) Audit view (linked sessions missing trade_id only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.vyronis_trade_id_migration_gaps AS
SELECT
  'trade_coach_sessions'::text AS source_table,
  s.id AS row_id,
  s.user_id,
  s.id AS session_id,
  s.trade_id
FROM public.trade_coach_sessions AS s
WHERE s.trade_id IS NULL
  AND s.status = 'linked';

COMMENT ON VIEW public.vyronis_trade_id_migration_gaps IS
  'Linked coach sessions still missing trade_id after 001 repair.';

NOTIFY pgrst, 'reload schema';
