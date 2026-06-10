-- Audit and repair trades that were saved with fabricated 1% risk.
--
-- Background: the app previously used `risk_percent = 1` when the journal field was blank.
-- Your challenge limit (e.g. 0.5%) lives in user_settings.max_risk_per_trade.
--
-- PREREQUISITE: run 045-risk-percent-no-default.sql first.
--
-- HOW TO USE (Supabase SQL Editor):
--   1. Run SECTION 1 only — review the audit output.
--   2. Run SECTION 2 inside a transaction; ROLLBACK to dry-run, COMMIT when satisfied.
--   3. Re-run SECTION 1 — remaining rows should be intentional 1% logs or already fixed.
--
-- This script NEVER guesses 0.5% without evidence. It only:
--   A) Restores risk from linked coach planned_risk / planned_context (verified sources)
--   B) Sets NULL on likely defaults so the coach shows "not verified" until you re-enter risk

-- =============================================================================
-- SECTION 1 — AUDIT (read-only)
-- =============================================================================

WITH user_caps AS (
  SELECT user_id, max_risk_per_trade
  FROM public.user_settings
),
coach_evidence AS (
  SELECT
    cs.trade_id,
    MAX(
      CASE
        WHEN m.question_key = 'planned_risk' AND m.role = 'user'
        THEN NULLIF(regexp_replace(m.content, '[^0-9.]', '', 'g'), '')::numeric
      END
    ) AS coach_message_risk,
    MAX(
      NULLIF(
        regexp_replace(cs.planned_context->>'risk_percent', '[^0-9.]', '', 'g'),
        ''
      )::numeric
    ) AS planned_context_risk
  FROM public.trade_coach_sessions cs
  LEFT JOIN public.trade_coach_messages m ON m.session_id = cs.id
  WHERE cs.trade_id IS NOT NULL
  GROUP BY cs.trade_id
)
SELECT
  t.id AS trade_id,
  t.pair,
  t.direction,
  t.result,
  t.trade_date,
  t.created_at::date AS logged_on,
  t.risk_percent AS stored_risk_pct,
  uc.max_risk_per_trade AS user_max_risk_pct,
  ce.coach_message_risk,
  ce.planned_context_risk,
  CASE
    WHEN ce.coach_message_risk IS NOT NULL
      AND ce.coach_message_risk > 0
      AND ce.coach_message_risk <= 10
      AND ce.coach_message_risk <> t.risk_percent
      THEN format('restore to %s%% from coach planned_risk', ce.coach_message_risk)
    WHEN ce.planned_context_risk IS NOT NULL
      AND ce.planned_context_risk > 0
      AND ce.planned_context_risk <= 10
      AND ce.planned_context_risk <> t.risk_percent
      THEN format('restore to %s%% from planned_context', ce.planned_context_risk)
    WHEN t.risk_percent = 1 AND uc.max_risk_per_trade <> 1
      THEN 'set NULL — likely old blank-field default (re-enter risk in journal)'
    ELSE 'review manually'
  END AS suggested_action
FROM public.trades t
JOIN user_caps uc ON uc.user_id = t.user_id
LEFT JOIN coach_evidence ce ON ce.trade_id = t.id
WHERE t.risk_percent = 1
  AND uc.max_risk_per_trade <> 1
ORDER BY t.trade_date DESC NULLS LAST, t.created_at DESC;


-- =============================================================================
-- SECTION 2 — REPAIR (transactional — ROLLBACK first to preview row counts)
-- =============================================================================

BEGIN;

-- 2A) Restore from coach evidence (highest confidence)
WITH verified AS (
  SELECT
    cs.trade_id,
    COALESCE(
      MAX(
        CASE
          WHEN m.question_key = 'planned_risk' AND m.role = 'user'
          THEN NULLIF(regexp_replace(m.content, '[^0-9.]', '', 'g'), '')::numeric
        END
      ),
      MAX(
        NULLIF(
          regexp_replace(cs.planned_context->>'risk_percent', '[^0-9.]', '', 'g'),
          ''
        )::numeric
      )
    ) AS verified_risk_pct
  FROM public.trade_coach_sessions cs
  LEFT JOIN public.trade_coach_messages m ON m.session_id = cs.id
  WHERE cs.trade_id IS NOT NULL
  GROUP BY cs.trade_id
)
UPDATE public.trades t
SET
  risk_percent = v.verified_risk_pct,
  updated_at = now()
FROM verified v
JOIN public.user_settings us ON us.user_id = t.user_id
WHERE t.id = v.trade_id
  AND t.risk_percent = 1
  AND us.max_risk_per_trade <> 1
  AND v.verified_risk_pct IS NOT NULL
  AND v.verified_risk_pct > 0
  AND v.verified_risk_pct <= 10
  AND v.verified_risk_pct <> 1;

-- Inspect how many rows 2A touched (optional)
-- SELECT COUNT(*) FROM public.trades WHERE risk_percent IS NOT NULL AND risk_percent <> 1;

-- 2B) Null out remaining likely defaults (no verified coach alternate)
UPDATE public.trades t
SET
  risk_percent = NULL,
  updated_at = now()
FROM public.user_settings us
WHERE t.user_id = us.user_id
  AND t.risk_percent = 1
  AND us.max_risk_per_trade <> 1
  AND NOT EXISTS (
    SELECT 1
    FROM public.trade_coach_sessions cs
    WHERE cs.trade_id = t.id
      AND (
        NULLIF(
          regexp_replace(cs.planned_context->>'risk_percent', '[^0-9.]', '', 'g'),
          ''
        )::numeric IS NOT NULL
        AND NULLIF(
          regexp_replace(cs.planned_context->>'risk_percent', '[^0-9.]', '', 'g'),
          ''
        )::numeric <> 1
        OR EXISTS (
          SELECT 1
          FROM public.trade_coach_messages m
          WHERE m.session_id = cs.id
            AND m.question_key = 'planned_risk'
            AND m.role = 'user'
            AND NULLIF(regexp_replace(m.content, '[^0-9.]', '', 'g'), '')::numeric IS NOT NULL
            AND NULLIF(regexp_replace(m.content, '[^0-9.]', '', 'g'), '')::numeric <> 1
        )
      )
  );

-- Dry-run: leave changes uncommitted
ROLLBACK;
-- When ready: comment ROLLBACK above and run COMMIT; instead.


-- =============================================================================
-- SECTION 3 — POST-CHECK (read-only, run after COMMIT)
-- =============================================================================

-- Trades still at 1% while user max risk is not 1% (should be intentional logs only)
SELECT
  t.id,
  t.pair,
  t.trade_date,
  t.risk_percent,
  us.max_risk_per_trade
FROM public.trades t
JOIN public.user_settings us ON us.user_id = t.user_id
WHERE t.risk_percent = 1
  AND us.max_risk_per_trade <> 1
ORDER BY t.trade_date DESC NULLS LAST;

-- Trades with unknown risk after cleanup — edit in journal or regenerate coach review
SELECT
  t.id,
  t.pair,
  t.trade_date,
  t.risk_percent
FROM public.trades t
WHERE t.risk_percent IS NULL
ORDER BY t.trade_date DESC NULLS LAST
LIMIT 50;
