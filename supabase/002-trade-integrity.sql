-- =============================================================================
-- 002-trade-integrity.sql
-- Vyronis AI — Repair migration 2 of 4
-- =============================================================================
--
-- PURPOSE
--   Add trade_memory FKs, session linkage, enum normalization on trades,
--   and orphan cleanup for referential integrity.
--
-- RUN AFTER
--   001-fix-coach-trade-id-uuid.sql
--
-- RUN BEFORE
--   003-session-json-consolidation.sql
--
-- ROLLBACK (manual — only before 003)
--   ALTER TABLE public.trade_memory DROP CONSTRAINT IF EXISTS trade_memory_trade_id_fkey;
--   ALTER TABLE public.trade_memory DROP CONSTRAINT IF EXISTS trade_memory_session_id_fkey;
--   ALTER TABLE public.trade_memory DROP COLUMN IF EXISTS session_id;
--   ALTER TABLE public.trades DROP CONSTRAINT IF EXISTS trades_direction_check;
--   ALTER TABLE public.trades DROP CONSTRAINT IF EXISTS trades_result_check;
--   DROP INDEX IF EXISTS trade_memory_session_id_idx;
--
-- SAFE TO RE-RUN: Yes
-- =============================================================================

-- ---------------------------------------------------------------------------
-- trade_memory.session_id + FK to trades + FK to sessions
-- ---------------------------------------------------------------------------
ALTER TABLE public.trade_memory
  ADD COLUMN IF NOT EXISTS session_id uuid;

-- Backfill session_id from the most recently updated linked coach session.
UPDATE public.trade_memory AS tm
SET session_id = picked.session_id
FROM (
  SELECT DISTINCT ON (s.trade_id, s.user_id)
    s.trade_id,
    s.user_id,
    s.id AS session_id
  FROM public.trade_coach_sessions AS s
  WHERE s.trade_id IS NOT NULL
  ORDER BY s.trade_id, s.user_id, s.updated_at DESC
) AS picked
WHERE tm.session_id IS NULL
  AND tm.trade_id = picked.trade_id
  AND tm.user_id = picked.user_id;

-- Fallback: use feedback.session_id when session.trade_id link exists.
UPDATE public.trade_memory AS tm
SET session_id = f.session_id
FROM public.trade_coach_feedback AS f
WHERE tm.session_id IS NULL
  AND f.trade_id = tm.trade_id
  AND f.user_id = tm.user_id
  AND f.session_id IS NOT NULL;

-- Remove memory rows that point at deleted/non-existent trades before adding FK.
DELETE FROM public.trade_memory AS tm
WHERE NOT EXISTS (
  SELECT 1 FROM public.trades AS t WHERE t.id = tm.trade_id
);

-- Null out invalid session references before FK creation.
UPDATE public.trade_memory AS tm
SET session_id = NULL
WHERE tm.session_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.trade_coach_sessions AS s
    WHERE s.id = tm.session_id
  );

CREATE INDEX IF NOT EXISTS trade_memory_session_id_idx
  ON public.trade_memory (session_id)
  WHERE session_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trade_memory_trade_id_fkey'
  ) THEN
    ALTER TABLE public.trade_memory
      ADD CONSTRAINT trade_memory_trade_id_fkey
      FOREIGN KEY (trade_id) REFERENCES public.trades(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trade_memory_session_id_fkey'
  ) THEN
    ALTER TABLE public.trade_memory
      ADD CONSTRAINT trade_memory_session_id_fkey
      FOREIGN KEY (session_id) REFERENCES public.trade_coach_sessions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Normalize trades enums before CHECK constraints
-- ---------------------------------------------------------------------------
UPDATE public.trades
SET direction = UPPER(btrim(direction))
WHERE direction IS NOT NULL
  AND direction <> UPPER(btrim(direction));

UPDATE public.trades
SET result = UPPER(btrim(result))
WHERE result IS NOT NULL
  AND result <> UPPER(btrim(result));

UPDATE public.trades
SET result = 'BE'
WHERE result IN ('BREAKEVEN', 'B/E', 'B-E', 'EVEN', 'FLAT');

UPDATE public.trades
SET direction = CASE
  WHEN direction IN ('LONG', 'BULL', 'BULLISH') THEN 'BUY'
  WHEN direction IN ('SHORT', 'BEAR', 'BEARISH') THEN 'SELL'
  ELSE direction
END
WHERE direction IN ('LONG', 'BULL', 'BULLISH', 'SHORT', 'BEAR', 'BEARISH');

-- ---------------------------------------------------------------------------
-- CHECK constraints (NOT VALID first for large tables, then VALIDATE)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trades_direction_check'
  ) THEN
    ALTER TABLE public.trades
      ADD CONSTRAINT trades_direction_check
      CHECK (direction IN ('BUY', 'SELL')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trades_result_check'
  ) THEN
    ALTER TABLE public.trades
      ADD CONSTRAINT trades_result_check
      CHECK (result IN ('WIN', 'LOSS', 'BE')) NOT VALID;
  END IF;
END $$;

-- Report rows that violate new enums before validation.
CREATE OR REPLACE VIEW public.vyronis_trades_enum_violations AS
SELECT id, user_id, direction, result, created_at
FROM public.trades
WHERE direction NOT IN ('BUY', 'SELL')
   OR result NOT IN ('WIN', 'LOSS', 'BE');

COMMENT ON VIEW public.vyronis_trades_enum_violations IS
  'Fix these rows before validating trades_direction_check / trades_result_check.';

-- Validate only when clean (no-op if already valid).
DO $$
DECLARE
  v_bad integer;
BEGIN
  SELECT count(*) INTO v_bad FROM public.vyronis_trades_enum_violations;
  IF v_bad = 0 THEN
    ALTER TABLE public.trades VALIDATE CONSTRAINT trades_direction_check;
    ALTER TABLE public.trades VALIDATE CONSTRAINT trades_result_check;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Coach feedback integrity: remove rows that reference missing trades
-- ---------------------------------------------------------------------------
DELETE FROM public.trade_coach_feedback AS f
WHERE f.trade_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.trades AS t WHERE t.id = f.trade_id
  );

NOTIFY pgrst, 'reload schema';
