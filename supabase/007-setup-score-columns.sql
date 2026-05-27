-- A+ setup scoring columns on trades (journal-level scoring)
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS setup_score integer,
  ADD COLUMN IF NOT EXISTS setup_classification text,
  ADD COLUMN IF NOT EXISTS setup_score_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS setup_coaching_insights jsonb;

ALTER TABLE public.trades
  DROP CONSTRAINT IF EXISTS trades_setup_score_range;

ALTER TABLE public.trades
  ADD CONSTRAINT trades_setup_score_range
  CHECK (setup_score IS NULL OR (setup_score >= 0 AND setup_score <= 100));

ALTER TABLE public.trades
  DROP CONSTRAINT IF EXISTS trades_setup_classification_check;

ALTER TABLE public.trades
  ADD CONSTRAINT trades_setup_classification_check
  CHECK (
    setup_classification IS NULL OR setup_classification IN (
      'A+', 'B', 'C', 'Impulsive', 'Revenge', 'Counter-Trend'
    )
  );

COMMENT ON COLUMN public.trades.setup_score IS 'Journal setup quality score 0-100';
COMMENT ON COLUMN public.trades.setup_classification IS 'A+, B, C, Impulsive, Revenge, or Counter-Trend';
COMMENT ON COLUMN public.trades.setup_score_breakdown IS 'JSON breakdown: htfAlignment, confirmation, timing, riskReward, emotionalState, ruleFollowing';
COMMENT ON COLUMN public.trades.setup_coaching_insights IS 'JSON array of AI coaching insight objects';
