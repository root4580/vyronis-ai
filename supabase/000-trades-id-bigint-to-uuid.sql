-- =============================================================================
-- 000-trades-id-bigint-to-uuid.sql
-- Vyronis AI — Repair migration 0 (run BEFORE 001–004)
-- =============================================================================
--
-- PURPOSE
--   Convert trades.id from bigint → uuid while preserving all trade rows.
--   Builds a permanent bigint→uuid mapping and realigns coach FK columns.
--
-- TARGET PROD STATE (verified pre-flight)
--   trades.id                         = bigint  (2 rows)
--   trade_coach_sessions.trade_id     = bigint
--   trade_coach_feedback.trade_id     = bigint
--   trade_memory.trade_id             = uuid    (0 rows)
--
-- RUN BEFORE
--   001-fix-coach-trade-id-uuid.sql
--
-- DOES NOT
--   DELETE rows, DROP tables, or DROP legacy columns (legacy ids preserved)
--
-- ROLLBACK (manual — restore from Supabase backup if needed)
--   This migration renames/swaps PK columns. Automatic rollback is not safe.
--   Mapping table public.trade_id_migration_map retains legacy_bigint_id → uuid_id.
--   To rollback manually you must restore a pre-000 pg_dump.
--
-- SAFE TO RE-RUN: Partially (skips entirely if trades.id is already uuid)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0) Abort early if already migrated
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_trades_id_type text;
BEGIN
  SELECT data_type
  INTO v_trades_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'trades'
    AND column_name = 'id';

  IF v_trades_id_type IS NULL THEN
    RAISE EXCEPTION '000: public.trades.id not found — run base migrations first';
  END IF;

  IF v_trades_id_type = 'uuid' THEN
    RAISE NOTICE '000: trades.id is already uuid — nothing to do';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1) Persistent mapping table (audit + re-link reference)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trade_id_migration_map (
  legacy_bigint_id bigint PRIMARY KEY,
  uuid_id uuid NOT NULL UNIQUE,
  migrated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.trade_id_migration_map IS
  'PRESERVED (000): Maps original trades.id bigint values to new uuid PK values.';

-- ---------------------------------------------------------------------------
-- 2) Populate mapping for every existing trade (stable on re-run)
-- ---------------------------------------------------------------------------
INSERT INTO public.trade_id_migration_map (legacy_bigint_id, uuid_id)
SELECT t.id, gen_random_uuid()
FROM public.trades AS t
WHERE EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'trades'
    AND column_name = 'id'
    AND data_type IN ('bigint', 'integer', 'smallint')
)
ON CONFLICT (legacy_bigint_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3) Stage new uuid PK column on trades (bigint path only)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trades'
      AND column_name = 'id'
      AND data_type IN ('bigint', 'integer', 'smallint')
  ) THEN
    ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS id_new uuid;
  END IF;
END $$;

UPDATE public.trades AS t
SET id_new = m.uuid_id
FROM public.trade_id_migration_map AS m
WHERE m.legacy_bigint_id = t.id
  AND t.id_new IS NULL
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trades'
      AND column_name = 'id_new'
  );

DO $$
DECLARE
  v_unmapped integer;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trades'
      AND column_name = 'id'
      AND data_type IN ('bigint', 'integer', 'smallint')
  ) THEN
    SELECT count(*) INTO v_unmapped
    FROM public.trades
    WHERE id_new IS NULL;

    IF v_unmapped > 0 THEN
      RAISE EXCEPTION '000: % trade row(s) missing id_new — check trade_id_migration_map', v_unmapped;
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4) Stage uuid FK columns on coach tables (keep bigint until swap)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trade_coach_sessions'
      AND column_name = 'trade_id'
      AND data_type IN ('bigint', 'integer', 'smallint')
  ) THEN
    ALTER TABLE public.trade_coach_sessions ADD COLUMN IF NOT EXISTS trade_id_uuid uuid;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trade_coach_feedback'
      AND column_name = 'trade_id'
      AND data_type IN ('bigint', 'integer', 'smallint')
  ) THEN
    ALTER TABLE public.trade_coach_feedback ADD COLUMN IF NOT EXISTS trade_id_uuid uuid;
  END IF;
END $$;

UPDATE public.trade_coach_sessions AS s
SET trade_id_uuid = m.uuid_id
FROM public.trade_id_migration_map AS m
WHERE s.trade_id IS NOT NULL
  AND s.trade_id = m.legacy_bigint_id
  AND s.trade_id_uuid IS NULL
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trade_coach_sessions'
      AND column_name = 'trade_id_uuid'
  );

UPDATE public.trade_coach_feedback AS f
SET trade_id_uuid = m.uuid_id
FROM public.trade_id_migration_map AS m
WHERE f.trade_id IS NOT NULL
  AND f.trade_id = m.legacy_bigint_id
  AND f.trade_id_uuid IS NULL
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trade_coach_feedback'
      AND column_name = 'trade_id_uuid'
  );

