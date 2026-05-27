-- =============================================================================
-- 005-trades-id-default-uuid.sql
-- Vyronis AI — Repair migration (run after 000–004)
-- =============================================================================
--
-- PURPOSE
--   Restore auto-generated UUIDs on public.trades.id after 000 PK swap.
--   Without this DEFAULT, INSERT rows that omit id fail with:
--   "null value in column id of relation trades"
--
-- RUN AFTER
--   000-trades-id-bigint-to-uuid.sql (and 001–004 if applied)
--
-- ROLLBACK (manual)
--   ALTER TABLE public.trades ALTER COLUMN id DROP DEFAULT;
--
-- SAFE TO RE-RUN: Yes
-- =============================================================================

ALTER TABLE public.trades
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

COMMENT ON COLUMN public.trades.id IS
  'CANONICAL: uuid primary key with DEFAULT gen_random_uuid().';

NOTIFY pgrst, 'reload schema';

-- VERIFICATION (SELECT ONLY)
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'trades'
  AND column_name = 'id';

SELECT
  CASE
    WHEN (
      SELECT column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'trades'
        AND column_name = 'id'
    ) LIKE '%gen_random_uuid%'
    THEN 'PASS: trades.id auto-generates UUIDs'
    ELSE 'FAIL: trades.id missing gen_random_uuid() default'
  END AS migration_status;
