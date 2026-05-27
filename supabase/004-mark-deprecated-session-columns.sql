-- =============================================================================
-- 004-mark-deprecated-session-columns.sql
-- Vyronis AI — Repair migration 4 of 4
-- =============================================================================
--
-- PURPOSE
--   Mark legacy session columns as DEPRECATED (do NOT drop yet).
--   App continues dual-read; writers should prefer planned_context + screenshot_url.
--
-- RUN AFTER
--   003-session-json-consolidation.sql
--
-- ROLLBACK (manual)
--   COMMENT ON COLUMN ... IS NULL; for each column below.
--
-- SAFE TO RE-RUN: Yes
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trade_coach_sessions' AND column_name = 'chart_url'
  ) THEN
    COMMENT ON COLUMN public.trade_coach_sessions.chart_url IS
      'DEPRECATED (004): Use screenshot_url. Kept for backward compatibility; do not write new data here.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trade_coach_sessions' AND column_name = 'chart_analysis'
  ) THEN
    COMMENT ON COLUMN public.trade_coach_sessions.chart_analysis IS
      'DEPRECATED (004): Canonical copy lives in planned_context.chart_analysis. Column retained for dual-read.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trade_coach_sessions' AND column_name = 'mtf_analysis'
  ) THEN
    COMMENT ON COLUMN public.trade_coach_sessions.mtf_analysis IS
      'DEPRECATED (004): Canonical copy lives in planned_context.mtf_analysis. Column retained for dual-read.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trade_coach_sessions' AND column_name = 'visual_analysis'
  ) THEN
    COMMENT ON COLUMN public.trade_coach_sessions.visual_analysis IS
      'DEPRECATED (004): Canonical copy lives in planned_context.visual_analysis. Column retained for dual-read.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trade_coach_sessions' AND column_name = 'chart_annotations'
  ) THEN
    COMMENT ON COLUMN public.trade_coach_sessions.chart_annotations IS
      'DEPRECATED (004): Canonical copy lives in planned_context.chart_annotations. Column retained for dual-read.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trade_coach_sessions' AND column_name = 'trade_id_legacy_bigint'
  ) THEN
    COMMENT ON COLUMN public.trade_coach_sessions.trade_id_legacy_bigint IS
      'DEPRECATED (001): Legacy bigint trade_id preserved for audit. Use trade_id uuid.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trade_coach_feedback' AND column_name = 'trade_id_legacy_bigint'
  ) THEN
    COMMENT ON COLUMN public.trade_coach_feedback.trade_id_legacy_bigint IS
      'DEPRECATED (001): Legacy bigint trade_id preserved for audit. Use trade_id uuid.';
  END IF;
END $$;

COMMENT ON COLUMN public.trade_coach_sessions.planned_context IS
  'CANONICAL (004): Primary pre-trade analysis document (chart/mtf/visual/annotations JSON).';

COMMENT ON COLUMN public.trade_coach_sessions.screenshot_url IS
  'CANONICAL (004): Primary entry chart URL. MTF URLs remain separate scalar columns.';

COMMENT ON COLUMN public.trade_coach_sessions.trade_id IS
  'CANONICAL (001): uuid FK to trades.id. Required for replay + memory linkage.';

COMMENT ON COLUMN public.trade_memory.trade_id IS
  'CANONICAL (002): uuid FK to trades.id ON DELETE CASCADE.';

COMMENT ON COLUMN public.trade_memory.session_id IS
  'CANONICAL (002): Optional uuid FK to trade_coach_sessions.id for replay/coach linkage.';

NOTIFY pgrst, 'reload schema';
