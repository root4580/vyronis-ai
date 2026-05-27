-- =============================================================================
-- 006-fix-coach-feedback-unique-constraint.sql
-- Vyronis AI — Repair migration (run after 000–005)
-- =============================================================================
--
-- PURPOSE
--   Restore a full UNIQUE constraint on trade_coach_feedback.trade_id so
--   Supabase upsert({ onConflict: "trade_id" }) works for coach review.
--
-- ROOT CAUSE
--   001/000 replaced CONSTRAINT trade_coach_feedback_trade_id_key with a
--   PARTIAL unique index (WHERE trade_id IS NOT NULL). PostgREST ON CONFLICT
--   requires a non-partial unique/exclusion constraint on the target column(s).
--
-- RUN AFTER
--   001-fix-coach-trade-id-uuid.sql
--
-- ROLLBACK (manual)
--   ALTER TABLE public.trade_coach_feedback DROP CONSTRAINT IF EXISTS trade_coach_feedback_trade_id_key;
--   CREATE UNIQUE INDEX trade_coach_feedback_trade_id_key
--     ON public.trade_coach_feedback (trade_id) WHERE trade_id IS NOT NULL;
--
-- SAFE TO RE-RUN: Yes
-- =============================================================================

-- Remove orphan feedback rows that cannot upsert anyway (coach always sends trade_id).
DELETE FROM public.trade_coach_feedback
WHERE trade_id IS NULL;

-- Keep the newest review per trade if duplicates exist.
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

-- Drop partial unique index from 001/000 (same name, wrong type for ON CONFLICT).
DROP INDEX IF EXISTS public.trade_coach_feedback_trade_id_key;

ALTER TABLE public.trade_coach_feedback
  DROP CONSTRAINT IF EXISTS trade_coach_feedback_trade_id_key;

ALTER TABLE public.trade_coach_feedback
  ADD CONSTRAINT trade_coach_feedback_trade_id_key UNIQUE (trade_id);

ALTER TABLE public.trade_coach_feedback
  ALTER COLUMN trade_id SET NOT NULL;

COMMENT ON CONSTRAINT trade_coach_feedback_trade_id_key ON public.trade_coach_feedback IS
  'One coach review per trade. Required for Supabase upsert onConflict trade_id.';

NOTIFY pgrst, 'reload schema';

-- VERIFICATION (SELECT ONLY)
SELECT
  conname,
  contype,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.trade_coach_feedback'::regclass
  AND conname = 'trade_coach_feedback_trade_id_key';

SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'trade_coach_feedback'
  AND indexname = 'trade_coach_feedback_trade_id_key';

SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.trade_coach_feedback'::regclass
        AND conname = 'trade_coach_feedback_trade_id_key'
        AND contype = 'u'
    ) THEN 'PASS: coach feedback upsert onConflict(trade_id) supported'
    ELSE 'FAIL: unique constraint missing'
  END AS migration_status;