-- trade_memory already uuid (0 rows in prod) — backfill only if bigint legacy existed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trade_memory'
      AND column_name = 'trade_id'
      AND data_type IN ('bigint', 'integer', 'smallint')
  ) THEN
    ALTER TABLE public.trade_memory
      ADD COLUMN IF NOT EXISTS trade_id_uuid uuid;

    UPDATE public.trade_memory AS tm
    SET trade_id_uuid = m.uuid_id
    FROM public.trade_id_migration_map AS m
    WHERE tm.trade_id = m.legacy_bigint_id
      AND tm.trade_id_uuid IS NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5) Drop FK constraints blocking PK swap
-- ---------------------------------------------------------------------------
ALTER TABLE public.trade_coach_sessions
  DROP CONSTRAINT IF EXISTS trade_coach_sessions_trade_id_fkey;

ALTER TABLE public.trade_coach_feedback
  DROP CONSTRAINT IF EXISTS trade_coach_feedback_trade_id_fkey;

ALTER TABLE public.trade_memory
  DROP CONSTRAINT IF EXISTS trade_memory_trade_id_fkey;

-- ---------------------------------------------------------------------------
-- 6) Swap trades PK: bigint id → uuid id (preserve legacy bigint column)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_trades_id_type text;
  v_pk_name text;
BEGIN
  SELECT data_type
  INTO v_trades_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'trades'
    AND column_name = 'id';

  IF v_trades_id_type IS NULL OR v_trades_id_type = 'uuid' THEN
    RETURN;
  END IF;

  SELECT c.conname
  INTO v_pk_name
  FROM pg_constraint AS c
  JOIN pg_class AS rel ON rel.oid = c.conrelid
  JOIN pg_namespace AS nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'trades'
    AND c.contype = 'p'
  LIMIT 1;

  IF v_pk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.trades DROP CONSTRAINT %I', v_pk_name);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trades'
      AND column_name = 'legacy_bigint_id'
  ) THEN
    ALTER TABLE public.trades RENAME COLUMN id TO legacy_bigint_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trades'
      AND column_name = 'id_new'
  ) THEN
    ALTER TABLE public.trades RENAME COLUMN id_new TO id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'trades_pkey'
      AND conrelid = 'public.trades'::regclass
  ) THEN
    ALTER TABLE public.trades ADD CONSTRAINT trades_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trades_legacy_bigint_id_key'
  ) THEN
    ALTER TABLE public.trades
      ADD CONSTRAINT trades_legacy_bigint_id_key UNIQUE (legacy_bigint_id);
  END IF;

  ALTER TABLE public.trades
    ALTER COLUMN id SET DEFAULT gen_random_uuid();
END $$;

COMMENT ON COLUMN public.trades.legacy_bigint_id IS
  'PRESERVED (000): Original bigint primary key before uuid migration.';

COMMENT ON COLUMN public.trades.id IS
  'CANONICAL (000): uuid primary key with DEFAULT gen_random_uuid().';

-- ---------------------------------------------------------------------------
-- 7) Swap coach trade_id columns to uuid (drop bigint, rename staged uuid)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trade_coach_sessions'
      AND column_name = 'trade_id'
      AND data_type IN ('bigint', 'integer', 'smallint')
  ) THEN
    ALTER TABLE public.trade_coach_sessions DROP COLUMN trade_id;
    ALTER TABLE public.trade_coach_sessions RENAME COLUMN trade_id_uuid TO trade_id;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trade_coach_sessions'
      AND column_name = 'trade_id_uuid'
  ) THEN
    ALTER TABLE public.trade_coach_sessions RENAME COLUMN trade_id_uuid TO trade_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trade_coach_feedback'
      AND column_name = 'trade_id'
      AND data_type IN ('bigint', 'integer', 'smallint')
  ) THEN
    ALTER TABLE public.trade_coach_feedback DROP COLUMN trade_id;
    ALTER TABLE public.trade_coach_feedback RENAME COLUMN trade_id_uuid TO trade_id;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trade_coach_feedback'
      AND column_name = 'trade_id_uuid'
  ) THEN
    ALTER TABLE public.trade_coach_feedback RENAME COLUMN trade_id_uuid TO trade_id;
  END IF;
END $$;

-- trade_memory: only swap if we staged trade_id_uuid (bigint legacy path)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trade_memory'
      AND column_name = 'trade_id_uuid'
  ) THEN
    ALTER TABLE public.trade_memory DROP COLUMN IF EXISTS trade_id;
    ALTER TABLE public.trade_memory RENAME COLUMN trade_id_uuid TO trade_id;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 8) Recreate uuid FK constraints (coach only — memory FK deferred to 002)
-- ---------------------------------------------------------------------------
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

-- Restore NOT NULL + uniqueness on feedback.trade_id when fully populated
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.trade_coach_feedback WHERE trade_id IS NULL
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trade_coach_feedback'
      AND column_name = 'trade_id'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.trade_coach_feedback
      ALTER COLUMN trade_id SET NOT NULL;
  END IF;
END $$;

ALTER TABLE public.trade_coach_feedback
  DROP CONSTRAINT IF EXISTS trade_coach_feedback_trade_id_key;

