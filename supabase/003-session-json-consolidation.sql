-- =============================================================================
-- 003-session-json-consolidation.sql
-- Vyronis AI — Repair migration 3 of 4
-- =============================================================================
--
-- PURPOSE
--   Merge legacy top-level session JSON columns into planned_context jsonb
--   without deleting columns (dual-read compatibility preserved).
--
-- RUN AFTER
--   002-trade-integrity.sql
--
-- RUN BEFORE
--   004-mark-deprecated-session-columns.sql
--
-- ROLLBACK (manual)
--   This migration only writes into planned_context. Roll back by restoring
--   planned_context from a pre-migration backup (pg_dump) if needed.
--   Top-level columns are untouched.
--
-- SAFE TO RE-RUN: Yes (only fills missing planned_context keys)
-- =============================================================================

-- Ensure screenshot_url stays aligned with legacy chart_url before JSON merge.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trade_coach_sessions'
      AND column_name = 'chart_url'
  ) THEN
    UPDATE public.trade_coach_sessions
    SET screenshot_url = chart_url
    WHERE screenshot_url IS NULL
      AND chart_url IS NOT NULL;

    UPDATE public.trade_coach_sessions
    SET chart_url = screenshot_url
    WHERE chart_url IS NULL
      AND screenshot_url IS NOT NULL;
  END IF;
END $$;

-- Merge top-level analysis blobs into planned_context when the jsonb key is absent.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trade_coach_sessions'
      AND column_name = 'chart_analysis'
  ) THEN
    UPDATE public.trade_coach_sessions AS s
    SET planned_context = s.planned_context || jsonb_strip_nulls(
      jsonb_build_object(
        'chart_analysis',
          CASE
            WHEN (s.planned_context->'chart_analysis') IS NULL
             AND s.chart_analysis IS NOT NULL
             AND s.chart_analysis <> '{}'::jsonb
            THEN s.chart_analysis
          END,
        'mtf_analysis',
          CASE
            WHEN (s.planned_context->'mtf_analysis') IS NULL
             AND s.mtf_analysis IS NOT NULL
             AND s.mtf_analysis <> '{}'::jsonb
            THEN s.mtf_analysis
          END,
        'visual_analysis',
          CASE
            WHEN (s.planned_context->'visual_analysis') IS NULL
             AND s.visual_analysis IS NOT NULL
             AND s.visual_analysis <> '{}'::jsonb
            THEN s.visual_analysis
          END,
        'chart_annotations',
          CASE
            WHEN (s.planned_context->'chart_annotations') IS NULL
             AND s.chart_annotations IS NOT NULL
             AND s.chart_annotations <> '{}'::jsonb
            THEN s.chart_annotations
          END
      )
    );
  END IF;
END $$;

-- Surface rows where top-level JSON still differs from planned_context (for review).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trade_coach_sessions'
      AND column_name = 'chart_analysis'
  ) THEN
    EXECUTE $view$
      CREATE OR REPLACE VIEW public.vyronis_session_json_drift AS
      SELECT
        s.id,
        s.user_id,
        s.trade_id,
        (s.chart_analysis IS NOT NULL AND s.chart_analysis <> '{}'::jsonb
          AND s.planned_context->'chart_analysis' IS DISTINCT FROM s.chart_analysis) AS chart_analysis_drift,
        (s.mtf_analysis IS NOT NULL AND s.mtf_analysis <> '{}'::jsonb
          AND s.planned_context->'mtf_analysis' IS DISTINCT FROM s.mtf_analysis) AS mtf_analysis_drift,
        (s.visual_analysis IS NOT NULL AND s.visual_analysis <> '{}'::jsonb
          AND s.planned_context->'visual_analysis' IS DISTINCT FROM s.visual_analysis) AS visual_analysis_drift,
        (s.chart_annotations IS NOT NULL AND s.chart_annotations <> '{}'::jsonb
          AND s.planned_context->'chart_annotations' IS DISTINCT FROM s.chart_annotations) AS chart_annotations_drift
      FROM public.trade_coach_sessions AS s
      WHERE (
        s.chart_analysis IS NOT NULL AND s.chart_analysis <> '{}'::jsonb
        AND s.planned_context->'chart_analysis' IS DISTINCT FROM s.chart_analysis
      ) OR (
        s.mtf_analysis IS NOT NULL AND s.mtf_analysis <> '{}'::jsonb
        AND s.planned_context->'mtf_analysis' IS DISTINCT FROM s.mtf_analysis
      ) OR (
        s.visual_analysis IS NOT NULL AND s.visual_analysis <> '{}'::jsonb
        AND s.planned_context->'visual_analysis' IS DISTINCT FROM s.visual_analysis
      ) OR (
        s.chart_annotations IS NOT NULL AND s.chart_annotations <> '{}'::jsonb
        AND s.planned_context->'chart_annotations' IS DISTINCT FROM s.chart_annotations
      )
    $view$;

    COMMENT ON VIEW public.vyronis_session_json_drift IS
      'Sessions where top-level JSON columns differ from planned_context after 003 merge.';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
