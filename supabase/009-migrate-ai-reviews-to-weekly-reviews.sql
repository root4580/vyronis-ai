-- Reversible data migration: copy legacy ai_reviews (weekly) into weekly_reviews.
-- Does NOT drop ai_reviews — safe to run alongside existing data.
--
-- Rollback (manual, if needed):
--   DELETE FROM public.weekly_reviews
--   WHERE provider = 'heuristic'
--     AND report_payload->>'migratedFrom' = 'ai_reviews';
--
-- Prerequisites: 008-weekly-reviews.sql

INSERT INTO public.weekly_reviews (
  user_id,
  week_start,
  week_end,
  week_label,
  summary,
  discipline_score,
  emotional_stability_score,
  execution_score,
  consistency_score,
  overall_score,
  recurring_mistakes,
  emotional_patterns,
  discipline_trends,
  best_setup_types,
  behavioral_flags,
  strongest_session,
  weakest_habit,
  improvement_plan,
  insights,
  report_payload,
  provider,
  created_at,
  updated_at
)
SELECT
  ar.user_id,
  ar.week_start,
  COALESCE(ar.week_end, ar.week_start),
  to_char(ar.week_start, 'Mon DD, YYYY'),
  COALESCE(NULLIF(ar.summary, ''), 'Weekly review'),
  GREATEST(0, LEAST(100, COALESCE(ar.discipline_score, 0))),
  0,
  0,
  0,
  GREATEST(0, LEAST(100, COALESCE(ar.discipline_score, 0))),
  COALESCE(ar.recurring_mistakes, '[]'::jsonb),
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'emotion', elem->>'emotion',
          'count', COALESCE((elem->>'count')::int, 0),
          'percentage', 0
        )
      )
      FROM jsonb_array_elements(COALESCE(ar.emotional_trends, '[]'::jsonb)) AS elem
    ),
    '[]'::jsonb
  ),
  '{}'::jsonb,
  CASE
    WHEN ar.most_profitable_setup IS NOT NULL
    THEN jsonb_build_array(ar.most_profitable_setup)
    ELSE '[]'::jsonb
  END,
  '{}'::jsonb,
  NULL,
  NULL,
  COALESCE(ar.advice, '[]'::jsonb),
  '[]'::jsonb,
  jsonb_build_object(
    'migratedFrom', 'ai_reviews',
    'legacyAiReviewId', ar.id,
    'legacyPayload', ar.payload
  ),
  'heuristic',
  ar.created_at,
  ar.updated_at
FROM public.ai_reviews ar
WHERE ar.review_type = 'weekly'
  AND ar.week_start IS NOT NULL
ON CONFLICT (user_id, week_start) DO NOTHING;