DROP INDEX IF EXISTS public.trade_coach_feedback_trade_id_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.trade_coach_feedback'::regclass
      AND conname = 'trade_coach_feedback_trade_id_key'
  ) THEN
    ALTER TABLE public.trade_coach_feedback
      ADD CONSTRAINT trade_coach_feedback_trade_id_key UNIQUE (trade_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS trade_coach_sessions_trade_id_idx
  ON public.trade_coach_sessions (trade_id);

CREATE INDEX IF NOT EXISTS trade_coach_feedback_user_id_trade_id_idx
  ON public.trade_coach_feedback (user_id, trade_id);

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- VERIFICATION (SELECT ONLY — run after 000 completes)
-- =============================================================================

-- V1: trades.id must be uuid; legacy bigint preserved
SELECT
  'V1_trades_columns' AS check_group,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'trades'
  AND column_name IN ('id', 'legacy_bigint_id')
ORDER BY column_name;

-- V2: all trade_id columns should now be uuid
SELECT
  'V2_trade_id_types' AS check_group,
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'trade_id'
  AND table_name IN ('trade_coach_sessions', 'trade_coach_feedback', 'trade_memory')
ORDER BY table_name;

-- V3: mapping table row count must equal trades row count
SELECT
  'V3_mapping_vs_trades' AS check_group,
  (SELECT count(*) FROM public.trades) AS trades_count,
  (SELECT count(*) FROM public.trade_id_migration_map) AS map_count,
  CASE
    WHEN (SELECT count(*) FROM public.trades)
       = (SELECT count(*) FROM public.trade_id_migration_map)
    THEN 'OK'
    ELSE 'MISMATCH'
  END AS status;

-- V4: every trade has legacy + uuid mapping
SELECT
  'V4_trade_mapping' AS check_group,
  t.id AS uuid_id,
  t.legacy_bigint_id,
  m.uuid_id AS map_uuid_id,
  t.pair,
  t.direction,
  t.result,
  CASE
    WHEN t.id = m.uuid_id AND t.legacy_bigint_id = m.legacy_bigint_id THEN 'OK'
    ELSE 'MISMATCH'
  END AS status
FROM public.trades AS t
LEFT JOIN public.trade_id_migration_map AS m
  ON m.legacy_bigint_id = t.legacy_bigint_id
ORDER BY t.legacy_bigint_id;

-- V5: coach links resolve to trades (should return 0 orphan rows)
SELECT
  'V5_orphan_coach_feedback' AS check_group,
  count(*) AS orphan_count
FROM public.trade_coach_feedback AS f
WHERE f.trade_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.trades AS t WHERE t.id = f.trade_id);

SELECT
  'V5_orphan_coach_sessions' AS check_group,
  count(*) AS orphan_count
FROM public.trade_coach_sessions AS s
WHERE s.trade_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.trades AS t WHERE t.id = s.trade_id);

-- V6: coach uuid trade_id must match mapping from legacy bigint
SELECT
  'V6_coach_mapping_integrity' AS check_group,
  s.id AS session_id,
  s.trade_id AS session_trade_uuid,
  m.uuid_id AS expected_uuid,
  m.legacy_bigint_id AS legacy_bigint
FROM public.trade_coach_sessions AS s
JOIN public.trade_id_migration_map AS m ON m.uuid_id = s.trade_id
WHERE s.trade_id IS NOT NULL;

SELECT
  'V6_coach_mapping_integrity' AS check_group,
  f.id AS feedback_id,
  f.trade_id AS feedback_trade_uuid,
  m.uuid_id AS expected_uuid,
  m.legacy_bigint_id AS legacy_bigint
FROM public.trade_coach_feedback AS f
JOIN public.trade_id_migration_map AS m ON m.uuid_id = f.trade_id
WHERE f.trade_id IS NOT NULL;

-- V7: FK constraints present
SELECT
  'V7_foreign_keys' AS check_group,
  conname,
  conrelid::regclass AS table_name,
  confrelid::regclass AS references_table
FROM pg_constraint
WHERE conname IN (
  'trade_coach_sessions_trade_id_fkey',
  'trade_coach_feedback_trade_id_fkey',
  'trades_pkey',
  'trades_legacy_bigint_id_key'
)
ORDER BY conname;

-- V8: one-line pass/fail summary
SELECT
  'V8_summary' AS check_group,
  CASE
    WHEN (SELECT data_type FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'trades' AND column_name = 'id') <> 'uuid'
    THEN 'FAIL: trades.id is not uuid'
    WHEN (SELECT count(*) FROM public.trades)
       <> (SELECT count(*) FROM public.trade_id_migration_map)
    THEN 'FAIL: mapping count mismatch'
    WHEN EXISTS (
      SELECT 1 FROM public.trade_coach_feedback f
      WHERE f.trade_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.trades t WHERE t.id = f.trade_id)
    )
    THEN 'FAIL: orphan coach feedback'
    WHEN EXISTS (
      SELECT 1 FROM public.trade_coach_sessions s
      WHERE s.trade_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.trades t WHERE t.id = s.trade_id)
    )
    THEN 'FAIL: orphan coach sessions'
    ELSE 'PASS: ready for 001'
  END AS migration_status;
